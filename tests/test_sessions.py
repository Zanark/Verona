import json
import http.client
import os
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch

from verona.agent import private_descriptor
from verona.agent_host import AgentBridge
from verona.manager import ManagerHandler, SessionManager
from verona.server import LocalServer, State
from verona.session_config import appearance, colors_patch


class SessionTests(unittest.TestCase):
    def test_partial_colors_are_validated_without_mutation_and_default_is_explicit(self):
        source = {"hair": " #f0c ", "lips": None}
        self.assertEqual(colors_patch(source), {"hair": "#FF00CC", "lips": None})
        self.assertEqual(source, {"hair": " #f0c ", "lips": None})
        for value in ({"hair": True}, {"other": "#FFF"}, {"hair": "#12345"}, []):
            with self.assertRaises(ValueError):
                colors_patch(value)
        with self.assertRaises(ValueError):
            appearance("missing")

    def test_named_heads_and_confirmed_live_colors_do_not_cross_or_regenerate(self):
        with tempfile.TemporaryDirectory() as directory:
            states = [State(Mock(), []) for _ in range(2)]
            bridges = [AgentBridge(state, Path(directory) / f"{index}.json", Mock())
                       for index, state in enumerate(states)]
            first, second = bridges
            first.ready = second.ready = True
            sent = threading.Event()
            commands = []
            first._send = lambda command: (commands.append(command), sent.set())
            results = []
            worker = threading.Thread(target=lambda: results.append(first.command(
                {"action": "configure", "colors": {"hair": "#abc", "lips": "#F00"}})))
            worker.start()
            self.assertTrue(sent.wait(2))
            self.assertTrue(first.snapshot()["appearancePending"])
            first.event({"event": "appearance", "colors": commands[0]["colors"],
                         "revision": commands[0]["revision"]})
            worker.join(2)
            self.assertFalse(worker.is_alive())
            self.assertEqual(results[0]["appearance"]["colors"]["hair"], "#AABBCC")
            self.assertIsNone(second.appearance["colors"]["hair"])
            self.assertIsNone(first.job)
            states[0].engine.generate.assert_not_called()
            first.close()
            second.close()

    def test_native_control_failure_is_reported_without_poisoning_speech_host(self):
        with tempfile.TemporaryDirectory() as directory:
            bridge = AgentBridge(State(Mock(), []), Path(directory) / "head.json", Mock())
            bridge.ready = True
            bridge.controls = [{"id": "yaw"}]

            def acknowledge(message):
                bridge.event({"event": "controls", "controls": bridge.controls,
                              "revision": message["revision"], "error": "Unsupported angle."})
                bridge.event({"event": "controls", "controls": bridge.controls, "revision": None})
            bridge._send = acknowledge
            with self.assertRaisesRegex(RuntimeError, "Unsupported angle"):
                bridge.command({"action": "configure", "settings": {"yaw": "invalid"}})
            self.assertTrue(bridge.ready)
            self.assertIsNone(bridge.fault)
            self.assertIsNone(bridge.pending_appearance)
            with self.assertRaises(ValueError):
                bridge.command({"action": "configure", "settings": None})
            bridge.close()

    def test_manager_api_keeps_capability_and_origin_boundaries(self):
        state = State(None, [])
        server = LocalServer(0, state)
        server.RequestHandlerClass = ManagerHandler
        server.manager = SessionManager()
        thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": .01})
        thread.start()
        origin = f"http://127.0.0.1:{server.server_port}"
        try:
            for token, site, payload, expected in (
                ("", origin, {"action":"status"}, 403),
                (state.token, "http://outside.invalid", {"action":"status"}, 403),
                (state.token, origin, {"action":"status","extra":True}, 400),
                (state.token, origin, {"action":"status"}, 200),
            ):
                connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=3)
                connection.request("POST", "/api/agent", body=json.dumps(payload),
                    headers={"Origin":site,"X-Verona-Token":token,"Content-Type":"application/json"})
                response = connection.getresponse()
                self.assertEqual(response.status, expected)
                response.read()
                connection.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join(3)

    def test_manager_lists_external_sessions_without_exposing_capabilities(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {"LOCALAPPDATA": directory}):
            from verona.agent import session_path
            data = {"version":1,"port":12345,"token":"a"*43,"pid":42,"instance":"b"*32}
            private_descriptor(session_path("external"), data)
            manager = SessionManager()
            with patch("verona.manager.call", return_value={"ready":True,"state":"idle",
                       "appearance":appearance("robot", {"eyes":"#00f"}, "external")}):
                sessions = manager.list()
                self.assertEqual(sessions[0]["appearance"]["model"], "robot")
                self.assertFalse(sessions[0]["owned"])
                self.assertNotIn(data["token"], json.dumps(sessions))
            with patch("verona.manager.call", side_effect=RuntimeError("stale")):
                self.assertEqual(manager.list()[0]["state"], "unavailable")
            manager.close()
            self.assertTrue(session_path("external").exists())

    def test_manager_rejects_unknown_fields_and_invalid_names_before_spawning(self):
        manager = SessionManager()
        with patch("verona.manager.subprocess.Popen") as spawn:
            for value in (
                {"action":"create","session":"../other","model":"claire","colors":{}},
                {"action":"create","session":"test","model":"unknown","colors":{}},
                {"action":"create","session":"test","model":"claire","colors":{"hair":"bad!"}},
                {"action":"shutdown","other":True},
            ):
                with self.assertRaises(ValueError):
                    manager.command(value)
            spawn.assert_not_called()
            manager.close()
            with self.assertRaisesRegex(RuntimeError, "closing"):
                manager.create("late", "claire", {})
            spawn.assert_not_called()


if __name__ == "__main__":
    unittest.main()

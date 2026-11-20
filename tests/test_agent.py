import http.client
import json
import os
import socket
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch

from tests.test_local_server import FixtureEngine
from verona.agent import private_descriptor, read_descriptor, session_path
from verona.agent_host import AgentBridge
from verona.server import LocalServer, State
from verona.speech import Speech, package_pcm


class AgentTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.state = State(FixtureEngine(), [{"name": "fixture", "culture": "en-US"}])
        self.bridge = AgentBridge(self.state, Path(self.directory.name) / "session.json", Mock())
        self.state.agent = self.bridge
        self.sent = []
        self.bridge._send = self.sent.append
        self.server = LocalServer(0, self.state)
        self.thread = threading.Thread(target=self.server.serve_forever,
                                       kwargs={"poll_interval": .01})
        self.thread.start()
        self.identifier = "a" * 32

    def tearDown(self):
        self.bridge.close()
        self.state.stop.set()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)
        self.assertFalse(self.thread.is_alive())
        self.directory.cleanup()

    def request(self, data, path="/api/agent", **headers):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        try:
            connection.request("POST", path, json.dumps(data), {
                "Origin": self.server.origin, "X-Verona-Token": self.state.token,
                "Content-Type": "application/json", **headers,
            })
            response = connection.getresponse()
            return response.status, json.loads(response.read())
        finally:
            connection.close()

    def say(self, **changes):
        self.bridge.ready = True
        payload = {"action": "say", "id": self.identifier, "text": "hello", "voice": None,
                   "expression": "neutral", "intensity": .35, "gain": 4, "mode": "face"}
        payload.update(changes)
        return payload

    def event(self, state, **values):
        self.bridge.event({"event": "job", "id": self.identifier, "state": state, **values})

    def test_explicit_host_auth_and_status_do_not_take_the_generation_lock(self):
        self.state.agent = None
        self.assertEqual(self.request({"action": "status"})[0], 404)
        self.state.agent = self.bridge
        self.assertEqual(self.request({"action": "status"},
                                      **{"X-Verona-Token": "wrong"})[0], 403)
        self.assertEqual(self.request({"action": "status"},
                                      **{"Origin": "https://other.example"})[0], 403)
        self.state.busy.acquire()
        try:
            status, body = self.request({"action": "status"})
            self.assertEqual(status, 200)
            self.assertFalse(body["ready"])
        finally:
            self.state.busy.release()
        self.assertFalse(self.sent)

    def test_idempotent_request_no_queue_no_early_completion_and_versioned_wait(self):
        payload = self.say()
        self.assertEqual(self.request(payload)[1]["state"], "generating")
        self.assertEqual(self.request(payload)[1]["state"], "generating")
        self.assertEqual(len(self.sent), 1)
        self.assertEqual(self.request(self.say(id="b" * 32))[0], 409)
        self.assertEqual(self.request(self.say(text="different"))[0], 400)
        self.event("playing")
        snapshot = self.bridge.command({"action": "status"})
        self.assertEqual(snapshot["state"], "playing")
        result = []
        waiter = threading.Thread(target=lambda: result.append(self.bridge.command({
            "action": "wait", "id": self.identifier, "version": snapshot["version"], "seconds": 1})))
        waiter.start()
        self.event("completed", cacheHit=False)
        waiter.join(timeout=2)
        self.assertFalse(waiter.is_alive())
        self.assertEqual(result[0]["state"], "completed")
        self.assertEqual(self.request(payload)[1]["state"], "completed")
        self.assertEqual(len(self.sent), 1)
        self.assertNotIn("text", json.dumps(result))

    def test_cancel_is_owned_stays_busy_until_ack_and_old_ids_do_not_replay(self):
        self.request(self.say())
        self.assertEqual(self.request({"action": "cancel", "id": "b" * 32})[0], 400)
        _, body = self.request({"action": "cancel", "id": self.identifier})
        self.assertEqual(body["state"], "cancelling")
        self.assertTrue(self.bridge.generation_stop(self.identifier).is_set())
        self.assertEqual(self.request(self.say(id="b" * 32))[0], 409)
        self.event("failed", error="cancelled during generation")
        self.assertEqual(self.request({"action": "status"})[1]["state"], "cancelled")
        self.assertEqual(self.request(self.say(id="b" * 32))[0], 200)
        self.assertEqual(self.request({"action": "wait", "id": self.identifier,
                                      "version": 0, "seconds": 1})[0], 400)

    def test_invalid_inputs_are_not_accepted_as_defaults_or_queued(self):
        for changes in ({"voice": False}, {"voice": ""}, {"intensity": float("nan")},
                        {"gain": True}, {"mode": "other"}, {"expression": "happy+sad"},
                        {"mode": "voice", "expression": "happy"}, {"id": "../other"}):
            self.assertEqual(self.request(self.say(**changes))[0], 400, changes)
        self.assertFalse(self.sent)
        self.assertIsNone(self.state.speech)

    def test_cancelled_synthesis_does_not_replace_the_previous_ram_sample(self):
        self.request(self.say())
        old_pcm = bytes(1600)
        old = Speech(package_pcm(old_pcm), old_pcm, "fixture")
        self.state.speech = old
        def synthesize(*args):
            self.bridge.job["cancel"].set()
            return Speech(package_pcm(bytes(3200)), bytes(3200), "fixture")
        self.state.synthesizer = synthesize
        with patch.object(self.state.engine, "generate") as generate:
            status, _ = self.request({
                "text": "new", "voice": "fixture", "expression": "neutral",
                "intensity": .35, "agentRequestId": self.identifier}, path="/api/generate")
        self.assertEqual(status, 503)
        self.assertIs(self.state.speech, old)
        generate.assert_not_called()
        self.assertFalse(self.state.busy.locked())

    def test_private_descriptor_is_exclusive_bounded_and_never_accepts_arbitrary_urls(self):
        path = Path(self.directory.name) / "test.json"
        data = {"version": 1, "port": 12345, "token": "a" * 43, "pid": 42, "instance": "f" * 32}
        private_descriptor(path, data)
        self.assertEqual(read_descriptor(path), data)
        with self.assertRaises(OSError):
            private_descriptor(path, dict(data, token="b" * 43))
        self.assertEqual(read_descriptor(path), data)
        for value in (dict(data, port=True), dict(data, url="https://other.example"),
                      dict(data, token="bad"), dict(data, port=0)):
            path.write_text(json.dumps(value))
            with self.assertRaises(ValueError):
                read_descriptor(path)
        path.write_text("x" * 2049)
        with self.assertRaises(ValueError):
            read_descriptor(path)
        with patch.dict(os.environ, {"LOCALAPPDATA": self.directory.name}):
            for name in ("../escape", "", "space name"):
                with self.assertRaises(ValueError):
                    session_path(name)

    def test_client_does_not_import_neural_or_speech_dependencies(self):
        subprocess.run([sys.executable, "-c",
                        "import sys, verona.agent; "
                        "assert not {'numpy','onnxruntime','verona.speech','verona.engine'} & sys.modules.keys()"],
                       check=True, timeout=10)

    def test_native_socket_auth_push_and_disconnect_are_explicit(self):
        port = self.bridge.listen()
        self.bridge.attach(Mock(), self.server)
        with socket.create_connection(("127.0.0.1", port), timeout=3) as native:
            native.sendall((json.dumps({"token": self.state.token}) + "\n"
                            + json.dumps({"event": "ready"}) + "\n").encode())
            with self.bridge.condition:
                self.assertTrue(self.bridge.condition.wait_for(lambda: self.bridge.ready, timeout=2))
            del self.bridge._send
            result = self.bridge.command(self.say())
            self.assertEqual(result["state"], "generating")
            self.assertEqual(json.loads(native.recv(8192))["text"], "hello")
        with self.bridge.condition:
            self.assertTrue(self.bridge.condition.wait_for(lambda: bool(self.bridge.fault), timeout=2))
        snapshot = self.bridge.command({"action": "status"})
        self.assertFalse(snapshot["ready"])
        self.assertEqual(snapshot["state"], "failed")
        self.assertIn("exited", snapshot["error"])
        self.assertTrue(self.bridge.job["cancel"].is_set())

    def test_rejected_native_auth_is_not_left_silently_starting(self):
        port = self.bridge.listen()
        self.bridge.attach(Mock(), self.server)
        with socket.create_connection(("127.0.0.1", port), timeout=3) as native:
            native.sendall(json.dumps({"token": "wrong"}).encode() + b"\n")
            with self.bridge.condition:
                self.assertTrue(self.bridge.condition.wait_for(lambda: bool(self.bridge.fault), timeout=2))
        self.assertIn("authentication", self.bridge.snapshot()["error"])
        self.assertFalse(self.sent)

    def test_descriptor_cleanup_survives_worker_cleanup_failure(self):
        self.bridge.descriptor = {
            "version": 1, "port": 12345, "token": "a" * 43, "pid": 42, "instance": "f" * 32}
        private_descriptor(self.bridge.path, self.bridge.descriptor)
        self.bridge.speech.close.side_effect = RuntimeError("fixture worker cleanup failure")
        try:
            with self.assertRaisesRegex(RuntimeError, "fixture worker"):
                self.bridge.close()
            self.assertFalse(self.bridge.path.exists())
        finally:
            self.bridge.speech.close.side_effect = None


if __name__ == "__main__":
    unittest.main()

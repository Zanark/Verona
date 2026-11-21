import http.client
import json
import threading
import unittest
from unittest.mock import patch

from verona.engine import Clip
from verona.server import LocalServer, State
from verona.speech import Speech, package_pcm

import numpy as np


class FixtureEngine:
    condition = np.zeros((1, 1, 26), dtype=np.float32)
    mesh_metadata = {"fixture": True}
    mesh_bytes = b"fixture-mesh"

    def generate(self, speech, expression, intensity, stop, *, expression_gain=2):
        return Clip("fixture-clip", speech.wav, b"fixture-motion",
                    {"id": "fixture-clip", "expressionGainSetting": expression_gain})


class LocalServerTests(unittest.TestCase):
    def setUp(self):
        self.state = State(FixtureEngine(), [{"name": "fixture", "culture": "en-US"}])
        self.server = LocalServer(0, self.state)
        self.thread = threading.Thread(
            target=self.server.serve_forever, kwargs={"poll_interval": .01}
        )
        self.thread.start()
        self.headers = {
            "Host": self.server.host,
            "Origin": self.server.origin,
            "X-Verona-Token": self.state.token,
            "Content-Type": "application/json",
        }

    def tearDown(self):
        self.state.stop.set()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)
        self.assertFalse(self.thread.is_alive())

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        connection.request(method, path, body, self.headers if headers is None else headers)
        response = connection.getresponse()
        data = response.read()
        result = response.status, dict(response.getheaders()), data
        connection.close()
        return result

    def payload(self, **changes):
        values = {"text": "hello", "voice": "fixture", "expression": "neutral", "intensity": .35}
        values.update(changes)
        return json.dumps(values)

    def test_exact_host_origin_and_token_guards_precede_generation(self):
        for field, value in (
            ("Host", "other.example"), ("Origin", "https://other.example"),
            ("X-Verona-Token", "wrong"), ("Sec-Fetch-Site", "cross-site"),
        ):
            headers = dict(self.headers, **{field: value})
            status, _, _ = self.request("POST", "/api/generate", self.payload(), headers)
            self.assertEqual(status, 403, field)
        headers = self.headers.copy()
        headers.pop("Origin")
        status, _, _ = self.request("POST", "/api/generate", self.payload(), headers)
        self.assertEqual(status, 403)
        self.assertIsNone(self.state.clip)
        headers = self.headers.copy()
        headers.pop("X-Verona-Token")
        status, _, body = self.request("GET", "/api/session", headers=headers)
        self.assertEqual(status, 403)
        self.assertNotIn(self.state.token.encode("ascii"), body)

    def test_files_are_an_exact_allowlist_not_a_directory_server(self):
        for path in ("/.git/config", "/.env", "/../README.md", "/%2e%2e/README.md", "/api/clip/nope/audio"):
            status, _, _ = self.request("GET", path)
            self.assertEqual(status, 404, path)
        status, headers, body = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"Generate face", body)
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])
        self.assertEqual(headers["Cross-Origin-Resource-Policy"], "same-origin")
        self.assertIn("microphone=()", headers["Permissions-Policy"])
        self.assertNotIn("Access-Control-Allow-Origin", headers)
        status, headers, body = self.request("GET", "/framing.mjs")
        self.assertEqual(status, 200)
        self.assertIn("javascript", headers["Content-Type"])
        self.assertIn(b"export function trimTopology", body)
        status, headers, body = self.request("GET", "/presentations.mjs")
        self.assertEqual(status, 200)
        self.assertIn("javascript", headers["Content-Type"])
        self.assertIn(b"export const PRESENTATIONS", body)
        status, headers, body = self.request("GET", "/hairstyles.mjs")
        self.assertEqual(status, 200)
        self.assertIn("javascript", headers["Content-Type"])
        self.assertIn(b"export function createHairstyle", body)
        status, headers, body = self.request("GET", "/idle-life.mjs")
        self.assertEqual(status, 200)
        self.assertIn("javascript", headers["Content-Type"])
        self.assertIn(b"export function attachIdleLife", body)
        status, headers, body = self.request("GET", "/idle-sound.mjs")
        self.assertEqual(status, 200)
        self.assertIn(b"synthesizeIdleSound", body)
        status, headers, body = self.request("GET", "/performance-mode.mjs")
        self.assertEqual(status, 200)
        self.assertIn("javascript", headers["Content-Type"])
        self.assertIn(b"export function attachPerformanceMode", body)
        blocked = dict(self.headers, Origin="https://outside.invalid")
        self.assertEqual(self.request("GET", "/idle-life.mjs", headers=blocked)[0], 403)
        status, headers, body = self.request("GET", "/robot.mjs")
        self.assertEqual(status, 404)
        status, headers, body = self.request("GET", "/face-colors.mjs")
        self.assertEqual(status, 200)
        self.assertIn("javascript", headers["Content-Type"])
        self.assertIn(b"export function parseFaceColor", body)

    def test_oversized_bad_fields_voice_and_nonfinite_expression_fail(self):
        status, _, _ = self.request("POST", "/api/generate", "x" * 8193)
        self.assertEqual(status, 413)
        for payload in (
            self.payload(text=""),
            self.payload(text="x" * 281),
            self.payload(voice="not-installed"),
            self.payload(intensity=float("nan")),
            self.payload(intensity=True),
            self.payload(expression="happy+sad"),
            self.payload(expression={"happy": .3, "sad": .3}),
            self.payload(expressionGain=True),
            self.payload(expressionGain="4"),
            self.payload(expressionGain=3),
            self.payload(expressionGain=float("nan")),
            self.payload(extra="not-supported"),
            self.payload(voiceSettings={"pitch": 99}),
            self.payload(voiceSettings={"rate": True}),
            self.payload(voiceSettings={"extra": 1}),
            self.payload(voiceSettings=[]),
            "[]",
        ):
            status, _, _ = self.request("POST", "/api/generate", payload)
            self.assertEqual(status, 400, payload[:40])
        self.assertIsNone(self.state.clip)

    def test_private_idle_effects_require_capability_and_report_missing_assets(self):
        route = "/api/idle-sound/yawn-male"
        with patch("verona.server.read_yawn", return_value=b"fixture-wave") as read:
            headers = dict(self.headers, **{"X-Verona-Token": "wrong"})
            self.assertEqual(self.request("GET", route, headers=headers)[0], 403)
            read.assert_not_called()
            status, headers, body = self.request("GET", route)
            self.assertEqual((status, headers["Content-Type"], body), (200, "audio/wav", b"fixture-wave"))
            read.assert_called_once_with(route)
        with patch("verona.server.read_yawn", side_effect=RuntimeError("Prepare local effects first.")):
            status, _, body = self.request("GET", route)
            self.assertEqual(status, 503)
            self.assertIn(b"Prepare local effects", body)
        self.assertEqual(self.request("GET", "/api/idle-sound/anything.wav")[0], 404)

    def test_local_branding_and_blink_module_keep_exact_route_guards(self):
        from verona.manager import ManagerHandler
        from verona.server import Handler

        head_assets = {}
        for handler in (Handler, ManagerHandler):
            self.server.RequestHandlerClass = handler
            for path, kind, signature in (
                ("/favicon.ico", "image/x-icon", b"\x00\x00\x01\x00"),
                ("/favicon-32.png", "image/png", b"\x89PNG\r\n\x1a\n"),
                ("/verona-logo.png", "image/png", b"\x89PNG\r\n\x1a\n"),
            ):
                status, headers, body = self.request("GET", path)
                self.assertEqual(status, 200)
                self.assertEqual(headers["Content-Type"], kind)
                self.assertTrue(body.startswith(signature))
                self.assertEqual(headers["Cross-Origin-Resource-Policy"], "same-origin")
                if handler is Handler:
                    head_assets[path] = body
                else:
                    self.assertEqual(body, head_assets[path])
                blocked = dict(self.headers, Origin="https://outside.invalid")
                self.assertEqual(self.request("GET", path, headers=blocked)[0], 403)
            self.assertEqual(self.request("GET", "/verona.ico")[0], 404)
        self.server.RequestHandlerClass = Handler
        status, headers, body = self.request("GET", "/blinking.mjs")
        self.assertEqual(status, 200)
        self.assertIn("javascript", headers["Content-Type"])
        self.assertIn(b"export function attachBlinking", body)

    def test_single_generation_slot_fails_busy_without_queue(self):
        self.state.busy.acquire()
        try:
            status, _, body = self.request("POST", "/api/generate", self.payload())
            self.assertEqual(status, 409)
            self.assertIn(b"already generating", body)
        finally:
            self.state.busy.release()

    def test_successful_clip_is_fetchable_only_by_current_identifier(self):
        pcm = bytes(1600)
        sample = Speech(package_pcm(pcm), pcm, "fixture")
        with patch("verona.server.synthesize", return_value=sample):
            status, _, body = self.request("POST", "/api/generate", self.payload())
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["id"], "fixture-clip")
        for resource, expected in (("audio", sample.wav), ("motion", b"fixture-motion")):
            status, _, body = self.request("GET", f"/api/clip/fixture-clip/{resource}")
            self.assertEqual(status, 200)
            self.assertEqual(body, expected)
        self.state.clip = None
        status, _, _ = self.request("GET", "/api/clip/fixture-clip/audio")
        self.assertEqual(status, 404)

    def test_preview_and_latest_clip_caches_are_bounded_and_settings_sensitive(self):
        pcm = bytes(1600)
        sample = Speech(package_pcm(pcm), pcm, "fixture")
        with (patch("verona.server.synthesize", return_value=sample) as synth,
              patch.object(self.state.engine, "generate", wraps=self.state.engine.generate) as generate):
            status, headers, body = self.request("POST", "/api/preview", self.payload())
            self.assertEqual((status, headers["Content-Type"], body), (200, "audio/wav", sample.wav))
            self.assertIsNone(self.state.clip)
            generate.assert_not_called()
            status, _, first = self.request("POST", "/api/generate", self.payload())
            self.assertEqual(status, 200)
            self.assertTrue(json.loads(first)["speechCacheHit"])
            _, _, repeated = self.request("POST", "/api/generate", self.payload())
            self.assertTrue(json.loads(repeated)["cacheHit"])
            self.assertEqual(generate.call_count, 1)
            self.assertEqual(synth.call_count, 1)
            self.request("POST", "/api/generate", self.payload(expression="happy"))
            self.assertEqual(generate.call_count, 2)
            self.assertEqual(synth.call_count, 1)
            self.request("POST", "/api/generate", self.payload(voiceSettings={"pitch": 2}))
            self.assertEqual(synth.call_count, 2)
            self.request("POST", "/api/generate", self.payload())
            self.assertEqual(synth.call_count, 3)
            self.assertEqual(generate.call_count, 4)

    def test_engine_failure_is_an_error_and_generation_slot_recovers(self):
        with patch("verona.server.synthesize", side_effect=RuntimeError("fixture failure")):
            status, _, body = self.request("POST", "/api/generate", self.payload())
        self.assertEqual(status, 503)
        self.assertIn(b"failed", body)
        self.assertFalse(self.state.busy.locked())
        self.assertIsNone(self.state.clip)

    def test_gain_switch_reuses_speech_but_not_wrong_gain_motion(self):
        pcm = bytes(1600)
        sample = Speech(package_pcm(pcm), pcm, "fixture")
        with (patch("verona.server.synthesize", return_value=sample) as synth,
              patch.object(self.state.engine, "generate", wraps=self.state.engine.generate) as generate):
            for gain, calls, hit in ((2, 1, False), (4, 2, False), (4, 2, True), (2, 3, False)):
                status, _, body = self.request("POST", "/api/generate", self.payload(expressionGain=gain))
                self.assertEqual(status, 200)
                result = json.loads(body)
                self.assertEqual(result["expressionGainSetting"], gain)
                self.assertEqual(result["cacheHit"], hit)
                self.assertEqual(generate.call_count, calls)
                self.assertEqual(synth.call_count, 1)
            self.assertEqual(generate.call_args.kwargs["expression_gain"], 2)


if __name__ == "__main__":
    unittest.main()

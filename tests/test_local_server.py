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

    def generate(self, speech, expression, intensity, stop):
        return Clip("fixture-clip", speech.wav, b"fixture-motion", {"id": "fixture-clip"})


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

    def test_oversized_bad_fields_voice_and_nonfinite_expression_fail(self):
        status, _, _ = self.request("POST", "/api/generate", "x" * 8193)
        self.assertEqual(status, 413)
        for payload in (
            self.payload(text=""),
            self.payload(text="x" * 281),
            self.payload(voice="not-installed"),
            self.payload(intensity=float("nan")),
            self.payload(intensity=True),
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


if __name__ == "__main__":
    unittest.main()

import io
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
import wave

from verona import speech
from verona.engine import FaceEngine, expression_condition, pack_positions
from verona.mesh import read_mesh, reduced_mesh

import numpy as np


SCENE = """
createNode mesh -n "c_headWatertight_hiShape" -p "head";
setAttr ".vt[0:5]" 0 0 0 1 0 0 1 1 0 0 1 0 2 0 0 2 1 0;
setAttr ".ed[0:6]" 0 1 0 1 2 0 2 3 0 3 0 0 1 4 0 4 5 0 5 2 0;
setAttr ".fc[0:0]" -type "polyFaces" f 4 0 1 2 3;
setAttr ".fc[1:1]" f 4 4 5 6 -2;
createNode transform -n "unrelated";
"""


class MeshTests(unittest.TestCase):
    def test_reads_all_face_chunks_and_reversed_native_edge(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.ma"
            path.write_text(SCENE, encoding="utf-8")
            vertices, edges, triangles = read_mesh(path)
        self.assertEqual(vertices.shape, (6, 3))
        self.assertEqual(edges.shape, (7, 2))
        np.testing.assert_array_equal(
            triangles, [[0, 1, 2], [0, 2, 3], [1, 4, 5], [1, 5, 2]]
        )

    def test_rejects_noncontiguous_face_chunks(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.ma"
            path.write_text(SCENE.replace(".fc[1:1]", ".fc[2:2]"), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Noncontiguous"):
                read_mesh(path)

    def test_spatially_touching_disconnected_lips_are_not_joined(self):
        points = np.array([[0, 152, 5], [.01, 152, 5],
                           [0, 152.005, 5], [.01, 152.005, 5]], dtype=np.float32)
        selected, edges, _ = reduced_mesh(
            points, np.array([[0, 1], [2, 3]]), np.empty((0, 3), dtype=np.int32)
        )
        self.assertEqual(len(selected), 2)
        self.assertEqual(len(edges), 0)
        self.assertEqual(len(set(selected // 2)), 2)

    def test_quantization_preserves_signed_positions_and_rejects_overflow(self):
        vertices = np.array([[0.5, -0.5, 1.0]], dtype=np.float32)
        raw = pack_positions(vertices, np.zeros(3), 1.0)
        np.testing.assert_array_equal(np.frombuffer(raw, dtype="<i2"), [4096, -4096, 8192])
        for invalid in (np.array([[10, 0, 0]]), np.array([[np.nan, 0, 0]])):
            with self.assertRaises(ValueError):
                pack_positions(invalid, np.zeros(3), 1.0)


class SpeechTests(unittest.TestCase):
    def test_text_validation_rejects_empty_oversized_and_invalid_unicode(self):
        for value in (None, "", "  ", "x" * 281, "\0hello", "\ud800"):
            with self.assertRaises(ValueError):
                speech.validate_text(value)
        self.assertEqual(speech.validate_text("  Hey!\nHow are you?  "), "Hey!\nHow are you?")

    def test_user_text_is_json_data_not_powershell_code_or_environment(self):
        text = "'; Write-Output HACKED; # <speak>hello</speak>"
        response = type("Completed", (), {"returncode": 0, "stdout": '{"ok":true}', "stderr": ""})()
        with (
            patch.object(Path, "is_file", return_value=True),
            patch.dict("os.environ", {"GH_TOKEN": "fixture-only-not-a-real-credential"}),
            patch.object(speech.subprocess, "run", return_value=response) as run,
        ):
            speech.speech_command({"text": text})
        args, kwargs = run.call_args
        self.assertEqual(args[0][-1], speech.SCRIPT)
        self.assertNotIn(text, args[0])
        self.assertEqual(json.loads(kwargs["input"])["text"], text)
        self.assertNotIn("GH_TOKEN", kwargs["env"])
        self.assertFalse(kwargs.get("shell", False))

    def test_synthesis_preserves_audio_time_and_adds_explicit_silence(self):
        raw = np.array([1000, -1000] * 800, dtype="<i2").tobytes()

        def fake_speech(request):
            Path(request["output"]).write_bytes(speech.package_pcm(raw))
            return {"ok": True}

        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(speech, "ROOT", Path(directory)),
            patch.object(speech, "speech_command", side_effect=fake_speech),
        ):
            result = speech.synthesize("hello", "fixture", [{"name": "fixture"}])
            self.assertEqual(list((Path(directory) / ".local" / "work").iterdir()), [])
        start = speech.LEAD_SAMPLES * 2
        self.assertEqual(result.pcm[start:start + len(raw)], raw)
        self.assertEqual(result.pcm[:start], bytes(start))
        self.assertEqual(result.pcm[-speech.TAIL_SAMPLES * 2:], bytes(speech.TAIL_SAMPLES * 2))
        with wave.open(io.BytesIO(result.wav)) as wav:
            self.assertEqual(wav.getframerate(), 16000)
            self.assertEqual(wav.readframes(wav.getnframes()), result.pcm)

    def test_unknown_voice_is_not_silently_substituted(self):
        with patch.object(speech, "speech_command") as run:
            with self.assertRaisesRegex(ValueError, "installed"):
                speech.synthesize("hello", "missing", [{"name": "fixture"}])
        run.assert_not_called()


class ClipTests(unittest.TestCase):
    def test_expression_uses_separate_model_channel_and_preserves_neutral(self):
        neutral = np.zeros((1, 1, 26), dtype=np.float32)
        result = expression_condition(neutral, "happy", .35)
        self.assertAlmostEqual(float(result[0, 0, 22]), .35, places=6)
        self.assertEqual(np.count_nonzero(result), 1)
        self.assertEqual(np.count_nonzero(neutral), 0)
        for intensity in (True, "0.3", float("nan"), -.1, .61):
            with self.assertRaises(ValueError):
                expression_condition(neutral, "happy", intensity)

    def test_complete_clip_keeps_rational_audio_frame_count_and_cancels(self):
        class Session:
            calls = 0

            def run(self, names, inputs):
                self.calls += 1
                result = np.zeros((1, 1, 301), dtype=np.float32)
                result[0, 0, 0] = self.calls * .01
                return [result]

            def get_providers(self):
                return ["CPUExecutionProvider"]

        engine = FaceEngine.__new__(FaceEngine)
        engine.selected = np.arange(3)
        engine.neutral = np.zeros((3, 3), dtype=np.float32)
        engine.basis = np.zeros((272, 3, 3), dtype=np.float32)
        engine.basis[0, :, 0] = 1
        engine.center, engine.scale = np.zeros(3), 1
        engine.condition = np.zeros((1, 1, 26), dtype=np.float32)
        engine.session = Session()
        pcm = bytes(534 * 2)
        audio = speech.Speech(speech.package_pcm(pcm), pcm, "fixture")
        clip = engine.generate(audio)
        self.assertEqual(clip.metadata["frames"], 2)
        self.assertEqual(len(clip.motion), 2 * 3 * 3 * 2)
        self.assertEqual(clip.audio, audio.wav)
        self.assertGreater(clip.metadata["maximumSkinChangeCm"], 0)
        stop = threading.Event()
        stop.set()
        with self.assertRaisesRegex(RuntimeError, "stopped"):
            engine.generate(audio, stop=stop)


if __name__ == "__main__":
    unittest.main()

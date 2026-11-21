import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

from verona.local_voices import (
    ASSETS, choose_session_voice, local_voice_catalog, validate_voice_settings,
    verify_assets, voice_metadata, voice_pack_status,
)
from verona.speech import VoiceSettings


class LocalVoiceTests(unittest.TestCase):
    def test_worker_stops_at_oversized_input_without_consuming_another_request(self):
        result = subprocess.run([sys.executable, "-m", "verona.local_voice_worker"],
                                input="x" * 8193 + '\n{"action":"voices"}\n',
                                capture_output=True, text=True, timeout=10, check=True)
        lines = result.stdout.splitlines()
        self.assertEqual(len(lines), 1)
        self.assertIn("input limit", json.loads(lines[0])["error"])

    def test_metadata_does_not_import_neural_or_phonemizer_stack(self):
        subprocess.run([sys.executable, "-c",
                        "import sys; from verona.local_voices import voice_pack_status;"
                        "voice_pack_status();"
                        "assert not {'numpy','onnxruntime','kokoro_onnx','phonemizer','soxr'} & sys.modules.keys()"],
                       check=True, timeout=10)

    def test_unavailable_optional_assets_are_reported_and_not_advertised(self):
        with tempfile.TemporaryDirectory() as directory, patch(
                "verona.local_voices.MODEL_ROOT", Path(directory)):
            status = voice_pack_status()
            self.assertFalse(status["ready"])
            self.assertEqual(set(status["missingAssets"]), set(ASSETS))
            self.assertIn("explicit setup", status["message"])
            self.assertEqual(local_voice_catalog(), [])
            with self.assertRaisesRegex(RuntimeError, "missing or incomplete"):
                verify_assets()

    def test_equal_size_corruption_is_rejected_before_loading(self):
        with tempfile.TemporaryDirectory() as directory, patch(
                "verona.local_voices.MODEL_ROOT", Path(directory)), patch(
                "verona.local_voices.ASSETS", {"model.onnx": (3, "0" * 64)}):
            (Path(directory) / "model.onnx").write_bytes(b"bad")
            with self.assertRaisesRegex(RuntimeError, "SHA-256"):
                verify_assets()

    def test_auto_defaults_skip_used_voices_and_never_silently_duplicate(self):
        voices = [{"name": "Microsoft Hazel Desktop"}, *voice_metadata()]
        used = {"Microsoft Hazel Desktop"}
        first = choose_session_voice(voices, used)
        second = choose_session_voice(voices, used | {first})
        self.assertNotEqual(first, second)
        self.assertTrue(first.startswith("Kokoro "))
        self.assertEqual(choose_session_voice(voices, set(), "Microsoft Hazel Desktop"),
                         "Microsoft Hazel Desktop")
        for requested in (first, "absent", False):
            with self.assertRaises(ValueError):
                choose_session_voice(voices, used | {first}, requested)
        with self.assertRaisesRegex(ValueError, "All installed voices"):
            choose_session_voice(voices, {v["name"] for v in voices})

    def test_unsupported_local_controls_fail_without_affecting_windows_settings(self):
        for settings in (VoiceSettings(pitch=1), VoiceSettings(emphasis="strong")):
            with self.assertRaisesRegex(ValueError, "not pitch/emphasis"):
                validate_voice_settings("Kokoro Heart", settings)
            validate_voice_settings("Microsoft Hazel Desktop", settings)
        validate_voice_settings("Kokoro Heart", VoiceSettings(rate=2, bass=1, treble=-1))

    def test_windows_path_closes_previously_selected_local_worker(self):
        from verona.agent_speech import SpeechWorker
        worker = SpeechWorker.__new__(SpeechWorker)
        worker.local = False
        worker.local_worker = Mock()
        child = worker.local_worker
        worker.voices = [{"name": "Windows", "culture": "en-US"}]
        worker._call = Mock(return_value={"pcm": "AAA="})
        result = worker.synthesize("test", "Windows", worker.voices, VoiceSettings())
        child.close.assert_called_once()
        self.assertIsNone(worker.local_worker)
        self.assertEqual(result.voice, "Windows")
        self.assertNotIn("text", worker._call.call_args.args[0])

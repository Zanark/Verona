import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import wave

from verona import idle_audio


class IdleAudioTests(unittest.TestCase):
    def test_exact_prepared_effect_and_reject_invalid_or_missing_audio(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(idle_audio, "DIRECTORY", Path(directory)):
                for style in ("male", "female"):
                    route = f"/api/idle-sound/yawn-{style}"
                    with self.assertRaisesRegex(RuntimeError, "missing"):
                        idle_audio.read_yawn(route)
                    output = io.BytesIO()
                    with wave.open(output, "wb") as stream:
                        stream.setparams((1, 2, 24000, 0, "NONE", "NONE"))
                        stream.writeframes(b"\0\0"*2400)
                    target = Path(directory) / f"yawn-{style}.wav"
                    target.write_bytes(output.getvalue())
                    self.assertEqual(idle_audio.read_yawn(route), output.getvalue())
                    target.write_bytes(b"not audio")
                    with self.assertRaisesRegex(RuntimeError, "invalid"):
                        idle_audio.read_yawn(route)
                    target.write_bytes(b"\0"*202001)
                    with self.assertRaisesRegex(RuntimeError, "bounded"):
                        idle_audio.read_yawn(route)
                with self.assertRaises(KeyError):
                    idle_audio.read_yawn("/api/idle-sound/../anything")

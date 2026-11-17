from pathlib import Path
import tempfile
import unittest
import wave

import numpy as np

from scripts.probe_cpu import audio_window, conditioning, read_audio, reconstruct


class CpuProbeTests(unittest.TestCase):
    def test_initial_window_preserves_original_zero_and_zero_pads_lookbehind(self):
        samples = np.ones(16000, dtype=np.float32)
        result = audio_window(samples, 0).ravel()
        np.testing.assert_array_equal(result[:4160], 0)
        np.testing.assert_allclose(result[4160:], 1.3)

    def test_fractional_frame_stride_does_not_accumulate_sample_drift(self):
        samples = np.arange(40000, dtype=np.float32)
        result = audio_window(samples, 31).ravel()
        self.assertAlmostEqual(float(result[4160]), (31 * 16000 // 30) * 1.3, places=2)

    def test_short_final_window_pads_without_repeating_audio(self):
        samples = np.ones(160, dtype=np.float32)
        result = audio_window(samples, 0).ravel()
        np.testing.assert_allclose(result[4160:4320], 1.3)
        np.testing.assert_array_equal(result[4320:], 0)

    def test_conditioning_uses_shot_start_plus_source_frame(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "emotion.npz"
            np.savez(
                path,
                emo_spec_names=np.array([b"g2a_neutral"]),
                emo_spec_start=np.array([7]),
                emo_spec_size=np.array([34]),
                emo_db=np.repeat(np.arange(50)[:, None], 16, axis=1),
            )
            result = conditioning(path)
        np.testing.assert_array_equal(result[0, 0, :16], 40)
        np.testing.assert_array_equal(result[0, 0, 16:], 0)

    def test_pca_applies_offsets_to_neutral_not_absolute_shape_blending(self):
        neutral = np.ones((2, 3), dtype=np.float32)
        basis = np.array([np.ones((2, 3)), np.full((2, 3), 2)], dtype=np.float32)
        result = reconstruct(np.array([2, -1], dtype=np.float32), basis, neutral)
        np.testing.assert_array_equal(result, neutral)
        with self.assertRaisesRegex(ValueError, "do not match"):
            reconstruct(np.array([1], dtype=np.float32), basis, neutral)

    def test_unsupported_stereo_is_rejected_not_silently_downmixed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "stereo.wav"
            with wave.open(str(path), "wb") as audio:
                audio.setnchannels(2)
                audio.setsampwidth(2)
                audio.setframerate(16000)
                audio.writeframes(b"\0" * 640)
            with self.assertRaisesRegex(ValueError, "mono 16 kHz"):
                read_audio(path)


if __name__ == "__main__":
    unittest.main()

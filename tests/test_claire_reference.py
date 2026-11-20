"""Focused geometry-fit tests using a synthetic head, not perceptual evidence."""

import hashlib
import json
from pathlib import Path
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import numpy as np

from scripts.claire_reference_study import EYES, apply_reference, fit_reference, reference_warp
from verona.engine import Clip, QUANTIZATION, pack_positions


class ClaireReferenceTests(unittest.TestCase):
    @staticmethod
    def head():
        y, angle = np.meshgrid(np.linspace(134, 159, 101), np.linspace(-1.5, 1.5, 81))
        width = 6 * np.sqrt(np.maximum(.04, 1 - ((y - 147) / 14) ** 2))
        return np.column_stack((.0768 + (width * np.sin(angle)).ravel(), y.ravel(),
                                (1 + 4 * np.cos(angle)).ravel()))

    def test_reference_changes_shell_without_changing_lip_lid_core_or_inputs(self):
        rest = self.head()
        probes = np.array([[0, 140, 4], [0, 140.3, 4], [-3, 147.5, 4],
                           [3, 147.5, 4], [0, 129, -5]])
        source = np.vstack((rest, probes))
        before = source.copy()
        target = rest * [1.04, 1, 1]
        mapped, receipt = fit_reference(source, target, EYES)
        np.testing.assert_array_equal(source, before)
        np.testing.assert_array_equal(mapped[-3:], source[-3:].astype(np.float32))
        np.testing.assert_allclose(mapped[-5:-3] - source[-5:-3],
                                   [receipt["mouthCoreTranslationCm"]] * 2, atol=1e-5)
        self.assertGreater(receipt["maximumRestOffsetCm"], .5)
        self.assertEqual(mapped.shape, source.shape)

    def test_missing_or_invalid_anatomical_data_fails_explicitly(self):
        head = self.head()
        for reference, eyes in ((np.full((10, 3), np.nan), EYES),
                                (head, np.zeros((2, 3))), (np.zeros((2, 3)), EYES)):
            with self.subTest(reference=reference.shape), self.assertRaises(ValueError):
                fit_reference(head, reference, eyes)

    def test_complete_pose_mapping_preserves_coincidence_without_rest_only_offsets(self):
        head = self.head()
        warp, _ = reference_warp(head, head * [1.04, 1, 1], EYES)
        pose = np.array([[4, 144, 4], [4, 144, 4], [0, 140, 4], [0, 140.3, 4]])
        moved = pose + [0, -.2, 0]
        mapped, animated = warp(pose), warp(moved)
        np.testing.assert_array_equal(mapped[0], mapped[1])
        np.testing.assert_array_equal(animated[0], animated[1])
        np.testing.assert_allclose((animated - mapped)[2:], [[0, -.2, 0]] * 2, atol=1e-5)
        self.assertFalse(np.allclose((animated - mapped)[0], [0, -.2, 0]))

    def test_adapter_maps_every_pose_preserves_neural_source_and_observes_cancellation(self):
        rest = self.head().astype(np.float32)
        center, scale = np.array([0, 145, 0]), 30.
        motion = pack_positions(np.stack((rest, rest + [0, -.2, 0])), center, scale)
        calls = []

        def generate(speech, expression, intensity, stop, *, expression_gain):
            calls.append(expression_gain)
            return Clip("fixture", b"fixture audio", motion, {"generationSeconds": 0.})

        engine = SimpleNamespace(neutral=rest, selected=np.arange(len(rest)),
                                 center=center, scale=scale, basis=object(), generate=generate,
                                 mesh_bytes=pack_positions(rest, center, scale) + b"topology/eyes",
                                 mesh_metadata={})
        original_basis = engine.basis
        reference = {"rest": rest.ravel().tolist(), "eyeCenters": EYES.tolist()}
        raw = json.dumps(reference).encode()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "reference.json"
            path.write_bytes(raw)
            with patch("scripts.claire_reference_study.REFERENCE_SHA256",
                       hashlib.sha256(raw).hexdigest()):
                apply_reference(engine, path)
                result = engine.generate(None, "happy", .6, None, expression_gain=4)
                warp, _ = reference_warp(rest, rest, EYES)
                decoded = np.frombuffer(motion, dtype="<i2").reshape(-1, 3)
                expected = pack_positions(warp(decoded / QUANTIZATION * scale + center),
                                          center, scale)
                self.assertEqual(result.motion, expected)
                self.assertEqual(result.audio, b"fixture audio")
                self.assertIs(engine.basis, original_basis)
                self.assertIs(engine.neutral, rest)
                self.assertTrue(engine.mesh_bytes.endswith(b"topology/eyes"))
                self.assertEqual(calls, [4])
                stop = threading.Event()
                stop.set()
                with self.assertRaisesRegex(RuntimeError, "generation stopped"):
                    engine.generate(None, "happy", .6, stop, expression_gain=4)
                path.write_bytes(raw + b" ")
                with self.assertRaisesRegex(ValueError, "reference changed"):
                    apply_reference(engine, path)

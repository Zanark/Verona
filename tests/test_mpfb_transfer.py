import unittest
import threading

import numpy as np

from scripts.claire_surface_fit import closest_surface
from scripts.mpfb_motion_transfer import bind_motion, native_rig_fit, surface_binding


class NativeMotionTransferTests(unittest.TestCase):
    def test_exact_native_rest_and_translated_motion_are_preserved(self):
        source = np.array([[0., 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]])
        target = np.array([[.2, .3, .1], [.8, .7, .2]])
        transfer, receipt = bind_motion(source, np.array([[0, 1, 2], [1, 3, 2]]), target)
        np.testing.assert_array_equal(transfer(source), target)
        np.testing.assert_allclose(transfer(source + [.1, -.2, .3]), target + [.1, -.2, .3])
        self.assertEqual(receipt["targetVertices"], 2)
        with self.assertRaisesRegex(ValueError, "correspondence"):
            transfer(source[:3])

    def test_accelerated_binding_matches_exhaustive_triangle_projection(self):
        rng = np.random.default_rng(42)
        vertices = rng.normal(size=(120, 3))
        faces = np.arange(120).reshape(-1, 3)
        targets = rng.normal(size=(12, 3))
        indices, weights, distance = surface_binding(vertices, faces, targets)
        actual = np.sum(vertices[indices] * weights[..., None], axis=1)
        expected = closest_surface(targets, vertices, faces)
        np.testing.assert_allclose(actual, expected, atol=1e-10)
        np.testing.assert_allclose(np.linalg.norm(actual - targets, axis=1), distance, atol=1e-10)
        self.assertTrue(np.all(weights >= 0))

    def test_binding_fails_for_unbounded_attachment_and_degenerate_surface(self):
        source = np.array([[0., 0, 0], [1, 0, 0], [0, 1, 0]])
        faces = np.array([[0, 1, 2]])
        with self.assertRaisesRegex(ValueError, "three-centimeter"):
            bind_motion(source, faces, source + [0, 0, 4])
        with self.assertRaisesRegex(ValueError, "nondegenerate"):
            surface_binding(np.zeros((3, 3)), faces, source)

    def test_native_rig_fits_motion_without_recipes_and_preserves_rest(self):
        rest = np.zeros((3, 3))
        delta = np.zeros((3, 3))
        delta[0, 0] = 1
        fit = native_rig_fit({"rest": rest.ravel(), "basis": {
            "nativeControl": delta.ravel(), "inactive": rest.ravel()}})
        result, receipt = fit(np.array([rest, rest + delta * .5, rest + delta * 2]))
        np.testing.assert_array_equal(result[0], rest)
        np.testing.assert_allclose(result[1], rest + delta * .5, atol=.003)
        np.testing.assert_array_equal(result[2], rest + delta)
        self.assertEqual(receipt["boundedWeightSamples"], 1)
        self.assertEqual(receipt["activeNativeControls"], 1)
        stop = threading.Event()
        stop.set()
        with self.assertRaisesRegex(RuntimeError, "stopped"):
            fit(np.array([rest]), stop)

    def test_fixed_neck_support_remains_fixed_and_rejects_bad_weights(self):
        source = np.array([[0., 0, 0], [1, 0, 0], [0, 1, 0]])
        faces = np.array([[0, 1, 2]])
        target = np.array([[.2, .2, .1], [0, 0, 10.]])
        transfer, receipt = bind_motion(source, faces, target, influence=[1, 0])
        result = transfer(source + [.1, .2, .3])
        np.testing.assert_array_equal(result[1], target[1])
        np.testing.assert_allclose(result[0], target[0] + [.1, .2, .3])
        self.assertEqual(receipt["fixedTargetVertices"], 1)
        with self.assertRaisesRegex(ValueError, "influence"):
            bind_motion(source, faces, target, influence=[1, -1])

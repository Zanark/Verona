import unittest

import numpy as np

from scripts.glb_head_study import attach, batch_surface_binding, registration_surface
from scripts.mpfb_motion_transfer import surface_binding


class StudyBindingTests(unittest.TestCase):
    def test_exact_batched_attachment_matches_existing_scalar_solver(self):
        rng = np.random.default_rng(82)
        points = rng.uniform(-2, 2, (90, 3))
        faces = np.arange(90).reshape(-1, 3)
        queries = rng.uniform(-3, 3, (49, 3))
        ia, wa, da = batch_surface_binding(points, faces, queries)
        ib, wb, db = surface_binding(points, faces, queries)
        np.testing.assert_allclose(da, db, atol=1e-10)
        np.testing.assert_allclose((points[ia] * wa[..., None]).sum(1),
                                   (points[ib] * wb[..., None]).sum(1), atol=1e-10)

    def test_rest_preserved_and_complete_pose_translation_transferred(self):
        source = np.array([[-1., 139, 0], [1, 139, 0], [0, 141, 0]])
        native = np.array([[0., 139.5, .2], [0, 134, .1]])
        transfer, _ = attach(source, np.array([[0, 1, 2]]), native, lambda p: p)
        np.testing.assert_allclose(transfer(source), native)
        result = transfer(source + [.1, .2, .3])
        np.testing.assert_allclose(result[0], native[0] + [.1, .2, .3])
        np.testing.assert_array_equal(result[1], native[1])
        with self.assertRaises(ValueError):
            transfer(source[:-1])

    def test_singular_and_unregistered_surfaces_fail(self):
        with self.assertRaises(ValueError):
            batch_surface_binding(np.zeros((3, 3)), np.array([[0, 1, 2]]), np.ones((1, 3)))
        source = np.array([[-1., 139, 0], [1, 139, 0], [0, 141, 0]])
        with self.assertRaises(ValueError):
            attach(source, np.array([[0, 1, 2]]), np.array([[20., 139, 0]]), lambda p: p)

    def test_diagonal_open_neck_is_extended_for_fitting_only(self):
        points = np.array([[-1., 134, -1], [1, 134, -1], [1, 138, 1], [-1, 138, 1],
                           [-1, 152, -1], [1, 152, -1], [1, 152, 1], [-1, 152, 1]])
        faces = np.array([(i, (i+1) % 4, i+4) for i in range(4)]
                         + [((i+1) % 4, (i+1) % 4+4, i+4) for i in range(4)])
        original, original_faces = points.copy(), faces.copy()
        derived, triangles, receipt = registration_surface(points, faces, 144.)
        self.assertEqual(receipt["neckSkirts"], 1)
        self.assertEqual(len(derived), 12)
        self.assertEqual(len(triangles), 16)
        np.testing.assert_array_equal(points, original)
        np.testing.assert_array_equal(faces, original_faces)

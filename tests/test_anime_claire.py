import unittest

import numpy as np

from scripts.anime_claire import anime_hair, anime_warp, blink_skin, eye_optics
from scripts.claire_reference_study import EYES


class AnimeClaireTests(unittest.TestCase):
    def test_coordinated_face_change_retains_neck_and_contact(self):
        samples = np.array([[4., 137.8, 3.], [-3.84, 137.8, 3.],
                            [.08, 143.6, 5.], [3., 131., -2.],
                            [.08, 140.2, 4.1], [.08, 140.2, 4.1]])
        result = anime_warp(samples)
        self.assertLess(result[0, 0], samples[0, 0]-.6)
        self.assertAlmostEqual(result[0, 0]-.08, -(result[1, 0]-.08), places=5)
        self.assertGreater(result[0, 1], samples[0, 1]+.8)
        self.assertLess(result[2, 2], samples[2, 2]-.8)
        np.testing.assert_array_equal(result[3], samples[3])
        np.testing.assert_array_equal(result[4], result[5])
        source = EYES[0]+[[0, .55, 1.4], [0, -.55, 1.4]]
        enlarged = anime_warp(source)
        self.assertGreater(np.ptp(enlarged[:, 1]), np.ptp(source[:, 1])*1.4)

    def test_blink_closes_front_lids_not_neck_or_back(self):
        source = np.vstack((EYES[0]+[0, .5, 1.4], EYES[0]+[0, -.5, 1.4],
                            [0, 130, 0], EYES[0]+[0, .5, -1.4]))
        np.testing.assert_array_equal(blink_skin(source, source, 0), source)
        closed = blink_skin(source, source, 1)
        self.assertLess(np.ptp(closed[:2, 1]), np.ptp(source[:2, 1])*.05)
        np.testing.assert_array_equal(closed[2:], source[2:])
        for invalid in (-.1, 1.1, np.nan):
            with self.assertRaises(ValueError):
                blink_skin(source, source, invalid)

    def test_orbital_transition_does_not_fold_the_complete_pose_map(self):
        samples = np.stack(np.meshgrid(np.linspace(-6, 6, 25), np.linspace(135, 154, 39),
                                       [0., 2.5, 5.]), axis=-1).reshape(-1, 3)
        columns = []
        for axis in range(3):
            step = np.eye(3)[axis]*1e-4
            columns.append((anime_warp(samples+step)-anime_warp(samples-step))/2e-4)
        self.assertGreater(np.linalg.det(np.stack(columns, axis=-1)).min(), .1)

    def test_original_hair_and_optics_have_finite_nondegenerate_faces(self):
        skull = np.array([[0, 159, -5.7], [8, 150, -5.7], [-8, 150, -5.7]])
        hair, hair_faces, shades = anime_hair(skull)
        eyes, eye_faces, colors = eye_optics()
        for points, faces in ((hair, hair_faces), (eyes, eye_faces)):
            self.assertTrue(np.isfinite(points).all())
            self.assertLess(faces.max(), len(points))
            tri = points[faces]
            areas = np.linalg.norm(np.cross(tri[:, 1]-tri[:, 0], tri[:, 2]-tri[:, 0]), axis=1)
            self.assertGreater(areas.min(), 1e-10)
        self.assertEqual(len(shades), len(hair))
        self.assertEqual(colors.shape, (len(eyes), 4))
        self.assertTrue(np.all(colors[:, 3] == 1))
        self.assertGreater(np.ptp(colors[:, 1]), .8)


if __name__ == "__main__":
    unittest.main()

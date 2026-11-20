import unittest

import numpy as np

from scripts.claire_cheekiness_study import sideways_lip_pull


class CheekinessStudyTests(unittest.TestCase):
    def setUp(self):
        self.rest = np.array([
            [-2.4, 140.0, 5.0], [2.4, 140.0, 5.0],
            [2.4, 140.2, 5.0], [0.0, 149.0, 4.0],
            [0.0, 140.0, -4.0], [7.0, 140.0, 4.0],
        ])

    def test_asymmetric_corner_pull_keeps_upper_face_and_back_unchanged(self):
        delta = sideways_lip_pull(self.rest, self.rest) - self.rest
        self.assertGreater(delta[1, 0], delta[0, 0] + 1.2)
        self.assertGreater(delta[1, 1], .9)
        np.testing.assert_array_equal(delta[3:], np.zeros((3, 3)))
        np.testing.assert_array_equal(delta[:, 2], np.zeros(6))

    def test_both_lip_sheets_share_field_without_replacing_speech(self):
        speech = np.stack([self.rest, self.rest + np.array([.1, -.2, .3])])
        result = sideways_lip_pull(self.rest, speech)
        np.testing.assert_allclose(result[1] - result[0], speech[1] - speech[0], atol=1e-13)
        np.testing.assert_allclose(result[:, 1] - speech[:, 1],
                                   result[:, 2] - speech[:, 2], atol=1e-13)
        np.testing.assert_array_equal(sideways_lip_pull(self.rest, speech, 0), speech)

    def test_invalid_geometry_and_strength_fail_explicitly(self):
        for strength in (-.1, 1.1, float("nan"), True):
            with self.subTest(strength=strength), self.assertRaises(ValueError):
                sideways_lip_pull(self.rest, self.rest, strength)
        for positions in (self.rest[:-1], np.full_like(self.rest, np.nan),
                          np.zeros((2, 2)), self.rest.astype(complex)):
            with self.subTest(shape=positions.shape), self.assertRaises(ValueError):
                sideways_lip_pull(self.rest, positions)


if __name__ == "__main__":
    unittest.main()

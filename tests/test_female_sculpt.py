"""Focused tests for the offline study, not anatomy or owner acceptance."""

import unittest

import numpy as np

from scripts.female_sculpt_study import sculpt_positions


class FemaleSculptTests(unittest.TestCase):
    def test_complete_pose_mapping_preserves_coincident_points_and_upper_face(self):
        source = np.array([[2, 140.2, 5], [2, 140.2, 5], [3, 146, 3], [-3, 149, 3]],
                          dtype=np.float32)
        before = source.copy()
        result = sculpt_positions(np.stack((source, source + [0, -.2, 0])))
        np.testing.assert_array_equal(result[:, 0], result[:, 1])
        np.testing.assert_array_equal(result[0, 2:], source[2:])
        np.testing.assert_array_equal(source, before)
        self.assertFalse(np.array_equal(result[0, :2], source[:2]))
        self.assertFalse(np.array_equal(result[1] - result[0], np.full_like(source, [0, -.2, 0])))

    def test_mapping_is_symmetric_positive_width_and_monotonic_height(self):
        y = np.linspace(110, 165, 10001)
        points = np.column_stack((np.full_like(y, 4), y, np.full_like(y, 5)))
        result = sculpt_positions(points)
        mirror = sculpt_positions(points * [-1, 1, 1])
        np.testing.assert_array_equal(result * [-1, 1, 1], mirror)
        self.assertGreater(float(np.min(result[:, 0] / points[:, 0])), .75)
        self.assertTrue(np.all(np.diff(result[:, 1]) > 0))
        self.assertLess(float(result[np.argmin(abs(y - 138)), 0]), 3.5)

    def test_invalid_positions_fail_explicitly(self):
        for value in ([], np.empty((0, 3)), np.zeros((2, 2)), np.array([[1, 2, np.nan]]),
                      np.array([[1, 2, np.inf]]), np.ones((1, 3), dtype=complex),
                      np.array([[1e40, 140, 0]])):
            with self.subTest(value=repr(value)), self.assertRaises(ValueError):
                sculpt_positions(value)

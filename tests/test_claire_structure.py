"""Focused geometry registration tests, not evidence of human identity accuracy."""

import unittest

import numpy as np

from scripts.claire_reference_study import EYES
from scripts.claire_structural_fit import structural_warp
from scripts.claire_surface_fit import closest_surface, refine_surface


class StructuralFitTests(unittest.TestCase):
    @staticmethod
    def head():
        rows, columns = 60, 64
        latitude, angle = np.meshgrid(np.linspace(0, np.pi, rows + 1),
                                      np.arange(columns) * 2 * np.pi / columns, indexing="ij")
        points = np.column_stack((.0768 + 8 * (np.sin(latitude) * np.sin(angle)).ravel(),
                                  146 + 14 * np.cos(latitude).ravel(),
                                  -4 + 9 * (np.sin(latitude) * np.cos(angle)).ravel()))
        faces = []
        for row in range(rows):
            for column in range(columns):
                a, b = row * columns + column, row * columns + (column + 1) % columns
                c, d = a + columns, b + columns
                if row:
                    faces.append((a, c, b))
                if row < rows - 1:
                    faces.append((b, c, d))
        return points, np.array(faces)

    def test_triangle_correspondence_handles_face_edge_vertex_and_degenerate_face(self):
        vertices = np.array([[0., 0, 0], [2, 0, 0], [0, 2, 0]])
        points = np.array([[.5, .5, 1], [1, -1, 0], [3, 0, 1]])
        expected = np.array([[.5, .5, 0], [1, 0, 0], [2, 0, 0]])
        np.testing.assert_allclose(closest_surface(points, vertices, np.array([[0, 1, 2]])),
                                   expected, atol=1e-12)
        line = closest_surface(np.array([[1., 1, 0]]), vertices, np.array([[0, 1, 1]]))
        np.testing.assert_allclose(line, [[1, 0, 0]], atol=1e-12)
        surfaces = np.vstack((vertices, vertices + [0, 0, 5]))
        queries = np.tile([.2, .2, 4.8], (17, 1))
        nearest = closest_surface(queries, surfaces, np.array([[0, 1, 2], [3, 4, 5]]))
        np.testing.assert_allclose(nearest, np.tile([.2, .2, 5], (17, 1)), atol=1e-12)

    def test_surface_lattice_reduces_actual_residual_and_keeps_exact_eye_anchors(self):
        source, faces = self.head()
        target = source + [.25, 0, .1]
        warp, receipt = refine_surface(lambda points: points, source, target, faces)
        self.assertLess(receipt["surfaceConstraintRmsAfterCm"],
                        receipt["surfaceConstraintRmsBeforeCm"] * .5)
        self.assertGreater(np.linalg.norm(warp(source) - source, axis=1).max(), .05)
        np.testing.assert_allclose(warp(EYES), EYES, atol=1e-12)
        with self.assertRaisesRegex(ValueError, "lattice bounds"):
            warp(np.array([[0., 145, 16]]))

    def test_full_head_fit_moves_crown_and_contour_without_mutating_source_or_eye_centers(self):
        source, faces = self.head()
        original = source.copy()
        target = (source - EYES.mean(0)) * [.9, 1.04, .94] + EYES.mean(0)
        warp, receipt = structural_warp(source, faces, target, faces, EYES,
                                        np.array([[1.35, 1.32, 1.4]] * 2), 141.)
        fitted = warp(source)
        np.testing.assert_array_equal(source, original)
        np.testing.assert_allclose(warp(EYES), EYES, atol=1e-10)
        self.assertGreater(fitted[:, 1].max() - source[:, 1].max(), .4)
        self.assertLess(np.ptp(fitted[:, 0]), np.ptp(source[:, 0]) * .97)
        self.assertGreater(receipt["maximumRestOffsetCm"], .5)
        probes = np.array([[0, 130, -4], [0, 140, 4], [0, 140, 4]])
        mapped = warp(probes)
        np.testing.assert_array_equal(mapped[0], probes[0])
        np.testing.assert_array_equal(mapped[1], mapped[2])
        shifted = warp(probes[1:] + [0, -.2, 0])
        self.assertFalse(np.allclose(shifted - mapped[1:], [0, -.2, 0]))

    def test_structural_fit_rejects_invalid_topology_and_eye_dimensions(self):
        source, faces = self.head()
        for triangles, radii in ((np.array([[0, 1, len(source)]]), np.ones((2, 3))),
                                  (faces.astype(float), np.ones((2, 3))),
                                  (faces, np.zeros((2, 3)))):
            with self.subTest(topology=triangles.dtype, radii=radii.min()):
                with self.assertRaises(ValueError):
                    structural_warp(source, triangles, source, faces, EYES, radii, 141.)

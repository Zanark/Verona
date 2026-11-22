import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np

from scripts.glb_head_study import attach, batch_surface_binding, elara_eye_details, registration_surface
from scripts.mpfb_motion_transfer import surface_binding
from scripts.detail_elara_review import build


class StudyBindingTests(unittest.TestCase):
    def test_eye_detail_derivation_preserves_original_poses_faces_and_other_heads(self):
        skin = np.array([[-6., 146.1, 4], [6.2, 146.1, 4],
                         [6.2, 151.9, 4], [-6., 151.9, 4]], dtype="<f4")
        rest = np.vstack((skin, [[0, 147, 2]])).astype("<f4")
        faces = np.array([[0, 1, 2], [0, 2, 3]], dtype="<u4")
        with tempfile.TemporaryDirectory() as temporary:
            source, output = Path(temporary)/"source", Path(temporary)/"derived"
            source.mkdir()
            candidates = []
            for name in ("lyra", "elara", "mira", "selene", "neris", "thalia"):
                folder = source/name
                folder.mkdir()
                candidate = {"id": name, "method": "hybrid", "skinVertices": 4,
                             "vertices": 5, "triangles": 2, "maximumMotionCm": .4,
                             "frames": [{"file": "rest.bin"}, {"file": "speech.bin"}]}
                candidates.append(candidate)
                (folder/"candidate.json").write_text(json.dumps(candidate))
                rest.tofile(folder/"rest.bin")
                (rest+[0, 0, .3]).astype("<f4").tofile(folder/"speech.bin")
                faces.tofile(folder/"triangles.bin")
            (source/"study.json").write_text(json.dumps({"candidates": candidates}))
            with contextlib.redirect_stdout(io.StringIO()):
                build(source, output)
            for path in source.rglob("*"):
                if path.is_file() and path.parent.name != "elara" and path.name != "study.json":
                    self.assertEqual(path.read_bytes(), (output/path.relative_to(source)).read_bytes())
            for filename in ("rest.bin", "speech.bin", "triangles.bin"):
                self.assertTrue((output/"elara"/filename).read_bytes().startswith(
                    (source/"elara"/filename).read_bytes()))
            metadata = json.loads((output/"elara"/"candidate.json").read_text())
            self.assertEqual(metadata["vertices"], 5+metadata["eyeDetails"]["vertices"])
            self.assertEqual(metadata["triangles"], 2+metadata["eyeDetails"]["triangles"])

    def test_eye_details_are_symmetric_nondegenerate_and_follow_skin_motion(self):
        skin = np.array([[-6., 146.1, 4], [6.2, 146.1, 4],
                         [6.2, 151.9, 4], [-6., 151.9, 4]])
        faces = np.array([[0, 1, 2], [0, 2, 3]])
        original = skin.copy()
        details, triangles, animate, receipt = elara_eye_details(skin, faces)
        np.testing.assert_array_equal(skin, original)
        np.testing.assert_allclose(animate(skin), details)
        np.testing.assert_allclose(animate(skin + [.2, -.1, .3]), details + [.2, -.1, .3])
        left, right = np.split(details, 2)
        # Tube winding swaps lateral sides under reflection; compare point sets.
        reflected = left.copy()
        reflected[:, 0] = .16-reflected[:, 0]
        order = lambda p: p[np.lexsort(np.round(p, 8).T[::-1])]
        np.testing.assert_allclose(order(reflected), order(right), atol=1e-8)
        corners = details[triangles]
        areas = np.linalg.norm(np.cross(corners[:, 1]-corners[:, 0],
                                       corners[:, 2]-corners[:, 0]), axis=1)
        self.assertTrue(np.isfinite(details).all())
        self.assertGreater(areas.min(), 1e-8)
        self.assertLess(receipt["attachmentMaximumCm"], .85)
        self.assertLess(len(details), 2000)
        with self.assertRaises(ValueError):
            animate(skin[:-1])
        with self.assertRaises(ValueError):
            elara_eye_details(skin + [0, 0, -8], faces)

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

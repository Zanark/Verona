import json
from pathlib import Path
import struct
import tempfile
import unittest

import numpy as np

from scripts.glb_head_import import load_head


class GlbHeadTests(unittest.TestCase):
    def fixture(self):
        positions = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0]], dtype="<f4")
        indices = np.array([0, 1, 2], dtype="<u2")
        binary = positions.tobytes() + indices.tobytes()
        doc = {"asset": {"version": "2.0"}, "buffers": [{"byteLength": len(binary)}],
               "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": 36},
                               {"buffer": 0, "byteOffset": 36, "byteLength": 6}],
               "accessors": [{"bufferView": 0, "componentType": 5126, "type": "VEC3", "count": 3},
                             {"bufferView": 1, "componentType": 5123, "type": "SCALAR", "count": 3}],
               "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1}]}],
               "nodes": [{"translation": [2, 3, 4], "children": [1]},
                         {"mesh": 0, "scale": [-2, 2, 2]}],
               "scenes": [{"nodes": [0]}]}
        return doc, binary

    def write(self, folder, doc, binary):
        data = json.dumps(doc).encode()
        data += b" " * (-len(data) % 4)
        binary += b"\0" * (-len(binary) % 4)
        raw = (struct.pack("<4sII", b"glTF", 2, 28 + len(data) + len(binary))
               + struct.pack("<II", len(data), 0x4E4F534A) + data
               + struct.pack("<II", len(binary), 0x004E4942) + binary)
        path = Path(folder) / "fixture.glb"
        path.write_bytes(raw)
        return path

    def test_scene_transforms_reflection_and_default_material(self):
        doc, binary = self.fixture()
        with tempfile.TemporaryDirectory() as folder:
            path = self.write(folder, doc, binary)
            before = path.read_bytes()
            model = load_head(path)
            np.testing.assert_array_equal(model["positions"], [[2, 3, 4], [0, 3, 4], [2, 5, 4]])
            np.testing.assert_array_equal(model["faces"], [[0, 2, 1]])
            np.testing.assert_array_equal(model["colors"], np.ones((3, 3)))
            self.assertEqual(path.read_bytes(), before)

    def test_interleaved_attributes_and_column_major_matrix(self):
        doc, _ = self.fixture()
        binary = np.array([[0, 0, 0, 99], [1, 0, 0, 99], [0, 1, 0, 99]], dtype="<f4").tobytes()
        binary += np.array([0, 1, 2], dtype="<u2").tobytes()
        doc["buffers"][0]["byteLength"] = len(binary)
        doc["bufferViews"] = [{"buffer": 0, "byteLength": 48, "byteStride": 16},
                              {"buffer": 0, "byteOffset": 48, "byteLength": 6}]
        doc["nodes"][1] = {"mesh": 0, "matrix": [
            1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1]}
        with tempfile.TemporaryDirectory() as folder:
            model = load_head(self.write(folder, doc, binary))
            np.testing.assert_array_equal(model["positions"], [[7, 3, 4], [8, 3, 4], [7, 4, 4]])

    def test_rejects_external_truncated_cyclic_and_out_of_bounds_geometry(self):
        mutations = (
            lambda d: d["buffers"][0].update(uri="outside.bin"),
            lambda d: d["bufferViews"][0].update(byteLength=4),
            lambda d: d["nodes"][1].update(children=[0]),
            lambda d: d["nodes"][0].update(children=[-1]),
            lambda d: d["meshes"][0]["primitives"][0].update(mode=1),
            lambda d: d["accessors"][0].update(sparse={}),
            lambda d: d["accessors"][0].update(bufferView=-1),
            lambda d: d["nodes"][1].update(mesh=-1),
            lambda d: d.update(scene=-1),
            lambda d: d["nodes"][0].update(children=[1, 1]),
        )
        with tempfile.TemporaryDirectory() as folder:
            for mutate in mutations:
                doc, binary = self.fixture()
                mutate(doc)
                with self.assertRaises(ValueError):
                    load_head(self.write(folder, doc, binary))
            doc, binary = self.fixture()
            path = self.write(folder, doc, binary)
            path.write_bytes(path.read_bytes()[:-1])
            with self.assertRaises(ValueError):
                load_head(path)

    def test_normalized_vertex_colors_and_multiple_mesh_instances(self):
        doc, binary = self.fixture()
        binary += b"\0\0" + bytes([255, 128, 0, 255, 0, 255, 255, 255, 0, 0, 255, 255])
        doc["buffers"][0]["byteLength"] = len(binary)
        doc["bufferViews"].append({"buffer": 0, "byteOffset": 44, "byteLength": 12})
        doc["accessors"].append({"bufferView": 2, "componentType": 5121,
                                 "type": "VEC4", "count": 3, "normalized": True})
        primitive = doc["meshes"][0]["primitives"][0]
        primitive["attributes"]["COLOR_0"] = 2
        primitive["material"] = 0
        doc["materials"] = [{"pbrMetallicRoughness": {"baseColorFactor": [.5, 1, 1, 1]}}]
        doc["nodes"][0]["children"].append(2)
        doc["nodes"].append({"mesh": 0})
        with tempfile.TemporaryDirectory() as folder:
            model = load_head(self.write(folder, doc, binary))
            self.assertEqual(len(model["positions"]), 6)
            np.testing.assert_allclose(model["colors"][0], [.5, 128/255, 0])
            np.testing.assert_array_equal(model["faces"][1], [3, 4, 5])


if __name__ == "__main__":
    unittest.main()

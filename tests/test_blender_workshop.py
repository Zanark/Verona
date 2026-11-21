import json
from pathlib import Path
import struct
import tempfile
import unittest

import numpy as np

from scripts.claire_blender_export import ORIGIN_CM, glb_document, to_blender


class BlenderWorkshopTests(unittest.TestCase):
    def test_source_centimeters_become_right_handed_blender_meters(self):
        axes = to_blender(ORIGIN_CM + np.eye(3) * 100)
        np.testing.assert_allclose(axes, [[1,0,0],[0,0,1],[0,-1,0]])
        self.assertAlmostEqual(float(np.linalg.det(axes)),1)
        np.testing.assert_array_equal(to_blender(ORIGIN_CM),[0,0,0])

    def write_glb(self, root, doc, magic=b"glTF", kind=0x4E4F534A):
        content = json.dumps(doc).encode()
        content += b" " * (-len(content)%4)
        path = Path(root)/"test.glb"
        path.write_bytes(struct.pack("<4sIIII",magic,2,20+len(content),len(content),kind)+content)
        return path

    def test_self_contained_glb_json_is_readable(self):
        with tempfile.TemporaryDirectory() as root:
            doc={"asset":{"version":"2.0"}}
            self.assertEqual(glb_document(self.write_glb(root,doc)),doc)

    def test_wrong_header_or_chunk_fails_explicitly(self):
        with tempfile.TemporaryDirectory() as root:
            for kwargs in ({"magic":b"nope"},{"kind":0x004E4942}):
                with self.subTest(kwargs=kwargs),self.assertRaises(ValueError):
                    glb_document(self.write_glb(root,{},**kwargs))

    def test_external_binary_or_texture_is_not_a_self_contained_export(self):
        with tempfile.TemporaryDirectory() as root:
            for key in ("buffers","images"):
                with self.subTest(key=key),self.assertRaisesRegex(ValueError,"external"):
                    glb_document(self.write_glb(root,{key:[{"uri":"external.bin"}]}))


if __name__ == "__main__":
    unittest.main()

import hashlib
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts import fetch_cpu_model as model


class ModelFetchTests(unittest.TestCase):
    def test_existing_corrupt_asset_is_rejected_without_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "network.onnx"
            target.write_bytes(b"corrupt")
            with patch.object(model.urllib.request, "urlopen") as request:
                with self.assertRaisesRegex(ValueError, "asset size"):
                    model.fetch("network.onnx", Path(directory))
            request.assert_not_called()
            self.assertEqual(target.read_bytes(), b"corrupt")

    def test_bad_download_is_rejected_and_temporary_file_removed(self):
        with tempfile.TemporaryDirectory() as directory:
            payload = b"wrong"
            expected = hashlib.sha256(b"right").hexdigest()
            with (
                patch.dict(model.ASSETS, {"test.npz": (len(payload), expected)}),
                patch.object(
                    model.urllib.request, "urlopen", return_value=io.BytesIO(payload)
                ),
            ):
                with self.assertRaisesRegex(ValueError, "SHA-256"):
                    model.fetch("test.npz", Path(directory))
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_verified_asset_is_cached_without_network(self):
        with tempfile.TemporaryDirectory() as directory:
            payload = b"verified"
            target = Path(directory) / "test.npz"
            target.write_bytes(payload)
            with (
                patch.dict(
                    model.ASSETS,
                    {"test.npz": (len(payload), hashlib.sha256(payload).hexdigest())},
                ),
                patch.object(model.urllib.request, "urlopen") as request,
            ):
                self.assertEqual(model.fetch("test.npz", Path(directory)), target)
            request.assert_not_called()


if __name__ == "__main__":
    unittest.main()

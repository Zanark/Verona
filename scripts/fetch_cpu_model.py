"""Fetch only the pinned public assets used by the local CPU experiment."""

import hashlib
import json
from pathlib import Path
import tempfile
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / ".local" / "models" / "mark-v2.3"
REVISION = "5451728e07378df93b04523279e134a9993ae71b"
REPOSITORY = "nvidia/Audio2Face-3D-v2.3-Mark"
LICENSE_URL = (
    "https://www.nvidia.com/en-us/agreements/enterprise-software/"
    "nvidia-open-model-license/"
)
ASSETS = {
    "network.onnx": (
        75751144,
        "dcd16d3b1affb090d4da1ba88791faa6bcd755f97c853b3b667abad9be15cb4b",
    ),
    "model_data.npz": (
        203797682,
        "03790f24942ec26796ce101c2e238eb7ff5c1bb94a6c14a840ffcd530d3a301e",
    ),
    "implicit_emo_db.npz": (
        1319768,
        "ec07bdf65ea52b6c348e637021a5933b663fae52acf5ff45c11726c1057d5130",
    ),
}


def verify(path: Path, size: int, digest: str) -> None:
    if path.stat().st_size != size:
        raise ValueError(f"Incorrect asset size: {path}")
    with path.open("rb") as stream:
        actual = hashlib.file_digest(stream, "sha256").hexdigest()
    if actual != digest:
        raise ValueError(f"Incorrect asset SHA-256: {path}")


def fetch(name: str, destination: Path = DESTINATION) -> Path:
    size, digest = ASSETS[name]
    target = destination / name
    url = f"https://huggingface.co/{REPOSITORY}/resolve/{REVISION}/{name}"
    return fetch_verified(url, target, size, digest)


def fetch_verified(url: str, target: Path, size: int, digest: str) -> Path:
    """Fetch a fixed manifest entry; never called with browser-supplied paths."""
    if target.exists():
        verify(target, size, digest)
        return target

    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as output:
            temporary = Path(output.name)
            received = 0
            with urllib.request.urlopen(url, timeout=60) as response:
                while block := response.read(1024 * 1024):
                    received += len(block)
                    if received > size:
                        raise ValueError(f"Asset exceeds pinned size: {target.name}")
                    output.write(block)
        verify(temporary, size, digest)
        if target.exists():
            raise FileExistsError(f"Asset appeared during download: {target}")
        temporary.rename(target)
        return target
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def main() -> None:
    print(f"Model governed by NVIDIA Open Model License: {LICENSE_URL}", flush=True)
    print("Custom CPU experiment; not an NVIDIA-supported CPU runtime.", flush=True)
    for name in ASSETS:
        path = fetch(name)
        print(f"Verified {path.name}", flush=True)
    receipt = {
        "repository": REPOSITORY,
        "revision": REVISION,
        "license": LICENSE_URL,
        "assets": {
            name: {"bytes": size, "sha256": digest}
            for name, (size, digest) in ASSETS.items()
        },
    }
    receipt_path = DESTINATION / "verona-receipt.json"
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

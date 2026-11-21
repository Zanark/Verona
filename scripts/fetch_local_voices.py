"""Explicit, hash-pinned optional Kokoro setup. Never called by the runtime."""

import argparse
import hashlib
from pathlib import Path
import sys
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verona.local_voices import ASSETS, MODEL_ROOT, SOURCE, verify_assets


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true", help="Verify existing assets without network access.")
    args = parser.parse_args()
    if not args.verify:
        MODEL_ROOT.mkdir(parents=True, exist_ok=True)
        for name, (size, expected) in ASSETS.items():
            path = MODEL_ROOT / name
            if path.exists():
                continue
            part = path.with_suffix(path.suffix + ".part")
            digest = hashlib.sha256()
            count = 0
            created = False
            try:
                with part.open("xb") as target:
                    created = True
                    with urllib.request.urlopen(SOURCE + name, timeout=60) as source:
                        while chunk := source.read(1024 * 1024):
                            count += len(chunk)
                            if count > size:
                                raise RuntimeError(f"{name} exceeds its pinned size.")
                            digest.update(chunk)
                            target.write(chunk)
                if count != size or digest.hexdigest() != expected:
                    raise RuntimeError(f"{name} failed pinned size/SHA-256 verification.")
                part.rename(path)
            finally:
                if created:
                    part.unlink(missing_ok=True)
    verify_assets()
    print(f"Verified 28 local English voice styles and one CPU model in {MODEL_ROOT}")


if __name__ == "__main__":
    main()

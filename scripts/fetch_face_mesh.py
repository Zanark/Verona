"""Fetch official, matching Mark v2 geometry as data only, never execute Maya."""

import json

from .fetch_cpu_model import ROOT, fetch_verified


REVISION = "f0dc13670952c495450dab1655c94e9056c9d7d9"
SOURCE = "sample_project/maya_geom/mark_geom_v2_topo1.ma"
URL = f"https://media.githubusercontent.com/media/NVIDIA/Maya-ACE/{REVISION}/{SOURCE}"
SIZE = 69497752
SHA256 = "6c3f5725978781e3bb079cc50c4fef0e5d4f5373fb271b991ce6eb9298af02df"
DESTINATION = ROOT / ".local" / "models" / "mark-v2.3" / "mark_geom_v2_topo1.ma"


def main() -> None:
    print("Official NVIDIA/Maya-ACE sample data; see THIRD_PARTY.md.", flush=True)
    print("Downloads one 69.5 MB ASCII geometry file. No Maya installation/execution.")
    fetch_verified(URL, DESTINATION, SIZE, SHA256)
    receipt = {
        "repository": "NVIDIA/Maya-ACE",
        "revision": REVISION,
        "source": SOURCE,
        "bytes": SIZE,
        "sha256": SHA256,
        "license": f"https://github.com/NVIDIA/Maya-ACE/blob/{REVISION}/LICENSE.txt",
        "usage": "Parse numerical vertices/edges only; never execute Maya commands.",
    }
    DESTINATION.with_suffix(".receipt.json").write_text(
        json.dumps(receipt, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Verified {DESTINATION.name}")


if __name__ == "__main__":
    main()

"""Fetch pinned official Claire model and matching geometry, as data only."""

import json

from .fetch_cpu_model import ROOT, LICENSE_URL, fetch_verified
from .fetch_face_mesh import REVISION as MESH_REVISION


REVISION = "a46eafb067adfdd7cc8f5c7941586b309004561c"
REPOSITORY = "nvidia/Audio2Face-3D-v2.3.1-Claire"
DESTINATION = ROOT / ".local" / "models" / "claire-v2.3.1"
ASSETS = {
    "network.onnx": (159044772, "6bb7a3a3c22491960e71a14742891e0d7205d7c80414aebe326cad82fd6867c3"),
    "model_data.npz": (106350002, "4c2205365533790add8219170b9505960e31d2fca82708f2e3db31c5ccf092a4"),
    "implicit_emo_db.npz": (1713860, "562ee9fac5eded20753eb40230519a7304156c177f52d9aa44580d5cf57c0447"),
    "claire_geom_v2_topo1.ma": (69374119, "59fb6750f1e4ceedeeb98d5ac687ab387dbc761b6b79c5177985a5b23f7f66e9"),
}


def main() -> None:
    print(f"Official Claire assets, NVIDIA Open Model License: {LICENSE_URL}", flush=True)
    print("Matching Maya-ACE geometry is numerical data, never executed.", flush=True)
    for name, (size, digest) in ASSETS.items():
        if name.endswith(".ma"):
            url = (f"https://media.githubusercontent.com/media/NVIDIA/Maya-ACE/{MESH_REVISION}"
                   f"/sample_project/maya_geom/{name}")
        else:
            url = f"https://huggingface.co/{REPOSITORY}/resolve/{REVISION}/{name}"
        fetch_verified(url, DESTINATION / name, size, digest)
        print(f"Verified {name}", flush=True)
    (DESTINATION / "verona-receipt.json").write_text(json.dumps({
        "repository": REPOSITORY, "revision": REVISION, "license": LICENSE_URL,
        "meshRevision": MESH_REVISION,
        "assets": {n: {"bytes": s, "sha256": h} for n, (s, h) in ASSETS.items()},
    }, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

"""Derive an Elara-only eye-detail revision from a complete local head study."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

import numpy as np

from scripts.glb_head_study import elara_eye_details


def build(study, output):
    catalog = json.loads((study / "study.json").read_text())
    if len(catalog["candidates"]) != 6:
        raise ValueError("A complete six-head study is required.")
    candidate = next(c for c in catalog["candidates"] if c["id"] == "elara")
    if candidate.get("eyeDetails") or candidate["method"] != "hybrid":
        raise ValueError("Expected the undecorated Elara structural hybrid.")
    folder = study / "elara"
    original = np.fromfile(folder / candidate["frames"][0]["file"], dtype="<f4").reshape(-1, 3)
    faces = np.fromfile(folder / "triangles.bin", dtype="<u4").reshape(-1, 3)
    skin_count, old_count = candidate["skinVertices"], candidate["vertices"]
    skin_faces = faces[(faces < skin_count).all(1)]
    detail, extra_faces, animate, receipt = elara_eye_details(original[:skin_count], skin_faces)
    shutil.copytree(study, output)
    target = output / "elara"
    maximum = 0.
    for filename in sorted({frame["file"] for frame in candidate["frames"]}):
        pose = np.fromfile(folder / filename, dtype="<f4").reshape(-1, 3)
        if pose.shape != original.shape or not np.isfinite(pose).all():
            raise ValueError("Elara source pose does not match the study.")
        extra = animate(pose[:skin_count])
        maximum = max(maximum, float(np.linalg.norm(extra-detail, axis=1).max()))
        np.vstack((pose, extra)).astype("<f4").tofile(target / filename)
    np.vstack((faces, extra_faces+old_count)).astype("<u4").tofile(target / "triangles.bin")
    candidate.update(vertices=old_count+len(detail), triangles=len(faces)+len(extra_faces),
                     eyeDetails=receipt, originalVertices=old_count,
                     maximumMotionCm=max(candidate["maximumMotionCm"], maximum))
    catalog["eyeDetailRevision"] = {
        "candidate": "elara", "sourceStudySha256": hashlib.sha256((study / "study.json").read_bytes()).hexdigest(),
        "scope": "Only Elara gains attached clay eye details; original five candidates and Elara skin/eyes unchanged."}
    for path in (target / "candidate.json", output / "study.json"):
        path.write_text(json.dumps(candidate if path.name == "candidate.json" else catalog, indent=2)+"\n")
    print(json.dumps({"candidate": "Elara", **receipt, "output": str(output)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--study", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    build(args.study, args.output)

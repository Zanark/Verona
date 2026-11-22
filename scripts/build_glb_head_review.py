"""Generate six local, review-only candidates from explicit static head assets."""

import argparse
import hashlib
import json
from pathlib import Path
import time

import numpy as np

from scripts.glb_head_import import load_head
from scripts.glb_head_study import attach, register
from verona.appearance import claire_eyes


PRESETS = (
    ("stylized_anime_female_head", "Lyra", "Elara", 2.65, 151.55, 4.5, 147.15),
    ("free_basemesh_head_woman", "Mira", "Selene", 2.8, 150.75, 5.85, 144.9),
    ("head_woman_basemesh", "Neris", "Thalia", 2.7, 149.65, 6.65, 144.45),
)


def build(assets, baseline, donor, output):
    output.mkdir(parents=True, exist_ok=False)
    mesh = json.loads((baseline / "mesh.json").read_text())
    raw = (baseline / "mesh.bin").read_bytes()
    count = mesh["vertices"]
    center, scale = np.array(mesh["center"]), mesh["scale"]
    rest = np.frombuffer(raw, "<i2", count=count * 3).reshape(-1, 3) / mesh["quantization"] * scale + center
    faces = np.frombuffer(raw, "<u4", offset=mesh["triangleOffset"],
                          count=mesh["triangles"] * 3).reshape(-1, 3)
    if count != 15375:
        raise ValueError("This review requires the pinned selected Claire topology.")
    clips = json.loads((donor / "clips.json").read_text())["clips"]
    motions, receipts = {}, {}
    for name in ("neutral", "happy", "surprised"):
        clip = next(c for c in clips if c["name"] == name)
        metadata = clip["metadata"]
        data = (donor / clip["filename"]).read_bytes()
        if (hashlib.sha256(data).hexdigest() != metadata["motionSha256"]
                or metadata["vertices"] != count or metadata["quantization"] != mesh["quantization"]):
            raise ValueError("Synthetic donor clip hash/topology changed.")
        motions[name] = (np.frombuffer(data, "<i2").reshape(metadata["frames"], count, 3)
                         / mesh["quantization"] * scale + center)
        receipts[name] = {k: metadata[k] for k in (
            "motionSha256", "audioPcmSha256", "frames", "fps", "expressionGain", "voice")}
    for name in ("happy", "surprised"):
        if receipts[name]["audioPcmSha256"] != receipts["neutral"]["audioPcmSha256"]:
            raise ValueError("Expression comparison requires the identical synthetic audio.")
        motions[name] = motions["neutral"] + .5 * (motions[name] - motions["neutral"])
        receipts[name]["reviewExpressionGain"] = 2.
        receipts[name]["reviewConversion"] = "Half of the archived 4x neutral-relative emotion delta; speech retained."
    timeline = [{"stage": "Rest", "pose": "rest", "frame": 0, "angle": 0}] * 8
    for name, length in (("neutral", 20), ("happy", 12), ("surprised", 12)):
        timeline += [{"stage": {"neutral": "Speech", "happy": "Happy + speech", "surprised": "Surprised + speech"}[name],
                      "pose": name, "frame": int(i), "angle": 0}
                     for i in np.linspace(0, len(motions[name]) - 1, length)]
    timeline += [{"stage": "Rest turn", "pose": "rest", "frame": 0, "angle": angle}
                 for angle in (0, 15, 30, 45, 60, 90, 45, 0)]
    eye_points, eye_faces = claire_eyes()
    candidates = []
    for source_id, native_name, hybrid_name, ex, ey, ez, mouth in PRESETS:
        started = time.perf_counter()
        source = load_head(assets / (source_id + ".glb"))
        points, native_faces = source["positions"], source["faces"]
        low, high = points.min(0), points.max(0)
        preview = (points - (high + low) / 2) * (26 / (high[1] - low[1])) + [0, 147, 0]
        eyes = np.array([[-ex, ey, ez], [ex, ey, ez]])
        native, warp, hybrid, registration = register(rest, faces, preview, native_faces, eyes, mouth)
        transfer, binding = attach(rest, faces, native, warp)
        if not np.allclose(transfer(rest), native, atol=1e-10):
            raise ValueError("Native neutral rest was not preserved.")
        for name, method in ((native_name, "native"), (hybrid_name, "hybrid")):
            folder = output / name.lower()
            folder.mkdir()
            is_native = method == "native"
            target_faces = native_faces if is_native else np.vstack((faces, eye_faces + count))
            target_rest = native if is_native else np.vstack((hybrid(rest), eye_points))
            (folder / "triangles.bin").write_bytes(target_faces.astype("<u4").tobytes())
            cached, frame_meta, maximum = {}, [], 0.
            for step in timeline:
                key = (step["pose"], step["frame"])
                if key not in cached:
                    pose = rest if key[0] == "rest" else motions[key[0]][key[1]]
                    positions = transfer(pose) if is_native else np.vstack((hybrid(pose), eye_points))
                    if not np.isfinite(positions).all():
                        raise ValueError("Candidate motion contains nonfinite geometry.")
                    maximum = max(maximum, float(np.linalg.norm(positions - target_rest, axis=1).max()))
                    filename = f"pose-{len(cached):03}.bin"
                    (folder / filename).write_bytes(positions.astype("<f4").tobytes())
                    cached[key] = filename
                frame_meta.append({**step, "file": cached[key]})
            candidate = {
                "name": name, "id": name.lower(), "method": method, "source": source_id,
                "vertices": len(target_rest), "triangles": len(target_faces),
                "skinVertices": len(native) if is_native else count,
                "staticEyeVertices": 0 if is_native else len(eye_points),
                "frames": frame_meta, "fps": 8, "sourceReceipt": source["receipt"],
                "registration": registration, "binding": binding if is_native else None,
                "maximumMotionCm": maximum, "topologyPreserved": True,
                "restBounds": [target_rest.min(0).tolist(), target_rest.max(0).tolist()],
                "status": "Review only; not installed in the manager or accepted.",
            }
            (folder / "candidate.json").write_text(json.dumps(candidate, indent=2) + "\n")
            candidates.append(candidate)
            print(json.dumps({"name": name, "vertices": candidate["vertices"], "maximumMotionCm": maximum,
                              "elapsedSourceSeconds": time.perf_counter() - started}), flush=True)
        if hashlib.sha256((assets / (source_id + ".glb")).read_bytes()).hexdigest() != source["receipt"]["sourceSha256"]:
            raise ValueError("Source asset changed during the study.")
    result = {"candidates": candidates, "donor": receipts, "baselineSha256": hashlib.sha256(raw).hexdigest(),
              "durationSeconds": len(timeline) / 8, "audioIncluded": False,
              "limits": "Geometry-only clay comparison. No source textures, cosmetics, hair, joint rigging or accuracy acceptance."}
    (output / "study.json").write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ("assets", "baseline", "donor", "output"):
        parser.add_argument("--" + flag, type=Path, required=True)
    args = parser.parse_args()
    try:
        build(args.assets, args.baseline, args.donor, args.output)
    except Exception as error:
        if args.output.is_dir():
            (args.output / "failure.json").write_text(json.dumps({"error": str(error)}) + "\n")
        raise

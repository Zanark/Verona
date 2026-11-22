"""Build a NEW review study from explicitly pinned, archived Claire motion."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

from scripts.anime_claire import anime_warp, assemble
from scripts.claire_reference_study import EYES


BASE_SHA = "08da80b04ae099725b88e8c15b02e9e393a6d516c02f9c9e103e240278c41137"
AUDIO_SHA = "8750ef597e923bc0f084d5cda0c4e1616b436e34d08d5ce4d716315afdc05f90"
EMOTIONS = {"neutral", "happy", "sad", "angry", "cheekiness", "disgust", "surprised",
            "fear", "grief", "outofbreath", "pain"}


def build(baseline, motion, output):
    baseline, motion, output = map(Path, (baseline, motion, output))
    metadata = json.loads((baseline/"mesh.json").read_text())
    raw = (baseline/"mesh.bin").read_bytes()
    if hashlib.sha256(raw).hexdigest() != BASE_SHA:
        raise ValueError("This study requires the exact pinned Claire baseline.")
    count = metadata["vertices"]
    center, scale, quant = np.array(metadata["center"]), metadata["scale"], metadata["quantization"]
    rest = np.frombuffer(raw, "<i2", count=count*3).reshape(-1, 3)/quant*scale+center
    faces = np.frombuffer(raw, "<u4", count=metadata["triangles"]*3,
                          offset=metadata["triangleOffset"]).reshape(-1, 3)
    archive = json.loads((motion/"clips.json").read_text())
    if {c["name"] for c in archive["clips"]} != EMOTIONS or len(archive["clips"]) != 11:
        raise ValueError("The study requires neutral and all ten archived emotions.")
    clips, hashes = {}, {}
    for clip in archive["clips"]:
        m = clip["metadata"]
        source = (motion/clip["filename"]).read_bytes()
        if (hashlib.sha256(source).hexdigest() != m["motionSha256"]
                or m["audioPcmSha256"] != AUDIO_SHA or m["vertices"] != count
                or m["quantization"] != quant or m["fps"] != 30 or m["frames"] != 83):
            raise ValueError("Archived Claire motion/audio correspondence changed.")
        values = np.frombuffer(source, "<i2").reshape(m["frames"], count, 3)/quant*scale+center
        clips[clip["name"]], hashes[clip["name"]] = values, m["motionSha256"]
    pose, triangles, colors, receipt = assemble(rest, faces)
    # Rest, an explicit closure sweep, side views, then each full archived phrase.
    timeline = [(rest, angle, "rest / silhouette", 0) for angle in (0, 0, 0, -25, -45, 0, 25, 45, 0)]
    timeline += [(rest, 0, "deliberate blink", b) for b in (0, .35, .7, 1, 1, .7, .35, 0, 0)]
    for name in sorted(EMOTIONS, key=lambda n: (n != "neutral", n)):
        for index in np.linspace(0, 82, 22).round().astype(int):
            # Only emotion-minus-neutral is reduced, retaining the neutral speech.
            skin = clips["neutral"][index]+.5*(clips[name][index]-clips["neutral"][index])
            timeline.append((skin, 0, name, 0))
    output.mkdir()
    candidates = []
    for identity, title in (("akari", "Akari - finished anime candidate"),
                           ("akari-clay", "Akari - clay structure, no hair"),
                           ("claire", "Claire - unmodified skin baseline")):
        folder = output/identity
        folder.mkdir()
        styled = identity != "claire"
        include_hair = identity == "akari"
        total = pose(rest, styled=styled, include_hair=include_hair)
        if identity == "claire":
            # Baseline optics/details remain comparison aids, not changes to Claire skin.
            title = "Claire skin baseline - shared comparison eye/detail aids"
        cut = receipt["skinVertices"]+receipt["eyeVertices"]+receipt["detailVertices"]
        chosen = triangles if include_hair else triangles[(triangles < cut).all(1)]
        chosen.astype("<u4").tofile(folder/"triangles.bin")
        colors[:len(total)].tofile(folder/"colors.bin")
        frames = []
        for i, (skin, angle, label, blink) in enumerate(timeline):
            result = pose(skin, blink, styled=styled, include_hair=include_hair)
            if not np.isfinite(result).all():
                raise ValueError("Nonfinite anime review pose.")
            filename = f"{i:03}.bin"
            result.astype("<f4").tofile(folder/filename)
            frames.append({"file": filename, "angle": angle, "label": label, "blink": blink})
        mouth_points = np.array([[.08, 140.2, 4.08], [2.73, 140.2, 3.08]])
        mapped = anime_warp(mouth_points) if styled else mouth_points
        cy = float(mapped[0, 1])
        candidate = {"id": identity, "name": title, "vertices": len(total),
            "triangles": len(chosen), "frames": frames, "method": "anime",
            "mouthProfile": {"mouth": [.08, cy, float(mapped[1, 0]-.08)],
                "upper": [cy]*5, "depth": [float(mapped[0, 2]), float(mapped[1, 2])]},
            "viewCenter": [0, 146.4, -1.5], "viewScale": 15.7, "cropY": 133.6,
            "eyeY": float(anime_warp(EYES)[0, 1]) if styled else float(EYES[0, 1]),
            "eyeRadius": 1.33 if styled else .85, "colors": "colors.bin", "toon": include_hair,
        }
        candidates.append(candidate)
    study = {"revision": "akari-anime-1", "fps": 8, "candidates": candidates,
        "baselineSha256": BASE_SHA, "motionSha256": hashes, "audioSha256": AUDIO_SHA,
        "emotionGain": "2x archived emotion minus neutral; neutral speech retained",
        "audio": False, "sourceReceipt": receipt,
        "limits": "Silent review GIFs; no lip-sync listening acceptance, live app integration or owner approval."}
    (output/"study.json").write_text(json.dumps(study, indent=2))
    return study


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--motion", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    result = build(args.baseline, args.motion, args.output)
    print(json.dumps({"revision": result["revision"], "candidates": len(result["candidates"]),
                      "framesEach": len(result["candidates"][0]["frames"])}))

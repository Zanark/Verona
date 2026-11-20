"""Offline actual-Mark review; no application launch, default change or download."""

import argparse
from datetime import datetime, timezone
import hashlib
import html
import json
import math
import os
from pathlib import Path
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
GREETING = "Hey, how are you?"
NAMES = ("neutral", "surprised", "angry", "cheekiness", "disgust", "fear",
         "grief", "happy", "outofbreath", "pain", "sad")
LABELS = ("Neutral speech", "Amazement", "Anger", "Cheekiness", "Disgust",
          "Fear", "Grief", "Joy", "Out of breath", "Pain", "Sadness")


def save_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def prepare(output):
    os.environ["OPENBLAS_NUM_THREADS"] = "2"
    os.environ["OMP_NUM_THREADS"] = "2"
    import numpy as np
    from scripts.fetch_cpu_model import ASSETS, DESTINATION, REVISION, verify
    from scripts.fetch_face_mesh import SIZE, SHA256
    from scripts.probe_cpu import audio_window, conditioning, create_cpu_session
    from verona.mesh import read_mesh, native_control_mesh
    from verona.speech import installed_voices, preferred_voice, synthesize

    output.mkdir(parents=True, exist_ok=False)
    (output / "tmp").mkdir()
    os.environ.update(TEMP=str(output / "tmp"), TMP=str(output / "tmp"),
                      LOCALAPPDATA=str(output / "appdata"),
                      APPDATA=str(output / "roaming"))
    os.chdir(output / "tmp")
    started = time.perf_counter()
    for name, (size, digest) in ASSETS.items():
        verify(DESTINATION / name, size, digest)
    scene = DESTINATION / "mark_geom_v2_topo1.ma"
    verify(scene, SIZE, SHA256)
    with np.load(DESTINATION / "model_data.npz", allow_pickle=False) as data:
        rest, basis = data["shapes_mean_skin"], data["shapes_matrix_skin"]
    if rest.shape != (61520, 3) or basis.shape != (272, 61520, 3):
        raise ValueError("Pinned Mark PCA dimensions changed.")
    native, edges, triangles = read_mesh(scene)
    distances = np.linalg.norm(native - rest, axis=1)
    if native.shape != rest.shape or distances.max() > 1.1 or np.median(distances) > .08:
        raise ValueError("Mark sample/PCA per-index correspondence changed.")
    selected, _, triangles = native_control_mesh(rest, edges, triangles)
    if len(selected) != 15375 or triangles.shape != (30746, 3):
        raise ValueError("Pinned inverse-subdivision topology changed.")
    basis = np.ascontiguousarray(basis[:, selected].reshape(272, -1))
    rest = rest[selected]
    eye_centers, eye_radii = [], []
    for node in ("r_choroid_hiShape", "l_choroid_hiShape"):
        points, _, _ = read_mesh(scene, node)
        eye_centers.append(((points.min(0) + points.max(0)) / 2).tolist())
        eye_radii.append((np.ptp(points, axis=0) / 2).tolist())
    model = {"rest": rest.ravel().tolist(), "polygons": triangles.tolist(),
             "eyeCenters": eye_centers, "eyeRadii": eye_radii}
    save_json(output / "model.json", model)
    rest.astype("<f4").tofile(output / "rest.bin")
    voices = installed_voices()
    with patch("verona.speech.ROOT", output):
        speech = synthesize(GREETING, preferred_voice(voices), voices)
    (output / "greeting.wav").write_bytes(speech.wav)
    samples = np.frombuffer(speech.pcm, dtype="<i2").astype(np.float32) / 32768
    condition = conditioning(DESTINATION / "implicit_emo_db.npz")
    session = create_cpu_session()
    frames = math.ceil(speech.seconds * 30)
    if not 0 < speech.seconds <= 10:
        raise ValueError("Fixed report greeting exceeds its bounded duration.")
    clips = []
    for name, label in zip(NAMES, LABELS):
        current = condition.copy()
        if name != "neutral":
            current[0, 0, 16 + NAMES.index(name) - 1] = .6
        poses, timings = [], []
        for frame in range(frames):
            before = time.perf_counter()
            prediction = session.run(["result"], {
                "input": audio_window(samples, frame, 1.3), "emotion": current})[0]
            if prediction.shape != (1, 1, 301) or not np.isfinite(prediction).all():
                raise ValueError("Expected finite actual Mark [1,1,301] output.")
            pose = (prediction[0, 0, :272] @ basis).reshape(-1, 3) + rest
            if not np.isfinite(pose).all():
                raise ValueError("Nonfinite Mark geometry.")
            poses.append(pose)
            timings.append(time.perf_counter() - before)
        motion = np.asarray(poses, dtype="<f4")
        filename = name + ".bin"
        motion.tofile(output / filename)
        clips.append({"name": name, "label": label, "filename": filename,
                      "frames": frames, "duration": speech.seconds,
                      "motionSha256": hashlib.sha256(motion.tobytes()).hexdigest(),
                      "maximumMotionFromFirstCm": float(np.max(np.abs(motion - motion[0]))),
                      "computeSeconds": sum(timings)})
    receipt = {"model": "NVIDIA Audio2Face-3D v2.3 Mark",
               "modelRevision": REVISION, "createdAt": datetime.now(timezone.utc).isoformat(),
               "modelAssets": ASSETS, "sceneSha256": SHA256,
               "nativeVertices": 61520, "displayVertices": len(selected),
               "displayTriangles": len(triangles),
               "sampleToPcaMaxDistanceCm": float(distances.max()),
               "sampleToPcaMedianDistanceCm": float(np.median(distances)),
               "providers": session.get_providers(), "inputStrength": 1.3,
               "conditioning": "g2a_neutral frame33; explicit emotion channels at0.6, no gain",
               "skinComponents": 272, "networkOutputs": 301, "sourceFps": 30,
               "voice": speech.voice, "fixedSyntheticText": GREETING,
               "audioPcmSha256": hashlib.sha256(speech.pcm).hexdigest(),
               "clips": clips, "preparationSeconds": time.perf_counter() - started,
               "isolation": "Read-only pinned assets; owned output/temp/appdata/profile. No server, live head or devices.",
               "omitted": ["SDK smoothing/contact correction", "independent teeth/tongue/jaw/eye animation",
                           "photorealistic materials/hair", "human phonetic/identity acceptance"]}
    save_json(output / "receipt.json", receipt)
    print(json.dumps({key: receipt[key] for key in
                      ("model", "providers", "displayVertices", "preparationSeconds")}))


def encode(output):
    from PIL import Image, ImageChops

    manifest = json.loads((output / "capture.json").read_text(encoding="utf-8"))
    results = []
    for clip in manifest["clips"]:
        frames = [Image.open(output / item).convert("RGB") for item in clip["images"]]
        palette = frames[len(frames) // 2].quantize(colors=256)
        converted = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
        count = len(frames)
        boundaries = [round(index * clip["duration"] * 100 / count) for index in range(count + 1)]
        durations = [(b - a) * 10 for a, b in zip(boundaries, boundaries[1:])]
        if min(durations) < 10:
            raise ValueError("GIF frame durations must be representable in centiseconds.")
        target = output / (clip["name"] + ".gif")
        converted[0].save(target, save_all=True, append_images=converted[1:],
                          duration=durations, loop=0, optimize=False, disposal=2)
        decoded, ends, elapsed = [], [], 0
        with Image.open(target) as gif:
            if gif.info.get("loop") != 0:
                raise ValueError("GIF must loop.")
            for index in range(gif.n_frames):
                gif.seek(index)
                decoded.append(gif.convert("RGB").copy())
                elapsed += gif.info["duration"]
                ends.append(elapsed)
        if elapsed != sum(durations) or len(decoded) < 2:
            raise ValueError("Encoded GIF lost duration or all animation.")
        index, time_ms = 0, 0
        for expected, duration in zip(converted, durations):
            while ends[index] <= time_ms:
                index += 1
            if ImageChops.difference(expected.convert("RGB"), decoded[index]).getbbox():
                raise ValueError(f"{target.name}: encoded frame differs from expected rendered content.")
            time_ms += duration
        if not any(ImageChops.difference(decoded[0], frame).getbbox() for frame in decoded[1:]):
            raise ValueError("Encoded GIF has no moving pixels.")
        with target.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        results.append({"name": clip["name"], "sourceFrames": count,
                        "encodedFrames": len(decoded), "durationMs": elapsed,
                        "everySampleMatchesEncodedTimeline": True,
                        "bytes": target.stat().st_size,
                        "sha256": digest})
    save_json(output / "gif-verification.json", {"clips": results})
    write_report(output)
    print(json.dumps({"gifs": len(results), "everySampleMatches": True,
                      "report": str(output / "review.html")}))


def write_report(output):
    receipt = json.loads((output / "receipt.json").read_text(encoding="utf-8"))
    cards = "\n".join(
        f'<article><h3>{html.escape(label)}</h3><img src="{name}.gif" '
        f'alt="Actual Mark {html.escape(label.lower())}, shaded left and wireframe right" '
        f'width="960" height="552"><p>Same greeting, native conditioning; '
        f'{"no explicit emotion" if name == "neutral" else "one explicit control at 0.60"}.</p></article>'
        for name, label in zip(NAMES, LABELS))
    page = """<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verona | Meet the actual Mark v2.3 model</title>
<style>
:root{color-scheme:dark;font:16px/1.65 "Segoe UI",sans-serif;background:#0c1118;color:#edf2f7}
body{max-width:1180px;margin:36px auto;padding:0 24px}h1{font-size:clamp(30px,5vw,50px);line-height:1.15}
h1,h2,h3{color:#91e2cc}a{color:#a7d8ff}code{overflow-wrap:anywhere}
.pill{display:inline-block;border:1px solid #718496;padding:4px 12px;border-radius:20px;font-size:13px}
.note,article{background:#131b25;border:1px solid #334455;border-radius:14px;padding:20px}
.note{border-left:4px solid #ffc071}.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}
img{width:100%;height:auto;display:block;border-radius:10px}figure{margin:24px 0}
figcaption,article p,small{color:#a9bacb}h3{margin:0 0 12px}summary{cursor:pointer;padding:12px 0}
audio{width:min(100%,620px)}#media-error{border-color:#ffb4b4;color:#ffcccc}
@media(max-width:760px){.grid{grid-template-columns:1fr}body{padding:0 14px}}
</style>
<span class="pill">ACTUAL LOCAL ASSETS &middot; REVIEW ONLY &middot; RUNNING HEADS UNCHANGED</span>
<h1>Meet Mark v2.3</h1>
<p>This is <strong>NVIDIA's separate learned face and facial-motion model</strong>
in <code>.local\\models\\mark-v2.3</code>. It is not Claire with a different color,
not the MPFB head and not Verona's Claire-derived Male-SharpJawline variant.</p>
<p class="note"><strong>What you are seeing:</strong> actual Mark mean skin plus
Mark's own speech-conditioned PCA deformation. No Claire face sculpt, hair,
MPFB transfer or invented lip animation. Left is neutral gray shading; right is
the same geometry as cyan triangle wireframe. Static cosmetic eyes are placed
using Mark's native eye bounds; the neutral preview materials and bright
optics are preview styling, not supplied Mark textures or animated eye joints.</p>
<p id="media-error" class="note" role="alert" hidden></p>
<h2>1. The underlying head, from different angles</h2>
<figure><img src="turntable.gif" alt="Unmodified Mark rest skin rotates left and right, shaded and wire"
width="960" height="552"><figcaption>Rigid turntable of the raw Mark mean shape.
No speech, neural expression or procedural hair. This is a geometry preview,
not a ready textured character or the current manager default.</figcaption></figure>
<h2>2. Mark speaking</h2>
<p>Fixed synthetic line: <strong>&ldquo;Hey, how are you?&rdquo;</strong>
Every speech GIF uses this identical audio. Mark predicts motion, not the voice:
the existing local Windows voice is <strong>__VOICE__</strong>.
GIFs are silent; the optional WAV below never plays automatically.</p>
<audio controls preload="none" src="greeting.wav" aria-label="Optional synthetic greeting audio"></audio>
<p><small>The WAV is a separate audio audition, not synchronized to independently
looping GIFs. Original motion is 30 fps; these deterministic previews sample
approximately 12 fps and preserve the complete greeting duration.</small></p>
<div class="grid">__CARDS__</div>
<h2>3. What the folder actually contains</h2>
<ul><li><code>network.onnx</code>: speech/emotion-conditioned network, CPU-only here.</li>
<li><code>model_data.npz</code>: mean geometry and deformation bases. Skin has
61,520 vertices and 272 signed PCA components; the network returns 301 values
including other articulators that this preview does not animate.</li>
<li><code>implicit_emo_db.npz</code>: implicit style/identity conditioning.
The pinned neutral is <code>g2a_neutral</code>, frame 33. Ten explicit emotion
channels follow its sixteen implicit values.</li>
<li><code>mark_geom_v2_topo1.ma</code>: matching native mesh connectivity,
read strictly as numerical data, never executed or opened in Maya.</li>
<li>The two JSON receipts record provenance, sizes and hashes. They are not models.</li></ul>
<h2>4. How this differs from the Verona face you use now</h2>
<p>The six current manager variants stay unchanged. Current Claire-family heads
use Claire v2.3.1's 140 skin components plus their authored appearance changes.
This report uses Mark v2.3's separate network, 272-component basis and original
mean skin. Shared topology counts do not make those identities interchangeable.
No new manager option or runtime model switch is installed by viewing this report.</p>
<p>Each emotion uses its native single input at 0.60, with <strong>no 2x/4x
neutral-relative amplification</strong>. Cheekiness is Mark's learned channel,
not the extra sideways lip-pull proposed in the earlier Claire report.
Expression names are model controls, not detected feelings or accepted semantics.</p>
<details><summary>Mechanism, fidelity, rights and evidence</summary>
<p>At 30 fps, a rational sample position selects a zero-padded 8,320-sample,
16 kHz audio window at strength 1.3. CPU ONNX predicts coefficients.
Skin = Mark mean + its first 272 coefficients times its matching PCA basis.
One inverse native quad subdivision retains 15,375 actual animated vertex indices
and 30,746 derived triangles for these previews. Wire shows triangle edges.
There is no arbitrary remeshing or cross-identity retargeting.</p>
<p>Native Maya sample versus model mean maximum per-index distance: __DISTANCE__ cm.
They are not byte-identical rest shapes; the displayed rest and basis come from
the model NPZ, with the verified matching sample supplying connectivity.
The renderer reuses <code>verona/web/mpfb-renderer.mjs:createStudyRenderer</code>
as a generic geometry display, not MPFB geometry or fitting.</p>
<p>Omitted: the full SDK's skin smoothing/contact corrections, independently
animated teeth, tongue, jaw and eye joints, textured materials and hair.
No claim of lip contact, anatomical or phonetic accuracy, owner identity
acceptance, real-time generation or official CPU SDK support follows.</p>
<p>The fixed synthetic greeting is intentionally saved in this requested private
report. No conversation or recording was used. Assets remained read-only; own
temporary/profile data and no live host, device or application changes.</p>
<p>Model revision <code>__REVISION__</code>, governed by the
<a href="https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/">NVIDIA Open Model License</a>.
Native sample: NVIDIA/Maya-ACE, separately MIT; see repository THIRD_PARTY.md.
No weights or Maya scene are copied into this report or Git.</p>
<p><a href="receipt.json">Actual source/inference receipt</a> &middot;
<a href="capture.json">Deterministic capture samples</a> &middot;
<a href="gif-verification.json">All-frame encoded-GIF verification</a></p>
</details>
<script>
for(const image of document.images)image.addEventListener("error",()=>{
const error=document.getElementById("media-error");error.hidden=false;
error.textContent="A report image could not load. Keep the report folder intact; missing: "+image.getAttribute("src");
});
</script></html>"""
    page = (page.replace("__VOICE__", html.escape(receipt["voice"]))
            .replace("__CARDS__", cards)
            .replace("__DISTANCE__", f'{receipt["sampleToPcaMaxDistanceCm"]:.6f}')
            .replace("__REVISION__", receipt["modelRevision"]))
    (output / "review.html").write_text(page, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", choices=("prepare", "encode"))
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    if args.stage == "prepare" and output.exists():
        parser.error("Choose a new report directory; existing evidence is never overwritten.")
    if args.stage == "encode" and (output / "gif-verification.json").exists():
        parser.error("An encoded report already exists; choose a new report run.")
    try:
        (prepare if args.stage == "prepare" else encode)(output)
    except Exception as error:
        if output.is_dir():
            save_json(output / f"{args.stage}-error.json",
                      {"type": type(error).__name__, "error": str(error)})
        raise


if __name__ == "__main__":
    main()

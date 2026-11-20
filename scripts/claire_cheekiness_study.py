"""Report-only sideways-smirk comparison; never imported by the application."""

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
from unittest.mock import patch

os.environ["OPENBLAS_NUM_THREADS"] = "2"
os.environ["OMP_NUM_THREADS"] = "2"
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / ".local/qualification/mpfb-head-04/check-speech-162.png"
REVISION = "claire-sideways-cheekiness-study-2"


def _smooth(low, high, value):
    t = np.clip((value - low) / (high - low), 0, 1)
    return t * t * (3 - 2 * t)


def sideways_lip_pull(rest, positions, strength=1.0):
    """Apply one shared rest-space field to both lip sheets and nearby skin."""
    if (isinstance(strength, bool) or not isinstance(strength, (int, float))
            or not np.isfinite(strength) or not 0 <= strength <= 1):
        raise ValueError("Study strength must be a finite number between zero and one.")
    for points in (rest, positions):
        if (not isinstance(points, np.ndarray)
                or not np.issubdtype(points.dtype, np.number)
                or np.iscomplexobj(points) or not np.isfinite(points).all()):
            raise ValueError("Study positions must be finite real numerical arrays.")
    if (rest.ndim != 2 or not len(rest) or rest.shape[1] != 3
            or positions.ndim not in (2, 3) or positions.shape[-2:] != rest.shape):
        raise ValueError("Supply matching nonempty XYZ rest and pose arrays.")
    x, y, z = rest.astype(np.float64).T
    weight = (_smooth(-3.1, 2.4, x - .08)
              * (1 - _smooth(3.0, 5.6, x - .08))
              * (1 - _smooth(.9, 2.9, abs(y - 140.15)))
              * _smooth(1.0, 3.8, z))
    offset = weight[:, None] * np.array([1.65, 1.05, 0.0]) * strength
    return positions.astype(np.float64) + offset


def make_candidate(engine, clip):
    from verona.engine import QUANTIZATION, pack_positions

    raw = np.frombuffer(clip.motion, dtype="<i2").reshape(-1, len(engine.selected), 3)
    source = raw.astype(np.float64) / QUANTIZATION * engine.scale + engine.center
    candidate = sideways_lip_pull(engine.neutral, source)
    packed = pack_positions(candidate, engine.center, engine.scale)
    decoded = (np.frombuffer(packed, dtype="<i2").reshape(source.shape).astype(np.float64)
               / QUANTIZATION * engine.scale + engine.center)
    field = sideways_lip_pull(engine.neutral, engine.neutral) - engine.neutral
    outside = np.all(field == 0, axis=1)
    np.testing.assert_array_equal(
        np.frombuffer(packed, dtype="<i2").reshape(raw.shape)[:, outside], raw[:, outside])
    diagnostics = {"newNearCollapses": 0, "normalHemisphereChanges": 0}
    for start in range(0, len(source), 4):
        normals = []
        for frames in (source[start:start + 4], decoded[start:start + 4]):
            triangles = frames[:, engine.triangles]
            normals.append(np.cross(triangles[:, :, 1] - triangles[:, :, 0],
                                    triangles[:, :, 2] - triangles[:, :, 0]))
        before, after = normals
        valid = np.linalg.norm(before, axis=-1) > 1e-8
        diagnostics["newNearCollapses"] += int(np.count_nonzero(
            valid & (np.linalg.norm(after, axis=-1) <= 1e-8)))
        diagnostics["normalHemisphereChanges"] += int(np.count_nonzero(
            valid & (np.sum(before * after, axis=-1) <= 0)))
    if diagnostics["newNearCollapses"]:
        raise RuntimeError(f"Candidate introduced near-collapsed triangles: {diagnostics}")
    return packed, {
        **diagnostics, "frames": len(raw), "vertices": len(engine.selected),
        "unchangedOutsideFieldVertices": int(outside.sum()),
        "maximumExtraOffsetCm": float(np.linalg.norm(decoded - source, axis=-1).max()),
        "sourceMotionSha256": hashlib.sha256(clip.motion).hexdigest(),
        "candidateMotionSha256": hashlib.sha256(packed).hexdigest(),
        "limits": "All-frame numerical diagnostics, not contact, intersection or semantic accuracy proof.",
    }


def write_report(output, receipt):
    notes = receipt["geometry"]
    capture = json.loads((output / "capture.json").read_text(encoding="utf-8"))
    page = """<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verona | Claire cheekiness: current vs sideways lip pull</title>
<style>
:root{color-scheme:dark;font:17px/1.6 "Segoe UI",sans-serif;background:#081018;color:#dfedea}
body{max-width:1280px;margin:36px auto;padding:0 24px}h1,h2{line-height:1.2;color:#57e7db}
h1{font-size:clamp(28px,4vw,47px)}a{color:#8edbff}img,canvas{display:block;width:100%;height:auto}
figure{margin:24px 0}figcaption{color:#afc5c6;padding:10px 0}.note{border-left:4px solid #ffc071;
padding:14px 20px;background:#17242d}.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}
article{padding:18px 22px;background:#111e27;border:1px solid #29424b;border-radius:14px}
summary{cursor:pointer;padding:14px 0;font-weight:600}code{overflow-wrap:anywhere}
li{margin:8px 0}.pill{display:inline-block;border:1px solid #4d767c;border-radius:30px;
padding:4px 12px;color:#a6eee4;font-size:14px}button{font:inherit;padding:8px 16px;
color:#e6f4f0;background:#203d49;border:1px solid #64c8c0;border-radius:8px;cursor:pointer}
@media(max-width:720px){body{padding:0 14px}.grid{grid-template-columns:1fr}}
</style>
<span class="pill">REVIEW-ONLY CANDIDATE · RUNNING HEADS UNCHANGED</span>
<h1>Cheekiness with that sideways lip pull</h1>
<p>Your preferred cue is a <strong>one-sided, tilted smirk</strong>: one corner pulls
out and up, stretching the mouth diagonally. Not just a wider, symmetrical smile.</p>
<p><strong>More exaggerated revision:</strong> about 66% more outward/upward pull
than the first preview you liked. The earlier report is preserved separately.</p>
<p class="note"><strong>Left: current original Claire. Right: proposed Claire.</strong>
Same neural speech, same 4x emotion input, camera, topology, eyes and timestamp.
Only the candidate's mouth-area positions receive the extra sideways pull.
This report does not apply the change to any application variant.</p>
<figure><img src="comparison.png" alt="Matched current and proposed Claire cheekiness, left and right">
<figcaption>Same 0.8-second speech pose. FaceMesh/native detail, hair off, bright spokes.
The mouth close-up below makes the corner shift easier to compare.</figcaption></figure>
<figure><img src="mouth-detail.png" alt="Enlarged matched current and proposed mouth detail">
<figcaption>Same image crop and enlargement on both sides; no painted or AI-generated lips.</figcaption></figure>
<h2>See the difference while the lips move</h2>
<p>One silent, lossless frame sequence keeps both sides on the same timeline.
Press Play or scrub to a mouth shape. It samples 30-fps neural motion at 12 fps,
like the earlier review GIFs; it is not a full-rate display benchmark.
This fixed synthetic “Hey, how are you?” is not a saved conversation or audio audition.</p>
<canvas id="motion" width="1280" height="736" role="img"
aria-label="Current and sideways-pull Claire speech on the same timeline"></canvas>
<p><button id="play" disabled>Play motion</button> <button id="reset" disabled>Reset</button>
<label>Time <input id="seek" type="range" min="0" step="0.001" value="0" disabled></label>
<output id="time">Loading comparison frames...</output></p>
<p id="motion-error" class="note" role="alert" hidden></p>
<div class="grid">
<article><h2>Current Claire</h2><p><code>cheekiness</code> selects neural emotion channel 2.
At 4x, Verona amplifies that emotion's difference from the same-audio neutral prediction.
There is no authored sideways-smirk instruction in that channel mapping; any asymmetry
comes from the learned model. Existing speech, eyes and brows are the baseline here.</p></article>
<article><h2>Proposed sideways smirk</h2><p>Keep that exact baseline, then pull the
viewer-right mouth corner outward and upward with a smooth field extending into the
nearby cheek. Both lip sheets share the same rest-space field. Eyes, brows and the
rest of the head do not receive this added deformation.</p></article>
</div>
<h2>The MPFB pose you selected</h2>
<figure><img loading="lazy" src="reference.png" alt="Owner-selected native MPFB cheekiness wire and surface study">
<figcaption>Original check-speech-162.png, retained unchanged. Its label says native strength 1.00,
yaw -2 degrees and NO SPEECH RETARGETING. The two Claire panels above use the same zero-yaw
camera, so this reference is a visual direction, not a matched identity comparison.</figcaption></figure>
<p>The original recipe is <code>mouthSmileLeft: 0.9</code>,
<code>mouthDimpleLeft: 0.65</code>, opposite <code>browOuterUpRight: 0.7</code>
and <code>eyeSquintLeft: 0.35</code>. Despite the visual “lip stretch,” this is not
the native <code>mouthStretch</code> control. It is an asymmetric smile/dimple combination.
The new Claire preview approximates that mouth cue; it does not transfer the MPFB rig.</p>
<h2>What “everywhere” should mean</h2>
<p>Your preferred cheekiness vocabulary is recorded as <strong>sideways, asymmetric lip
stretch</strong>, not a generic bilateral smile. This comparison is the review step,
not a completed rollout or approval of this exact candidate.</p>
<ul><li><strong>Original Claire and Claire-based variants:</strong> use the same visible cue,
but adapt its placement after each variant's shape map and retain its actual speech.</li>
<li><strong>Native MPFB:</strong> preserve the selected native smile/dimple character while
blending speech; its current neural-transfer fit is different from the old static recipe.</li>
<li><strong>Robot:</strong> express the same one-sided smirk through its rigid mouth plates;
soft lip stretching is not mechanically available on that model.</li></ul>
<details><summary>Mechanism, evidence and limits</summary>
<p>The proposed field is fixed in Claire's original rest coordinates, with cubic smooth
falloff across the mouth and nearby front cheek. Its full-strength vector is
1.65 cm sideways and 1.05 cm up before quantization; depth is unchanged.
It is a deliberately visible design proposal, not calibrated facial anatomy.
The same field is added to each original decoded speech frame and packed back through
the existing Int16 format. It is not multiplied by 4 again.</p>
<p>All __FRAMES__ source frames and __VERTICES__ skin vertices were compared.
Maximum extra offset after packing: __OFFSET__ cm. __OUTSIDE__ vertices outside the
field are bit-identical in every packed frame. New near-collapses: __COLLAPSES__;
world-normal hemisphere changes: __NORMALS__. Hemisphere changes are diagnostic,
not by themselves proved inversions. Neither count proves lip contact or absence
of self-intersections. Hair/topology/eye bytes and the original source motion are retained.</p>
<p>The isolated capture uses the actual production WebGL renderer through a process-local
test reference, a new capability-protected loopback server and a disposable sandboxed
offscreen desktop profile. No protected manager/head is driven or restarted. Motion
is precomputed; the sampled movie is not a GPU/display-frame-rate qualification.
No microphone, camera, cloud model, download or sound autoplay is involved.</p>
<p>Source: <code>verona/engine.py:expression_condition, FaceEngine.generate</code>;
<code>scripts/mpfb_face_poses.mjs:FACE_POSES.cheekiness</code>;
<code>scripts/claire_cheekiness_study.py:sideways_lip_pull</code>;
<code>scripts/claire_cheekiness_study.cjs</code>. Report snapshot: __TIME__.
<a href="receipt.json">Geometry/source/isolation receipt</a> ·
<a href="capture.json">Browser/render/frame-sequence receipt</a>.</p>
</details>
<script>
const sequence=__SEQUENCE__, duration=__DURATION__, fps=12;
const canvas=document.getElementById("motion"),ctx=canvas.getContext("2d");
const play=document.getElementById("play"),seek=document.getElementById("seek");
const reset=document.getElementById("reset"),time=document.getElementById("time");
let images=[],position=0,raf=0,started=0,playing=false;
function draw(){
  const frame=Math.min(images.length-1,Math.floor(position*fps));
  ctx.drawImage(images[frame],0,0);seek.value=String(position);
  time.textContent=position.toFixed(2)+" / "+duration.toFixed(2)+" s";
}
function pause(){playing=false;cancelAnimationFrame(raf);play.textContent="Play motion";}
function tick(now){if(!playing)return;position=(Math.max(0,now-started)/1000)%duration;draw();raf=requestAnimationFrame(tick);}
play.onclick=()=>{if(playing){pause();return;}playing=true;started=performance.now()-position*1000;
  play.textContent="Pause";raf=requestAnimationFrame(tick);};
seek.oninput=()=>{pause();position=Number(seek.value);draw();};
reset.onclick=()=>{pause();position=0;draw();};
document.addEventListener("visibilitychange",()=>{if(document.hidden)pause();});
window.addEventListener("pagehide",pause);
Promise.all(sequence.map(async item=>{const image=new Image();image.src=item.filename;
  await image.decode();if(image.naturalWidth!==1280||image.naturalHeight!==736)
    throw Error("A comparison frame has unexpected dimensions.");return image;}))
.then(loaded=>{images=loaded;seek.max=String(duration-.001);draw();
  play.disabled=seek.disabled=reset.disabled=false;window.comparisonReady=true;})
.catch(error=>{const box=document.getElementById("motion-error");
  box.hidden=false;box.textContent="Motion could not load: "+error.message+
  " Keep the frames folder beside this report, then reload.";});
</script></html>"""
    for token, value in {
        "__FRAMES__": notes["frames"], "__VERTICES__": notes["vertices"],
        "__OFFSET__": f'{notes["maximumExtraOffsetCm"]:.3f}',
        "__OUTSIDE__": notes["unchangedOutsideFieldVertices"],
        "__COLLAPSES__": notes["newNearCollapses"],
        "__NORMALS__": notes["normalHemisphereChanges"], "__TIME__": receipt["generatedAt"],
        "__SEQUENCE__": json.dumps(capture["frames"]), "__DURATION__": capture["duration"],
    }.items():
        page = page.replace(token, str(value))
    (output / "review.html").write_text(page, encoding="utf-8")


def main():
    from datetime import datetime
    from verona.desktop import ELECTRON, stop_desktop
    from verona.engine import FaceEngine
    from verona.mesh import claire_topology
    from verona.server import Handler, LocalServer, State
    from verona.speech import installed_voices, preferred_voice, synthesize

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists():
        parser.error("Choose a new output directory; preserve earlier reports.")
    if not REFERENCE.is_file() or not ELECTRON.is_file():
        parser.error("The retained MPFB reference and prepared desktop are required; nothing is downloaded.")
    output.mkdir(parents=True)
    files = ("verona/engine.py", "verona/appearance.py", "verona/web/app.js",
             "verona/web/presentations.mjs", "scripts/mpfb_face_poses.mjs",
             "scripts/claire_cheekiness_study.py", "scripts/claire_cheekiness_study.cjs")
    hashes = {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in files}
    with (patch("verona.engine.claire_topology", side_effect=lambda n, s, c, f:
                claire_topology(n, s, output / "derived-cache", f)),
          patch("verona.speech.ROOT", output)):
        engine = FaceEngine()
        voices = installed_voices()
        speech = synthesize("Hey, how are you?", preferred_voice(voices), voices)
        clip = engine.generate(speech, "cheekiness", .6, expression_gain=4)
        candidate, geometry = make_candidate(engine, clip)
        data = {"metadata": clip.metadata, "current": base64.b64encode(clip.motion).decode("ascii"),
                "candidate": base64.b64encode(candidate).decode("ascii")}
        state = State(engine, voices)
        original_reply = Handler.reply

        def study_reply(handler, status, content, kind):
            if handler.path == "/app.js" and status == 200:
                lines = content.decode("utf-8").splitlines(keepends=True)
                matches = [i for i, line in enumerate(lines) if "renderer = new FaceRenderer(" in line]
                if len(matches) != 1:
                    raise RuntimeError("The reviewed renderer instrumentation anchor changed.")
                lines.insert(matches[0] + 1, "window.studyRenderer = renderer;\n"
                             f"window.cheekinessStudy = {json.dumps(data)};\n")
                content = "".join(lines).encode("utf-8")
            return original_reply(handler, status, content, kind)

        with patch.object(Handler, "reply", study_reply):
            server = LocalServer(0, state)
            thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": .05})
            thread.start()
            try:
                environment = {k: os.environ[k] for k in (
                    "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE",
                    "APPDATA", "LOCALAPPDATA", "PATH") if k in os.environ}
                environment["VERONA_LOCAL_URL"] = server.url
                with tempfile.TemporaryDirectory(prefix="owned-cheekiness-", dir=output) as profile:
                    with (output / "desktop-stderr.log").open("w") as log:
                        child = subprocess.Popen(
                            [str(ELECTRON), str(Path(__file__).with_suffix(".cjs")),
                             f"--user-data-dir={profile}", f"--output={output}",
                             "--force-device-scale-factor=1"],
                            cwd=ROOT, env=environment, stdout=log, stderr=log)
                        try:
                            child.wait(timeout=120)
                            if child.returncode:
                                raise RuntimeError(f"Capture failed; retain {output}.")
                        finally:
                            stop_desktop(child)
            finally:
                state.stop.set()
                server.shutdown()
                server.server_close()
                thread.join(timeout=10)
                if thread.is_alive():
                    raise RuntimeError("The owned comparison server did not stop.")
                state.clip = state.speech = None
    if hashes != {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in files}:
        raise RuntimeError("Reviewed source files changed during capture.")
    shutil.copyfile(REFERENCE, output / "reference.png")
    receipt = {
        "revision": REVISION, "generatedAt": datetime.now().astimezone().isoformat(),
        "baseCommit": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "sourceSha256": hashes, "geometry": geometry, "clip": clip.metadata,
        "referenceSha256": hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),
        "runtimeRollout": False, "sourceFilesUnchangedDuringCapture": True,
        "cleanup": {"serverStopped": True, "desktopStopped": True, "profileRemoved": True},
        "limits": "Report-only synthetic visual study; no owner, listening or contact acceptance.",
    }
    (output / "receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    write_report(output, receipt)
    print(json.dumps({"report": str(output / "review.html"), "geometry": geometry,
                      "cleanup": receipt["cleanup"]}))


if __name__ == "__main__":
    main()

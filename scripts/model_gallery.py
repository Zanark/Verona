"""Opt-in synthetic current-renderer gallery capture; never drive a live head."""

import argparse
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    "verona/engine.py", "verona/variants.py", "verona/appearance.py",
    "verona/web/app.js", "verona/web/blinking.mjs", "verona/web/mpfb.js",
    "verona/web/mpfb-renderer.mjs", "verona/web/presentations.mjs",
    "verona/web/hairstyles.mjs", "verona/web/framing.mjs", "scripts/mpfb_motion_transfer.py",
    "scripts/model_gallery.py", "scripts/model_gallery.cjs",
)


def save(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def capture(output, model, *, hairstyles=None, hair_only=False):
    subprocess.run(["node", "--check", str(Path(__file__).with_suffix(".cjs"))],
                   check=True, cwd=ROOT)
    os.environ.update(OPENBLAS_NUM_THREADS="2", OMP_NUM_THREADS="2")
    from verona.desktop import ELECTRON, stop_desktop
    from verona.engine import EXPRESSIONS, FaceEngine
    from verona.mesh import claire_topology
    from verona.server import Handler, LocalServer, State
    from verona.speech import installed_voices, preferred_voice, synthesize
    from verona.variants import prepare_variant

    if not ELECTRON.is_file():
        raise RuntimeError("Prepared local Electron is required; nothing is installed.")
    output.mkdir(parents=True, exist_ok=False)
    (output / "tmp").mkdir()
    hashes = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in SOURCES}
    with (patch("verona.engine.claire_topology", side_effect=lambda n, s, c, f:
                claire_topology(n, s, output / "derived-cache", f)),
          patch("verona.speech.ROOT", output)):
        engine = FaceEngine("mark" if model == "mark" else "claire")
        static = prepare_variant(engine, model)
        voices = installed_voices()
        speech = synthesize("Hey, how are you?", preferred_voice(voices), voices)
        clips = []
        routes = {}
        for expression in EXPRESSIONS:
            clip = engine.generate(speech, expression, .6, expression_gain=4)
            name = expression + ".bin"
            (output / name).write_bytes(clip.motion)
            routes["/gallery/" + name] = (name, "application/octet-stream")
            clips.append({"name": expression, "metadata": clip.metadata, "filename": name})
        catalog = {"model": model, "clips": clips, "voice": speech.voice,
                   "fixedSyntheticText": "Hey, how are you?", "previewFps": 10}
        if hairstyles is not None:
            catalog["hairstyles"] = hairstyles
        catalog["hairOnly"] = hair_only
        save(output / "clips.json", catalog)
        routes["/gallery/clips.json"] = ("clips.json", "application/json")
        state = State(engine, voices)
        state.static = static
        state.appearance = {"model": model, "session": "isolated-gallery", "colors": {}}

        class GalleryHandler(Handler):
            def do_GET(self):
                if self.path in routes:
                    if self.guard(authenticated=True):
                        name, kind = routes[self.path]
                        self.reply(200, (output / name).read_bytes(), kind)
                else:
                    super().do_GET()

            def reply(self, status, content, kind):
                if self.path == "/app.js" and status == 200:
                    content += b"\nwindow.galleryRenderer=renderer;\n"
                super().reply(status, content, kind)

        server = LocalServer(0, state)
        server.RequestHandlerClass = GalleryHandler
        thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": .05})
        thread.start()
        try:
            environment = {key: os.environ[key] for key in (
                "SystemRoot", "SystemDrive", "WINDIR", "USERPROFILE", "APPDATA",
                "LOCALAPPDATA", "PATH") if key in os.environ}
            environment.update(VERONA_LOCAL_URL=server.url, TEMP=str(output / "tmp"),
                               TMP=str(output / "tmp"))
            with tempfile.TemporaryDirectory(prefix="owned-gallery-", dir=output) as profile:
                with (output / "desktop.log").open("w", encoding="utf-8") as log:
                    child = subprocess.Popen(
                        [str(ELECTRON), str(Path(__file__).with_suffix(".cjs")),
                         f"--user-data-dir={profile}", f"--output={output}",
                         "--force-device-scale-factor=1"],
                        cwd=ROOT, env=environment, stdout=log, stderr=log)
                    try:
                        if child.wait(timeout=300):
                            raise RuntimeError(f"Gallery capture failed; retain {output}.")
                    finally:
                        stop_desktop(child)
        finally:
            state.stop.set()
            server.shutdown()
            server.server_close()
            thread.join(timeout=10)
            if thread.is_alive():
                raise RuntimeError("The owned gallery server failed to stop.")
            state.clip = state.speech = None
    if hashes != {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in SOURCES}:
        raise RuntimeError("Gallery source changed during capture; preserve this failed run.")
    save(output / "receipt.json", {
        "createdAt": datetime.now().astimezone().isoformat(), "model": model,
        "baseCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "sourceSha256": hashes, "clips": clips, "voice": speech.voice,
        "audioPcmSha256": hashlib.sha256(speech.pcm).hexdigest(),
        "isolation": "One selected CPU engine/adapter, synthetic greeting, private derived cache/server/profile; no live head driven.",
        "cleanup": {"serverStopped": True, "desktopStopped": True, "profileRemoved": True},
        "limits": "Silent sampled GIF authoring, not runtime FPS, listening or human accuracy/identity acceptance.",
    })
    print(json.dumps({"model": model, "capture": str(output), "clips": len(clips)}))


def encode(output, capture_name="capture.json", verification_name="gif-verification.json"):
    from PIL import Image, ImageChops

    capture = json.loads((output / capture_name).read_text(encoding="utf-8"))
    clips = capture["clips"]
    if not clips:
        if not capture.get("hairstyles"):
            raise ValueError("Gallery capture contains no speech clips or hairstyles.")
        for hair in capture["hairstyles"]:
            encode(output, hair["capture"], hair["verification"])
        return
    # One shared palette includes every expression, not just the first pose.
    swatch = Image.new("RGB", (240 * len(clips), 270))
    for index, clip in enumerate(clips):
        with Image.open(output / clip["images"][len(clip["images"]) // 2]) as image:
            swatch.paste(image.convert("RGB").resize((240, 270)), (index * 240, 0))
    palette = swatch.quantize(colors=256)
    entries, durations = [], []
    for clip in clips:
        count = len(clip["images"])
        boundaries = [round(index * clip["duration"] * 100 / count) for index in range(count + 1)]
        for filename, a, b in zip(clip["images"], boundaries, boundaries[1:]):
            if b <= a:
                raise ValueError("GIF frame durations must be positive centiseconds.")
            entries.append(filename)
            durations.append((b - a) * 10)

    def frame(filename):
        with Image.open(output / filename) as image:
            return image.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE)

    target = output / capture.get("filename", f"model-vr67-{capture['model']}.gif")
    first = frame(entries[0])
    first.save(target, save_all=True, append_images=(frame(name) for name in entries[1:]),
               duration=durations, loop=0, optimize=True, disposal=1)
    elapsed = expected_time = 0
    changed = False
    with Image.open(target) as gif:
        if gif.size != tuple(capture["dimensions"]) or gif.info.get("loop") != 0:
            raise ValueError("Wrong gallery dimensions or loop metadata.")
        decoded_count = gif.n_frames
        index = 0
        gif.seek(index)
        decoded = gif.convert("RGB")
        elapsed = gif.info["duration"]
        for filename, duration in zip(entries, durations):
            while expected_time >= elapsed:
                index += 1
                gif.seek(index)
                decoded = gif.convert("RGB")
                elapsed += gif.info["duration"]
            expected = frame(filename).convert("RGB")
            if ImageChops.difference(expected, decoded).getbbox():
                raise ValueError(f"{target.name}: encoded sample differs at {expected_time}ms.")
            changed |= bool(ImageChops.difference(first.convert("RGB"), decoded).getbbox())
            expected_time += duration
        if elapsed != expected_time or index + 1 != decoded_count or not changed:
            raise ValueError("GIF lost timeline duration, samples or visible animation.")
    save(output / verification_name, {
        "model": capture["model"], "filename": target.name,
        **({"hairstyle": capture["hairstyle"]} if "hairstyle" in capture else {}),
        "dimensions": capture["dimensions"], "sourceFrames": len(entries),
        "encodedFrames": decoded_count, "durationMs": elapsed,
        "everySourceSampleMatchesEncodedTimeline": True,
        "bytes": target.stat().st_size, "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        "emotions": [clip["name"] for clip in clips],
        "views": capture["views"], "silent": True,
        "encoderSourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    })
    print(json.dumps({"gif": str(target), "bytes": target.stat().st_size, "durationMs": elapsed}))
    for hair in capture.get("hairstyles", []):
        encode(output, hair["capture"], hair["verification"])


def main():
    from verona.session_config import MODELS
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", choices=tuple(MODELS))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--encode", action="store_true")
    args = parser.parse_args()
    if args.encode:
        encode(args.output.resolve())
    elif args.model:
        capture(args.output.resolve(), args.model)
    else:
        parser.error("--model is required for capture")


if __name__ == "__main__":
    main()

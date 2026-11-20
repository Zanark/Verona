"""Opt-in adapters for the already-authored local head variants."""

import hashlib
import time


def prepare_variant(engine, model):
    if model == "mpfb":
        from scripts.mpfb_motion_transfer import apply_transfer
        apply_transfer(engine)
        return {
            "/": ("mpfb.html", "text/html; charset=utf-8"),
            "/app.js": ("mpfb.js", "text/javascript; charset=utf-8"),
            "/style.css": ("mpfb.css", "text/css; charset=utf-8"),
            "/mpfb-renderer.mjs": ("mpfb-renderer.mjs", "text/javascript; charset=utf-8"),
        }
    if model in ("reference-structure", "reference-shell"):
        from scripts.claire_reference_study import apply_reference
        apply_reference(engine, fit=model.split("-")[1])
    elif model == "male-sharp":
        import numpy as np
        from scripts.male_sharp_jawline import sculpt_positions
        from .engine import Clip, QUANTIZATION, pack_positions

        size = len(engine.selected) * 6
        engine.mesh_bytes = pack_positions(
            sculpt_positions(engine.neutral), engine.center, engine.scale) + engine.mesh_bytes[size:]
        engine.mesh_metadata = {**engine.mesh_metadata, "appearance": "Male-SharpJawline / preserved sculpt"}
        generate = engine.generate

        def mapped(speech, expression="neutral", intensity=.35, stop=None, *, expression_gain=4):
            clip = generate(speech, expression, intensity, stop, expression_gain=expression_gain)
            started = time.perf_counter()
            motion = bytearray()
            for frame in np.frombuffer(clip.motion, dtype="<i2").reshape(-1, len(engine.selected), 3):
                if stop is not None and stop.is_set():
                    raise RuntimeError("Named sculpt session cancelled.")
                world = frame / QUANTIZATION * engine.scale + engine.center
                motion.extend(pack_positions(sculpt_positions(world), engine.center, engine.scale))
            return Clip(clip.id, clip.audio, bytes(motion), {
                **clip.metadata, "appearance": engine.mesh_metadata["appearance"],
                "motionSha256": hashlib.sha256(motion).hexdigest(),
                "generationSeconds": clip.metadata["generationSeconds"] + time.perf_counter() - started,
            })
        engine.generate = mapped
    elif model not in ("claire", "robot"):
        raise ValueError("Unknown named head variant.")
    return {}

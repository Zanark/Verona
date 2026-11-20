"""Opt-in MPFB-reference complete-pose mapping over Claire's neural speech."""

import argparse
import hashlib
import json
from pathlib import Path
import tempfile
from unittest.mock import patch

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / ".local/qualification/mpfb-head-04/authored/head.json"
REFERENCE_SHA256 = "a0f1cd734f24fa692e65cca6baff09f9a346ca17f6171bf15b967077c6af5305"
REVISION = "claire-mpfb-reference-2"
SHAPE_WEIGHT = .7
EYES = np.array([[-2.9485, 147.5517, 2.2364], [3.1021, 147.4944, 2.2830]])


def _positions(value):
    if (not isinstance(value, np.ndarray) or value.ndim != 2 or value.shape[1] != 3
            or not len(value) or not np.issubdtype(value.dtype, np.number)
            or np.iscomplexobj(value) or not np.isfinite(value).all()):
        raise ValueError("Reference fitting requires nonempty finite real XYZ positions.")
    return value.astype(np.float64)


def _smooth(low, high, value):
    t = np.clip((value - low) / (high - low), 0, 1)
    return t * t * (3 - 2 * t)


def reference_warp(rest, reference, reference_eyes):
    """Fit a smooth complete-pose map, retaining original indices and inference.

    Cross-sections are approximate geometric correspondences, not anatomical
    registration. Lip and lid cores retain a shared translation/identity so
    fitting the outer shell cannot independently pull apart opposing sheets.
    """
    source, target, eyes = map(_positions, (rest, reference, reference_eyes))
    if eyes.shape != (2, 3) or abs(eyes[0, 0] - eyes[1, 0]) < 1:
        raise ValueError("Reference requires two separated eye anchors in centimeters.")
    scale = abs(EYES[1, 0] - EYES[0, 0]) / abs(eyes[1, 0] - eyes[0, 0])
    target = (target - eyes.mean(0)) * scale + EYES.mean(0)
    cx, ey, _ = EYES.mean(0)

    def orbital_front(points):
        area = points[(abs(abs(points[:, 0] - cx) - 3) < 1)
                      & (abs(points[:, 1] - ey) < .7) & (points[:, 2] > 0)]
        if len(area) < 8:
            raise ValueError("Reference has insufficient orbital surface samples.")
        return float(np.percentile(area[:, 2], 90))

    depth_alignment = orbital_front(source) - orbital_front(target)
    target[:, 2] += depth_alignment
    heights = np.array([128, 133, 135.7, 140.15, 144.1, ey, 151, 154, 157.9, 162])
    destinations = np.array([128, 133, 136.7, 141.1, 144.1, ey, 151.2, 154.6, 158.8, 162])
    controls, offsets = [], []

    def section(points, y):
        band = points[(abs(points[:, 1] - y) < .85) & (points[:, 2] > 0)
                      & (abs(points[:, 0] - cx) < 8)]
        if len(band) < 5:
            raise ValueError("Reference has insufficient face cross-section samples.")
        return band, float(np.percentile(abs(band[:, 0] - cx), 98))

    def front(band, x):
        local = band[abs(band[:, 0] - x) < .9]
        if not len(local):
            raise ValueError("Reference face cross-section has an unsupported surface gap.")
        return float(np.percentile(local[:, 2], 90))

    for y in np.arange(136, 156, 1.5):
        ty = float(np.interp(y, heights, destinations))
        old, width = section(source, y)
        new, target_width = section(target, ty)
        for fraction in (-.85, -.55, -.25, 0, .25, .55, .85):
            x, tx = cx + fraction * width, cx + fraction * target_width
            controls.append([x, y])
            offsets.append([tx - x, ty - y, front(new, tx) - front(old, x)])
    controls, offsets = np.array(controls), np.array(offsets)
    lengths = np.array([2.6, 2.4])

    def kernel(x):
        dx = (x[:, None, 0] - controls[:, 0]) / lengths[0]
        dy = (x[:, None, 1] - controls[:, 1]) / lengths[1]
        return np.exp(-.5 * (dx * dx + dy * dy))

    weights = np.linalg.solve(kernel(controls) + .08 * np.eye(len(controls)), offsets)
    x, y, z = source.T
    lip_samples = kernel(source[(abs(x - cx) < 1.5) & (abs(y - 140.15) < .7)
                                & (z > 2), :2]) @ weights
    if not len(lip_samples):
        raise ValueError("Claire rest has insufficient lip-core surface samples.")
    mouth_shift = np.array([0, .95, float(np.median(lip_samples[:, 2]))])
    def warp(positions):
        points = _positions(positions)
        x, y, z = points.T
        front_weight = _smooth(-3, 0, z) * _smooth(132, 136, y)
        mouth = ((1 - _smooth(3.0, 4.1, abs(x - cx)))
                 * (1 - _smooth(1.25, 2.2, abs(y - 140.15))) * front_weight)
        lids = ((1 - _smooth(5.5, 6.5, abs(x - cx)))
                * (1 - _smooth(1.0, 1.65, abs(y - ey))) * front_weight)
        delta = np.zeros_like(points)
        active = np.flatnonzero((front_weight != 0) & (mouth != 1) & (lids != 1))
        for start in range(0, len(active), 512):
            indices = active[start:start + 512]
            delta[indices] = kernel(points[indices, :2]) @ weights
        delta *= front_weight[:, None]
        delta = delta * (1 - mouth[:, None]) + mouth[:, None] * mouth_shift
        delta *= (1 - lids[:, None]) * SHAPE_WEIGHT
        fitted = points + delta
        if not np.isfinite(fitted).all() or np.max(np.linalg.norm(delta, axis=1)) > 3:
            raise ValueError("Reference map exceeds the three-centimeter displacement bound.")
        return fitted

    fitted = warp(source)
    return warp, {
        "revision": REVISION, "vertices": len(source), "controls": len(controls),
        "shapeWeight": SHAPE_WEIGHT,
        "referenceEyeScale": float(scale), "orbitalDepthAlignmentCm": depth_alignment,
        "heightCorrespondencesCm": list(zip(heights.tolist(), destinations.tolist())),
        "maximumRestOffsetCm": float(np.max(np.linalg.norm(fitted - source, axis=1))),
        "mouthCoreTranslationCm": (mouth_shift * SHAPE_WEIGHT).tolist(),
        "limits": "Approximate front-shell fit with protected lip/lid cores; not exact "
                  "MPFB correspondence, contact proof, accepted identity or neural retargeting.",
    }


def fit_reference(rest, reference, reference_eyes):
    warp, receipt = reference_warp(rest, reference, reference_eyes)
    return warp(rest), receipt


def apply_reference(engine, path=REFERENCE):
    import time
    from verona.engine import Clip, QUANTIZATION, pack_positions

    raw = Path(path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != REFERENCE_SHA256:
        raise ValueError("MPFB reference changed; re-author and review a new pinned study.")
    model = json.loads(raw)
    warp, receipt = reference_warp(engine.neutral, np.array(model["rest"]).reshape(-1, 3),
                                  np.array(model["eyeCenters"]))
    fitted = warp(engine.neutral)
    size = len(engine.selected) * 3 * 2
    engine.mesh_bytes = pack_positions(fitted, engine.center, engine.scale) + engine.mesh_bytes[size:]
    engine.mesh_metadata = {**engine.mesh_metadata,
                            "appearance": "UNACCEPTED Claire / MPFB-reference head study",
                            "referenceStudy": receipt}
    generate = engine.generate

    def generate_mapped(speech, expression="neutral", intensity=.35, stop=None, *,
                        expression_gain=4):
        clip = generate(speech, expression, intensity, stop, expression_gain=expression_gain)
        positions = np.frombuffer(clip.motion, dtype="<i2").reshape(-1, len(engine.selected), 3)
        started = time.perf_counter()
        motion = bytearray()
        for frame in positions:
            if stop is not None and stop.is_set():
                raise RuntimeError("Reference generation stopped with its owned server.")
            world = frame / QUANTIZATION * engine.scale + engine.center
            motion.extend(pack_positions(warp(world), engine.center, engine.scale))
        elapsed = time.perf_counter() - started
        return Clip(clip.id, clip.audio, bytes(motion), {
            **clip.metadata, "appearance": engine.mesh_metadata["appearance"],
            "motionSha256": hashlib.sha256(motion).hexdigest(),
            "referenceMapSeconds": elapsed,
            "generationSeconds": clip.metadata["generationSeconds"] + elapsed,
            "referenceStudy": receipt,
        })

    engine.generate = generate_mapped
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", type=Path, default=REFERENCE)
    args = parser.parse_args()
    from verona.desktop import run_desktop
    from verona.engine import FaceEngine
    from verona.mesh import claire_topology
    from verona.server import Handler, State
    from verona.speech import installed_voices

    # Reuse the production protocol/lifecycle, not its mutable cache/speech lane.
    with tempfile.TemporaryDirectory(prefix="verona-reference-") as directory:
        owned = Path(directory)
        reply = Handler.reply

        def study_reply(handler, status, content, kind):
            if status == 200 and handler.path == "/":
                content = content.replace(b"local speaking-face prototype",
                                          b"UNACCEPTED Claire / MPFB reference study")
                content = content.replace(b'value="2" selected', b'value="2"')
                content = content.replace(b'value="4">4x', b'value="4" selected>4x')
            elif status == 200 and handler.path == "/app.js":
                anchor = b'  renderer = new FaceRenderer($("face"), session.mesh, binary);'
                if content.count(anchor) != 1:
                    raise ValueError("Study UI initialization changed; requalify its defaults.")
                content = content.replace(anchor, anchor + b'\n'
                    b'  renderer.setPresentation("facemesh"); renderer.setDetail(5);\n'
                    b'  renderer.setHairVisible(false); $("eye-glow").value = "1";\n')
            return reply(handler, status, content, kind)

        with (patch("verona.engine.claire_topology", side_effect=lambda n, s, c, f:
                    claire_topology(n, s, owned / "cache", f)),
              patch("verona.speech.ROOT", owned), patch.object(Handler, "reply", study_reply)):
            engine = FaceEngine()
            receipt = apply_reference(engine, args.reference)
            print(json.dumps(receipt), flush=True)
            run_desktop(State(engine, installed_voices()))


if __name__ == "__main__":
    main()

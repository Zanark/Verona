"""Transfer complete Claire trajectories onto the original, distinct MPFB surface."""

import hashlib
import heapq
import json
import time
from pathlib import Path

import numpy as np

from scripts.claire_reference_study import EYES, REFERENCE, REFERENCE_SHA256, _positions, _smooth
from scripts.claire_structural_fit import _faces, fit_model
from scripts.claire_surface_fit import closest_surface


REVISION = "mpfb-claire-native-rig-transfer-2"


def native_rig_fit(model):
    rest = _positions(np.array(model["rest"]).reshape(-1, 3))
    names = [name for name, delta in model["basis"].items() if np.any(delta)]
    if not names:
        raise ValueError("Native rig requires at least one active control.")
    basis = np.array([model["basis"][name] for name in names], dtype=float).T
    if basis.shape != (rest.size, len(names)) or not np.isfinite(basis).all():
        raise ValueError("Native rig controls must retain finite rest correspondence.")
    gram = basis.T @ basis
    ridge = float(np.trace(gram) / len(names) * .001)
    regularized = gram + np.eye(len(names)) * ridge
    step = 1 / np.linalg.eigvalsh(regularized)[-1]

    def fit(positions, stop=None):
        positions = np.asarray(positions, dtype=float)
        if positions.ndim != 3 or positions.shape[1:] != rest.shape or not np.isfinite(positions).all():
            raise ValueError("Native rig fitting requires finite complete native trajectories.")
        target = (positions - rest).reshape(len(positions), -1)
        rhs = target @ basis
        weights = np.zeros_like(rhs)
        momentum, acceleration = weights.copy(), 1.
        for _ in range(160):
            if stop is not None and stop.is_set():
                raise RuntimeError("Native rig fitting stopped with its owned session.")
            updated = np.clip(momentum + step * (rhs - momentum @ regularized), 0, 1)
            next_acceleration = (1 + np.sqrt(1 + 4 * acceleration ** 2)) / 2
            momentum = updated + (acceleration - 1) / next_acceleration * (updated - weights)
            weights, acceleration = updated, next_acceleration
        result = rest + (weights @ basis.T).reshape(positions.shape)
        return result, {
            "activeNativeControls": len(names), "maximumWeight": float(weights.max()),
            "boundedWeightSamples": int(np.count_nonzero(weights >= 1 - 1e-8)),
            "nativeWeightRange": [0, 1],
            "residualRmsCm": float(np.sqrt(np.mean((result - positions) ** 2))),
            "method": "160-step accelerated bounded nonnegative least-squares on the native faceunit basis; no emotion recipes.",
            "limits": "Projects actual neural trajectories into a limited native rig; loses unsupported detail and does not solve contacts.",
        }

    return fit


def surface_binding(source, faces, target):
    source, target = map(_positions, (source, target))
    faces = _faces(faces, len(source))
    corners = source[faces]
    area = np.linalg.norm(np.cross(corners[:, 1] - corners[:, 0],
                                   corners[:, 2] - corners[:, 0]), axis=1)
    valid = np.flatnonzero(area > 1e-8)
    if not len(valid):
        raise ValueError("Motion binding requires a nondegenerate source surface.")
    low, high = corners.min(1), corners.max(1)
    centers = (low + high) / 2
    nodes = []

    def build(ids):
        index = len(nodes)
        node = [low[ids].min(0), high[ids].max(0), None, None]
        nodes.append(node)
        if len(ids) <= 16:
            node[2] = ids
        else:
            axis = int(np.argmax(np.ptp(centers[ids], axis=0)))
            ids = ids[np.argsort(centers[ids, axis], kind="stable")]
            middle = len(ids) // 2
            node[3] = (build(ids[:middle]), build(ids[middle:]))
        return index

    build(valid)
    selected, weights, distances = [], [], []
    for point in target:
        def distance(index):
            node = nodes[index]
            gap = np.maximum(np.maximum(node[0] - point, point - node[1]), 0)
            return float(gap @ gap)

        pending, best, chosen, nearest = [(distance(0), 0)], np.inf, None, None
        while pending:
            bound, index = heapq.heappop(pending)
            if bound > best:
                break
            node = nodes[index]
            if node[2] is None:
                for child in node[3]:
                    lower = distance(child)
                    if lower <= best:
                        heapq.heappush(pending, (lower, child))
            else:
                ids = node[2]
                position, face = closest_surface(point[None], source, faces[ids], return_faces=True)
                square = float(np.sum((position[0] - point) ** 2))
                if square < best:
                    best, chosen, nearest = square, int(ids[face[0]]), position[0]
        if chosen is None:
            raise ValueError("Motion binding found no finite source triangle.")
        a, b, c = corners[chosen]
        ab, ac, ap = b - a, c - a, nearest - a
        aa, bb, cc = ab @ ab, ab @ ac, ac @ ac
        denominator = aa * cc - bb * bb
        if denominator <= 0:
            raise ValueError("Motion binding selected a singular source triangle.")
        u = (cc * (ap @ ab) - bb * (ap @ ac)) / denominator
        v = (aa * (ap @ ac) - bb * (ap @ ab)) / denominator
        bary = np.array([1 - u - v, u, v])
        if np.min(bary) < -1e-5 or not np.isfinite(bary).all():
            raise ValueError("Motion binding produced invalid barycentric coordinates.")
        bary = np.clip(bary, 0, 1)
        selected.append(chosen)
        weights.append(bary / bary.sum())
        distances.append(np.sqrt(best))
    return faces[selected], np.array(weights), np.array(distances)


def bind_motion(source_rest, source_faces, target_rest, *, warp=lambda points: points, influence=None):
    source_rest, target_rest = map(_positions, (source_rest, target_rest))
    influence = np.ones(len(target_rest)) if influence is None else np.asarray(influence, dtype=float)
    if (influence.shape != (len(target_rest),) or not np.isfinite(influence).all()
            or np.any(influence < 0) or np.any(influence > 1) or not np.any(influence)):
        raise ValueError("Motion influence must contain finite bounded target weights.")
    active = np.flatnonzero(influence > 0)
    fitted = warp(source_rest)
    indices, weights, distance = surface_binding(fitted, source_faces, target_rest[active])
    if distance.max() > 3:
        raise ValueError("Motion attachment exceeds the three-centimeter registration bound.")
    rest_samples = np.sum(fitted[indices] * weights[..., None], axis=1)
    unique, inverse = np.unique(indices, return_inverse=True)
    inverse = inverse.reshape(indices.shape)

    def transfer(positions):
        positions = _positions(positions)
        if positions.shape != source_rest.shape:
            raise ValueError("Motion frame must retain the bound Claire vertex correspondence.")
        samples = warp(positions[unique])[inverse]
        delta = np.sum(samples * weights[..., None], axis=1) - rest_samples
        if not np.isfinite(delta).all() or np.linalg.norm(delta, axis=1).max() > 8:
            raise ValueError("Transferred motion exceeds its finite eight-centimeter bound.")
        result = target_rest.copy()
        result[active] += delta * influence[active, None]
        return result

    return transfer, {
        "revision": REVISION, "sourceVertices": len(source_rest), "targetVertices": len(target_rest),
        "boundSourceVertices": len(unique), "attachmentMaximumCm": float(distance.max()),
        "attachmentMedianCm": float(np.median(distance)),
        "fixedTargetVertices": len(target_rest) - len(active),
        "binding": "Fixed closest-triangle convex barycentric displacement embedding, accelerated by exact AABB bounds.",
        "restPreservation": "Original target rest plus transferred complete-pose displacement, not source rest substitution.",
        "limits": "Geometric attachment, not semantic correspondence, contact correction or accepted emotion/identity accuracy.",
    }


def apply_transfer(engine, path=REFERENCE):
    from verona.engine import Clip, QUANTIZATION

    started = time.perf_counter()
    raw = Path(path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != REFERENCE_SHA256:
        raise ValueError("MPFB asset changed; review and pin a new transfer study.")
    model = json.loads(raw)
    rest = _positions(np.array(model["rest"]).reshape(-1, 3))
    warp, registration = fit_model(engine.neutral, engine.triangles, model)
    eyes = np.array(model["eyeCenters"])
    scale = abs(EYES[1, 0] - EYES[0, 0]) / abs(eyes[1, 0] - eyes[0, 0])
    origin = eyes.mean(0)
    offset = EYES.mean(0).copy()
    offset[2] += registration["orbitalDepthAlignmentCm"]
    aligned = (rest - origin) * scale + offset
    transfer, receipt = bind_motion(engine.neutral, engine.triangles, aligned, warp=warp,
                                    influence=_smooth(132, 136, aligned[:, 1]))
    receipt.update(fitSeconds=time.perf_counter() - started, registration=registration,
                   assetSha256=REFERENCE_SHA256, nativePolygons=len(model["polygons"]))
    fit_native = native_rig_fit(model)
    receipt["outputRig"] = "51 active native faceunits, fitted to actual transferred trajectories; no authored emotion recipes."
    generate = engine.generate
    native = {k: model[k] for k in ("rest", "polygons", "eyeCenters", "eyeRadii")}
    engine.mesh_bytes = json.dumps(native, allow_nan=False).encode()
    engine.mesh_metadata = {"identity": "Original MPFB head 1, driven by Claire neural motion",
                            "vertices": len(rest), "transfer": receipt}

    def generate_transferred(speech, expression="neutral", intensity=.35, stop=None, *,
                             expression_gain=4):
        clip = generate(speech, expression, intensity, stop, expression_gain=expression_gain)
        frames = np.frombuffer(clip.motion, dtype="<i2").reshape(-1, len(engine.selected), 3)
        started = time.perf_counter()
        motion = bytearray()
        for frame in frames:
            if stop is not None and stop.is_set():
                raise RuntimeError("MPFB motion transfer stopped with its owned session.")
            positions = frame / QUANTIZATION * engine.scale + engine.center
            result = (transfer(positions) - offset) / scale + origin
            packed = np.asarray(result, dtype="<f4")
            if not np.isfinite(packed).all():
                raise ValueError("Native motion cannot be represented as finite Float32 coordinates.")
            motion.extend(packed.tobytes())
        native_positions = np.frombuffer(motion, dtype="<f4").reshape(-1, len(rest), 3)
        fitted, rig_receipt = fit_native(native_positions, stop)
        packed = np.asarray(fitted, dtype="<f4")
        if not np.isfinite(packed).all():
            raise ValueError("Native rig motion cannot be represented as finite Float32 coordinates.")
        motion = packed.tobytes()
        elapsed = time.perf_counter() - started
        metadata = {k: v for k, v in clip.metadata.items()
                    if k not in ("quantization", "maximumSkinChangeCm", "appearance")}
        return Clip(clip.id, clip.audio, bytes(motion), {
            **metadata, "identity": engine.mesh_metadata["identity"],
            "appearance": "Original pinned MPFB rest and native polygons; transferred neural displacement.",
            "sourceClaireMaximumSkinChangeCm": clip.metadata["maximumSkinChangeCm"],
            "nativeRigFit": rig_receipt,
            "vertices": len(rest), "frameFormat": "float32-native-cm",
            "transfer": receipt, "sourceMotionSha256": clip.metadata["motionSha256"],
            "motionSha256": hashlib.sha256(motion).hexdigest(), "motionBytes": len(motion),
            "transferSeconds": elapsed, "generationSeconds": clip.metadata["generationSeconds"] + elapsed,
        })

    engine.generate = generate_transferred
    return receipt

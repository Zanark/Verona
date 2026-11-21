"""Offline CPU speech-to-native-geometry clips; no network or asset download."""

from dataclasses import asdict, dataclass
import hashlib
import threading
import time
import uuid

from scripts.probe_cpu import (
    FRAME_RATE, SAMPLE_RATE, audio_window, conditioning, create_cpu_session, verify,
)
from scripts.fetch_claire_model import ASSETS, DESTINATION, REVISION
from scripts.fetch_face_mesh import REVISION as MESH_REVISION
from scripts.fetch_cpu_model import ROOT

import numpy as np

from .appearance import claire_eyes, claire_hair, native_hair_scale, verona_rest_shape
from .mesh import claire_topology, read_mesh
from .speech import Speech


QUANTIZATION = 8192
EXPRESSIONS = {
    "neutral": None, "happy": 6, "sad": 9, "surprised": 0, "angry": 1,
    "cheekiness": 2, "disgust": 3, "fear": 4, "grief": 5, "outofbreath": 7, "pain": 8,
}
EXPRESSION_GAIN = 2.0
BATCH_SIZE = 4


def validate_expression_gain(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value not in (2, 4):
        raise ValueError("Choose 2x or 4x emotion exaggeration.")
    return float(value)


def expression_condition(neutral: np.ndarray, name: object, intensity: object) -> np.ndarray:
    if not isinstance(name, str) or name not in EXPRESSIONS:
        raise ValueError(f"Choose one expression: {', '.join(EXPRESSIONS)}.")
    if (isinstance(intensity, bool) or not isinstance(intensity, (int, float))
            or not np.isfinite(intensity) or not 0 <= intensity <= 0.6):
        raise ValueError("Expression strength must be between 0 and 0.6.")
    result = neutral.copy()
    index = EXPRESSIONS[name]
    if index is not None:
        result[0, 0, 16 + index] = intensity
    return result


def pack_positions(vertices: np.ndarray, center: np.ndarray, scale: float) -> bytes:
    normalized = (vertices - center) / scale
    quantized = np.rint(normalized * QUANTIZATION)
    if not np.isfinite(quantized).all() or np.max(np.abs(quantized)) > 32767:
        raise ValueError("Geometry exceeds the clip's finite coordinate bounds.")
    return quantized.astype("<i2").tobytes()


def mesh_payload(rest, edges, triangles, center, scale, *, eyes=None, hair_scale=1.0):
    """Pack one selected model into the shared skin/hair/optics contract."""
    edges, triangles = np.asarray(edges, dtype="<u4"), np.asarray(triangles, dtype="<u4")
    positions = pack_positions(rest, center, scale)
    edge_offset = (len(positions) + 3) & ~3
    triangle_offset = edge_offset + edges.nbytes
    binary = positions + bytes(edge_offset - len(positions)) + edges.tobytes() + triangles.tobytes()
    hair, hair_edges, hair_triangles = claire_hair()
    if hair_scale != 1.0:
        anchor = np.array([0, 148.2, -5.7])
        hair = (hair - anchor) * hair_scale + anchor
    hair_positions = pack_positions(hair, center, scale)
    hair_position_offset = len(binary)
    hair_edge_offset = (hair_position_offset + len(hair_positions) + 3) & ~3
    hair_triangle_offset = hair_edge_offset + hair_edges.nbytes
    binary += (hair_positions + bytes(hair_edge_offset - hair_position_offset - len(hair_positions))
               + hair_edges.tobytes() + hair_triangles.tobytes())
    eye_vertices, eye_triangles = claire_eyes() if eyes is None else claire_eyes(*eyes)
    eye_positions = pack_positions(eye_vertices, center, scale)
    eye_position_offset = len(binary)
    eye_triangle_offset = (eye_position_offset + len(eye_positions) + 3) & ~3
    binary += (eye_positions + bytes(eye_triangle_offset - eye_position_offset - len(eye_positions))
               + eye_triangles.tobytes())
    return binary, {
        "vertices": len(rest), "edges": len(edges), "triangles": len(triangles),
        "quantization": QUANTIZATION, "center": center.tolist(), "scale": scale,
        "edgeOffset": edge_offset, "triangleOffset": triangle_offset, "bytes": len(binary),
        "hair": {
            "vertices": len(hair), "edges": len(hair_edges), "triangles": len(hair_triangles),
            "positionOffset": hair_position_offset, "edgeOffset": hair_edge_offset,
            "triangleOffset": hair_triangle_offset, "scale": hair_scale,
        },
        "eyes": {
            "vertices": len(eye_vertices), "triangles": len(eye_triangles),
            "positionOffset": eye_position_offset, "triangleOffset": eye_triangle_offset,
            "animation": "static cosmetic eyes; no independent gaze or eye-joint prediction",
        },
    }


@dataclass(frozen=True)
class Clip:
    id: str
    audio: bytes
    motion: bytes
    metadata: dict


class FaceEngine:
    motion_mapper = None
    input_strength = 1.0
    identity = "Claire v2.3.1"
    appearance = "Verona: reference-guided appearance study over unchanged Claire motion basis"

    def __init__(self, model="claire") -> None:
        if model not in ("claire", "mark"):
            raise ValueError("Choose the Claire or Mark neural engine before loading weights.")
        assets, destination, revision = ASSETS, DESTINATION, REVISION
        scene, components, shot, source_frame = "claire_geom_v2_topo1.ma", 140, "cp1_neutral", 212
        transform = None
        eyes = None
        if model == "mark":
            from scripts import fetch_cpu_model as mark
            from scripts.fetch_face_mesh import SIZE, SHA256

            assets, destination, revision = mark.ASSETS, mark.DESTINATION, mark.REVISION
            scene, components, shot, source_frame = "mark_geom_v2_topo1.ma", 272, "g2a_neutral", 33
            verify(destination / scene, SIZE, SHA256)
            centers, radii = [], []
            for node in ("r_choroid_hiShape", "l_choroid_hiShape"):
                points, _, _ = read_mesh(destination / scene, node)
                centers.append((points.min(0) + points.max(0)) / 2)
                radii.append(np.ptp(points, axis=0) / 2)
            centers, radii = np.asarray(centers), np.asarray(radii)
            source_origin = centers.mean(0)
            render_origin = np.array([.0768, 147.52305, 2.2597])
            render_scale = 6.0506 / abs(centers[1, 0] - centers[0, 0])
            transform = (source_origin, render_origin, render_scale)
            eyes = ((centers - source_origin) * render_scale + render_origin, radii * render_scale)
            self.input_strength = 1.3
            self.identity = "Mark v2.3"
            self.appearance = "Original Mark rest and native topology; optional procedural cosmetics/hair."
        for name, (size, digest) in assets.items():
            verify(destination / name, size, digest)
        with np.load(destination / "model_data.npz", allow_pickle=False) as data:
            neutral = data["shapes_mean_skin"]
            if neutral.shape != (61520, 3):
                raise ValueError(f"Pinned {model} skin dimensions do not match.")
            self.selected, self.edges, self.triangles, maximum = claire_topology(
                neutral, destination / scene,
                ROOT / ".local" / "cache",
                f"{model}-native-control-v3:{revision}:{MESH_REVISION}:{assets}",
            )
            if (self.selected.shape != (15375,) or self.edges.shape != (30759, 2)
                    or self.triangles.shape != (30746, 3)):
                raise ValueError(f"Pinned {model} native control topology dimensions changed.")
            self.neutral = (verona_rest_shape(neutral[self.selected]) if transform is None
                            else neutral[self.selected].copy())
            basis = data["shapes_matrix_skin"]
            if basis.shape != (components, 61520, 3):
                raise ValueError(f"Pinned {model} PCA dimensions do not match.")
            self.basis = np.ascontiguousarray(basis[:, self.selected, :])
            del basis
        if transform is not None:
            origin, offset, factor = transform
            neutral = (neutral - origin) * factor + offset
            self.neutral = (self.neutral - origin) * factor + offset
            self.basis *= factor
        self.center = (neutral.min(axis=0) + neutral.max(axis=0)) / 2
        self.scale = float(np.max(np.ptp(neutral, axis=0)) / 2)
        self.condition = conditioning(destination / "implicit_emo_db.npz", shot, source_frame)
        self.session = create_cpu_session(destination / "network.onnx")
        self.mesh_bytes, geometry = mesh_payload(
            self.neutral, self.edges, self.triangles, self.center, self.scale, eyes=eyes,
            hair_scale=native_hair_scale(self.neutral) if transform is not None else 1.0)
        self.mesh_metadata = {
            **geometry,
            "identity": self.identity,
            "appearance": "Verona: reference-guided rest sculpt, olive/rosewood cosmetics and espresso waves",
            "deformation": "Claire skin PCA with 2x (default) or 4x neutral-relative emotion deltas; not a new trained identity",
            "vertices": len(self.selected),
            "edges": len(self.edges),
            "triangles": len(self.triangles),
            "nativeVertices": len(neutral),
            "nativeEdges": 123036,
            "nativeTriangles": 123036,
            "quantization": QUANTIZATION,
            "center": self.center.tolist(),
            "scale": self.scale,
            "bytes": len(self.mesh_bytes),
            "fps": FRAME_RATE,
            "modelRevision": revision,
            "meshRevision": MESH_REVISION,
            "topology": "one inverse native quad subdivision; original animated vertex indices",
            "maxRestShapeDifferenceCm": maximum,
        }
        if transform is not None:
            self.mesh_metadata.update({
                "appearance": self.appearance,
                "deformation": "Actual Mark skin PCA with 2x/4x same-audio neutral-relative emotion deltas.",
                "sourceModel": model, "inputStrength": self.input_strength,
                "conditioning": f"{shot} frame {source_frame}",
                "renderTransform": {"scale": float(factor), "origin": origin.tolist(),
                                    "offset": offset.tolist()},
                "rig": {"centers": eyes[0].tolist(),
                        "radius": (eyes[1].mean(0) * [1.22, .65, 1]).tolist(),
                        "mouth": [.08, 140.85, 5.25]},
            })

    def _predict(self, windows: np.ndarray, condition: np.ndarray) -> np.ndarray:
        prediction = self.session.run(
            ["result"], {
                "input": windows,
                "emotion": np.repeat(condition, len(windows), axis=0),
            }
        )[0]
        count = self.basis.shape[0]
        if prediction.shape != (len(windows), 1, count + 29) or not np.isfinite(prediction).all():
            raise ValueError("Model did not return finite matching skin/tongue/jaw/eye output.")
        return prediction[:, 0, :count]

    def generate(
        self, speech: Speech, expression: str = "neutral", intensity: float = 0.35,
        stop: threading.Event | None = None, *, expression_gain: float = EXPRESSION_GAIN,
    ) -> Clip:
        gain = validate_expression_gain(expression_gain)
        condition = expression_condition(self.condition, expression, intensity)
        amplify = not np.array_equal(condition, self.condition)
        samples = np.frombuffer(speech.pcm, dtype="<i2").astype(np.float32) / 32768
        if not 0 < len(samples) <= 25 * SAMPLE_RATE:
            raise ValueError("Speech must contain 0-25 seconds of mono PCM.")
        frames = (len(samples) * FRAME_RATE + SAMPLE_RATE - 1) // SAMPLE_RATE
        started = time.perf_counter()
        motion = bytearray()
        timings = []
        first = None
        maximum_change = 0.0
        count = self.basis.shape[0]
        for frame in range(0, frames, BATCH_SIZE):
            if stop is not None and stop.is_set():
                raise RuntimeError("Clip generation stopped with the local server.")
            before = time.perf_counter()
            batch = min(BATCH_SIZE, frames - frame)
            windows = np.concatenate([audio_window(samples, f, self.input_strength)
                                      for f in range(frame, frame + batch)])
            prediction = self._predict(windows, condition)
            if amplify:
                if stop is not None and stop.is_set():
                    raise RuntimeError("Clip generation stopped with the local server.")
                reference = self._predict(windows, self.condition)
                if self.motion_mapper is None:
                    prediction = reference + gain * (prediction - reference)
            if stop is not None and stop.is_set():
                raise RuntimeError("Clip generation stopped with the local server.")
            timings.extend([(time.perf_counter() - before) / batch] * batch)
            vertices = (prediction @ self.basis.reshape(count, -1)).reshape(
                batch, len(self.selected), 3
            ) + self.neutral
            if self.motion_mapper is not None:
                vertices = self.motion_mapper(vertices, stop)
                if amplify:
                    baseline = (reference @ self.basis.reshape(count, -1)).reshape(
                        batch, len(self.selected), 3) + self.neutral
                    baseline = self.motion_mapper(baseline, stop)
                    vertices = baseline + gain * (vertices - baseline)
                if stop is not None and stop.is_set():
                    raise RuntimeError("Clip generation stopped with the local server.")
            if first is None:
                first = vertices[0].copy()
            maximum_change = max(maximum_change, float(np.max(np.abs(vertices - first))))
            motion.extend(pack_positions(vertices, self.center, self.scale))
        identifier = uuid.uuid4().hex
        metadata = {
            "id": identifier,
            "frames": frames,
            "fps": FRAME_RATE,
            "vertices": vertices.shape[1],
            "quantization": QUANTIZATION,
            "duration": speech.seconds,
            "voice": speech.voice,
            "voiceSettings": asdict(speech.settings),
            "identity": self.identity,
            "appearance": self.appearance,
            "inferenceBatchSize": BATCH_SIZE,
            "expression": expression,
            "expressionStrength": intensity,
            "expressionGain": gain if amplify else 1.0,
            "expressionGainSetting": gain,
            "expressionReference": (
                "same-audio neutral-conditioned native fitted geometry" if self.motion_mapper is not None
                else "same-audio neutral-conditioned skin PCA") if amplify else None,
            "inferencePassesPerBatch": 2 if amplify else 1,
            "audioPcmSha256": hashlib.sha256(speech.pcm).hexdigest(),
            "motionSha256": hashlib.sha256(motion).hexdigest(),
            "generationSeconds": time.perf_counter() - started,
            "networkFrameMedianMs": float(np.median(timings) * 1000),
            "maximumSkinChangeCm": maximum_change,
            "motionBytes": len(motion),
            "providers": self.session.get_providers(),
            "qualification": "Working neural skin prototype; not human-accepted phonetic accuracy or SDK parity.",
            "omitted": ["SDK skin/contact/smoothing postprocess", "independent teeth/tongue/eye-joint animation"],
        }
        return Clip(identifier, speech.wav, bytes(motion), metadata)

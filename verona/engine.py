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

from .appearance import claire_eyes, claire_hair, verona_rest_shape
from .mesh import claire_topology
from .speech import Speech


QUANTIZATION = 8192
EXPRESSIONS = {"neutral": None, "happy": 6, "sad": 9, "surprised": 0, "angry": 1}
EXPRESSION_GAIN = 2.0
BATCH_SIZE = 4


def expression_condition(neutral: np.ndarray, name: object, intensity: object) -> np.ndarray:
    if not isinstance(name, str) or name not in EXPRESSIONS:
        raise ValueError("Choose neutral, happy, sad, surprised or angry.")
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


@dataclass(frozen=True)
class Clip:
    id: str
    audio: bytes
    motion: bytes
    metadata: dict


class FaceEngine:
    def __init__(self) -> None:
        for name, (size, digest) in ASSETS.items():
            verify(DESTINATION / name, size, digest)
        with np.load(DESTINATION / "model_data.npz", allow_pickle=False) as data:
            neutral = data["shapes_mean_skin"]
            if neutral.shape != (61520, 3):
                raise ValueError("Pinned Claire skin dimensions do not match.")
            self.selected, self.edges, self.triangles, maximum = claire_topology(
                neutral, DESTINATION / "claire_geom_v2_topo1.ma",
                ROOT / ".local" / "cache",
                f"claire-native-control-v3:{REVISION}:{MESH_REVISION}:{ASSETS}",
            )
            if (self.selected.shape != (15375,) or self.edges.shape != (30759, 2)
                    or self.triangles.shape != (30746, 3)):
                raise ValueError("Pinned Claire native control topology dimensions changed.")
            self.neutral = verona_rest_shape(neutral[self.selected])
            basis = data["shapes_matrix_skin"]
            if basis.shape != (140, 61520, 3):
                raise ValueError("Pinned Claire PCA dimensions do not match.")
            self.basis = np.ascontiguousarray(basis[:, self.selected, :])
        self.center = (neutral.min(axis=0) + neutral.max(axis=0)) / 2
        self.scale = float(np.max(np.ptp(neutral, axis=0)) / 2)
        self.condition = conditioning(DESTINATION / "implicit_emo_db.npz", "cp1_neutral", 212)
        self.session = create_cpu_session(DESTINATION / "network.onnx")
        positions = pack_positions(self.neutral, self.center, self.scale)
        edge_offset = (len(positions) + 3) & ~3
        triangle_offset = edge_offset + self.edges.nbytes
        self.mesh_bytes = (
            positions + bytes(edge_offset - len(positions))
            + self.edges.tobytes() + self.triangles.tobytes()
        )
        hair, hair_edges, hair_triangles = claire_hair()
        hair_positions = pack_positions(hair, self.center, self.scale)
        hair_position_offset = len(self.mesh_bytes)
        hair_edge_offset = (hair_position_offset + len(hair_positions) + 3) & ~3
        hair_triangle_offset = hair_edge_offset + hair_edges.nbytes
        self.mesh_bytes += (hair_positions
                            + bytes(hair_edge_offset - hair_position_offset - len(hair_positions))
                            + hair_edges.tobytes() + hair_triangles.tobytes())
        eyes, eye_triangles = claire_eyes()
        eye_positions = pack_positions(eyes, self.center, self.scale)
        eye_position_offset = len(self.mesh_bytes)
        eye_triangle_offset = (eye_position_offset + len(eye_positions) + 3) & ~3
        self.mesh_bytes += (eye_positions
                            + bytes(eye_triangle_offset - eye_position_offset - len(eye_positions))
                            + eye_triangles.tobytes())
        self.mesh_metadata = {
            "identity": "Claire v2.3.1",
            "appearance": "Verona: reference-guided rest sculpt, olive/rosewood cosmetics and espresso waves",
            "deformation": "Claire skin PCA with 2x explicit-emotion deltas relative to neutral speech; not a new trained identity",
            "vertices": len(self.selected),
            "edges": len(self.edges),
            "triangles": len(self.triangles),
            "nativeVertices": len(neutral),
            "nativeEdges": 123036,
            "nativeTriangles": 123036,
            "quantization": QUANTIZATION,
            "center": self.center.tolist(),
            "scale": self.scale,
            "edgeOffset": edge_offset,
            "triangleOffset": triangle_offset,
            "bytes": len(self.mesh_bytes),
            "fps": FRAME_RATE,
            "modelRevision": REVISION,
            "meshRevision": MESH_REVISION,
            "topology": "one inverse native quad subdivision; original animated vertex indices",
            "maxRestShapeDifferenceCm": maximum,
            "hair": {
                "vertices": len(hair), "edges": len(hair_edges), "triangles": len(hair_triangles),
                "positionOffset": hair_position_offset, "edgeOffset": hair_edge_offset,
                "triangleOffset": hair_triangle_offset,
            },
            "eyes": {
                "vertices": len(eyes), "triangles": len(eye_triangles),
                "positionOffset": eye_position_offset, "triangleOffset": eye_triangle_offset,
                "animation": "static cosmetic eyes; no independent gaze or eye-joint prediction",
            },
        }

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
        stop: threading.Event | None = None,
    ) -> Clip:
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
            windows = np.concatenate([audio_window(samples, f, 1.0)
                                      for f in range(frame, frame + batch)])
            prediction = self._predict(windows, condition)
            if amplify:
                if stop is not None and stop.is_set():
                    raise RuntimeError("Clip generation stopped with the local server.")
                reference = self._predict(windows, self.condition)
                prediction = reference + EXPRESSION_GAIN * (prediction - reference)
            if stop is not None and stop.is_set():
                raise RuntimeError("Clip generation stopped with the local server.")
            timings.extend([(time.perf_counter() - before) / batch] * batch)
            vertices = (prediction @ self.basis.reshape(count, -1)).reshape(
                batch, len(self.selected), 3
            ) + self.neutral
            if first is None:
                first = vertices[0].copy()
            maximum_change = max(maximum_change, float(np.max(np.abs(vertices - first))))
            motion.extend(pack_positions(vertices, self.center, self.scale))
        identifier = uuid.uuid4().hex
        metadata = {
            "id": identifier,
            "frames": frames,
            "fps": FRAME_RATE,
            "vertices": len(self.selected),
            "quantization": QUANTIZATION,
            "duration": speech.seconds,
            "voice": speech.voice,
            "voiceSettings": asdict(speech.settings),
            "identity": "Claire v2.3.1",
            "appearance": "Verona: reference-guided appearance study over unchanged Claire motion basis",
            "inferenceBatchSize": BATCH_SIZE,
            "expression": expression,
            "expressionStrength": intensity,
            "expressionGain": EXPRESSION_GAIN if amplify else 1.0,
            "expressionReference": "same-audio neutral-conditioned skin PCA" if amplify else None,
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

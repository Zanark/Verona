"""Offline CPU speech-to-native-geometry clips; no network or asset download."""

from dataclasses import dataclass
import hashlib
import threading
import time
import uuid

from scripts.probe_cpu import (
    ASSETS, DESTINATION, FRAME_RATE, REVISION, SAMPLE_RATE,
    audio_window, conditioning, create_cpu_session, reconstruct, verify,
)
from scripts import fetch_face_mesh

import numpy as np

from .mesh import read_mesh, reduced_mesh
from .speech import Speech


QUANTIZATION = 8192
EXPRESSIONS = {"neutral": None, "happy": 6, "sad": 9, "surprised": 0}


def expression_condition(neutral: np.ndarray, name: object, intensity: object) -> np.ndarray:
    if not isinstance(name, str) or name not in EXPRESSIONS:
        raise ValueError("Choose neutral, happy, sad or surprised.")
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
        verify(fetch_face_mesh.DESTINATION, fetch_face_mesh.SIZE, fetch_face_mesh.SHA256)
        source, edges, triangles = read_mesh(fetch_face_mesh.DESTINATION)
        with np.load(DESTINATION / "model_data.npz", allow_pickle=False) as data:
            neutral = data["shapes_mean_skin"]
            if neutral.shape != (61520, 3) or source.shape != neutral.shape:
                raise ValueError("Pinned Mark skin/native mesh dimensions do not match.")
            distances = np.linalg.norm(source - neutral, axis=1)
            # The PCA mean and sample rest pose differ; official topology is paired.
            if np.max(distances) > 0.6 or np.median(distances) > 0.08:
                raise ValueError("Pinned Mark per-index rest-shape correspondence changed.")
            self.selected, self.edges, self.triangles = reduced_mesh(neutral, edges, triangles)
            self.neutral = neutral[self.selected].copy()
            basis = data["shapes_matrix_skin"]
            if basis.shape != (272, 61520, 3):
                raise ValueError("Pinned Mark PCA dimensions do not match.")
            self.basis = np.ascontiguousarray(basis[:, self.selected, :])
        self.center = (neutral.min(axis=0) + neutral.max(axis=0)) / 2
        self.scale = float(np.max(np.ptp(neutral, axis=0)) / 2)
        self.condition = conditioning(DESTINATION / "implicit_emo_db.npz")
        self.session = create_cpu_session()
        self.mesh_bytes = (
            pack_positions(self.neutral, self.center, self.scale)
            + self.edges.tobytes() + self.triangles.tobytes()
        )
        self.mesh_metadata = {
            "vertices": len(self.selected),
            "edges": len(self.edges),
            "triangles": len(self.triangles),
            "nativeVertices": len(neutral),
            "nativeEdges": len(edges),
            "nativeTriangles": len(triangles),
            "quantization": QUANTIZATION,
            "fps": FRAME_RATE,
            "modelRevision": REVISION,
            "meshRevision": fetch_face_mesh.REVISION,
            "topology": "native-edge-constrained clustering; finer mouth sampling",
            "maxRestShapeDifferenceCm": float(np.max(distances)),
        }

    def generate(
        self, speech: Speech, expression: str = "neutral", intensity: float = 0.35,
        stop: threading.Event | None = None,
    ) -> Clip:
        condition = expression_condition(self.condition, expression, intensity)
        samples = np.frombuffer(speech.pcm, dtype="<i2").astype(np.float32) / 32768
        if not 0 < len(samples) <= 25 * SAMPLE_RATE:
            raise ValueError("Speech must contain 0-25 seconds of mono PCM.")
        frames = (len(samples) * FRAME_RATE + SAMPLE_RATE - 1) // SAMPLE_RATE
        started = time.perf_counter()
        motion = bytearray()
        timings = []
        first = None
        maximum_change = 0.0
        for frame in range(frames):
            if stop is not None and stop.is_set():
                raise RuntimeError("Clip generation stopped with the local server.")
            before = time.perf_counter()
            prediction = self.session.run(
                ["result"], {"input": audio_window(samples, frame), "emotion": condition}
            )[0]
            timings.append(time.perf_counter() - before)
            if prediction.shape != (1, 1, 301) or not np.isfinite(prediction).all():
                raise ValueError("Model did not return finite [1,1,301] output.")
            coefficients = prediction[0, 0, :272]
            vertices = reconstruct(coefficients, self.basis, self.neutral)
            if first is None:
                first = vertices.copy()
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
            "expression": expression,
            "expressionStrength": intensity,
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

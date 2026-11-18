"""Numerical CPU feasibility only; this does not qualify speech animation."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import time
import wave

os.environ["OPENBLAS_NUM_THREADS"] = "2"
os.environ["OMP_NUM_THREADS"] = "2"

import numpy as np
import onnxruntime as ort

from .fetch_cpu_model import ASSETS, DESTINATION, REVISION, ROOT, verify


SAMPLE_RATE = 16000
FRAME_RATE = 30
WINDOW_SIZE = 8320
WINDOW_OFFSET = 4160


def audio_window(samples: np.ndarray, frame: int) -> np.ndarray:
    if samples.ndim != 1 or not np.isfinite(samples).all() or frame < 0:
        raise ValueError("Expected finite mono samples and a nonnegative frame.")
    start = frame * SAMPLE_RATE // FRAME_RATE - WINDOW_OFFSET
    end = start + WINDOW_SIZE
    output = np.zeros(WINDOW_SIZE, dtype=np.float32)
    left, right = max(0, start), min(len(samples), end)
    if right > left:
        output[left - start : right - start] = samples[left:right] * 1.3
    return output.reshape(1, 1, WINDOW_SIZE)


def conditioning(path: Path) -> np.ndarray:
    with np.load(path, allow_pickle=False) as data:
        names = data["emo_spec_names"].astype("U")
        indices = np.flatnonzero(names == "g2a_neutral")
        if len(indices) != 1:
            raise ValueError("Expected exactly one g2a_neutral conditioning shot.")
        index = int(indices[0])
        if int(data["emo_spec_size"][index]) <= 33:
            raise ValueError("Conditioning shot does not contain source frame 33.")
        offset = int(data["emo_spec_start"][index]) + 33
        implicit = data["emo_db"][offset]
        if implicit.shape != (16,) or not np.isfinite(implicit).all():
            raise ValueError("Invalid implicit emotion vector.")
        output = np.zeros((1, 1, 26), dtype=np.float32)
        output[0, 0, :16] = implicit
        return output


def reconstruct(
    coefficients: np.ndarray, basis: np.ndarray, neutral: np.ndarray
) -> np.ndarray:
    if (
        coefficients.ndim != 1
        or neutral.ndim != 2
        or neutral.shape[1] != 3
        or basis.shape != (len(coefficients), *neutral.shape)
    ):
        raise ValueError("PCA coefficients, basis and neutral shape do not match.")
    result = (coefficients @ basis.reshape(len(coefficients), -1)).reshape(
        neutral.shape
    ) + neutral
    if not np.isfinite(result).all():
        raise ValueError("PCA reconstruction contains non-finite coordinates.")
    return result


def read_audio(path: Path | None) -> tuple[np.ndarray, str]:
    if path is None:
        times = np.arange(SAMPLE_RATE, dtype=np.float32) / SAMPLE_RATE
        samples = np.zeros(SAMPLE_RATE, dtype=np.float32)
        samples[SAMPLE_RATE // 2 :] = (
            0.1 * np.sin(2 * np.pi * 220 * times[SAMPLE_RATE // 2 :])
        )
        return samples, "synthetic silence then tone; NOT speech or accuracy evidence"
    with wave.open(str(path), "rb") as audio:
        if (
            audio.getnchannels() != 1
            or audio.getframerate() != SAMPLE_RATE
            or audio.getsampwidth() != 2
            or audio.getcomptype() != "NONE"
        ):
            raise ValueError("Probe accepts only mono 16 kHz 16-bit PCM WAV.")
        if not 0 < audio.getnframes() <= 10 * SAMPLE_RATE:
            raise ValueError("Probe requires a nonempty WAV no longer than 10 seconds.")
        raw = audio.readframes(audio.getnframes())
        if len(raw) != audio.getnframes() * 2:
            raise ValueError("WAV payload is truncated.")
    return np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768, "local WAV"


def create_cpu_session() -> ort.InferenceSession:
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    session = ort.InferenceSession(
        str(DESTINATION / "network.onnx"),
        sess_options=options,
        providers=["CPUExecutionProvider"],
    )
    if session.get_providers() != ["CPUExecutionProvider"]:
        raise RuntimeError("Inference must use only CPUExecutionProvider.")
    return session


def run(path: Path | None) -> dict:
    for name, (size, digest) in ASSETS.items():
        verify(DESTINATION / name, size, digest)
    samples, input_kind = read_audio(path)
    emotion = conditioning(DESTINATION / "implicit_emo_db.npz")
    started = time.perf_counter()
    session = create_cpu_session()
    load_seconds = time.perf_counter() - started

    frames = (len(samples) * FRAME_RATE + SAMPLE_RATE - 1) // SAMPLE_RATE
    predictions, timings = [], []
    for frame in range(frames):
        inputs = {"input": audio_window(samples, frame), "emotion": emotion}
        started = time.perf_counter()
        prediction = session.run(["result"], inputs)[0]
        timings.append(time.perf_counter() - started)
        if prediction.shape != (1, 1, 301) or not np.isfinite(prediction).all():
            raise ValueError("Expected finite [1,1,301] model output.")
        predictions.append(prediction[0, 0])
    predictions = np.stack(predictions)

    with np.load(DESTINATION / "model_data.npz", allow_pickle=False) as data:
        basis = data["shapes_matrix_skin"]
        neutral = data["shapes_mean_skin"]
    if basis.shape != (272, 61520, 3) or neutral.shape != (61520, 3):
        raise ValueError("Pinned Mark skin/PCA topology does not match.")
    started = time.perf_counter()
    vertices = reconstruct(predictions[-1, :272], basis, neutral)
    reconstruction_seconds = time.perf_counter() - started
    report = {
        "status": "numerical CPU inference and PCA reconstruction completed",
        "qualification": "NOT speech accuracy, SDK parity, or a finished face player",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "modelRevision": REVISION,
        "python": platform.python_version(),
        "onnxruntime": ort.__version__,
        "numpy": np.__version__,
        "providers": session.get_providers(),
        "inferenceThreads": 2,
        "interOpThreads": 1,
        "inputKind": input_kind,
        "analyzedPcmSha256": hashlib.sha256(
            samples.astype("<f4").tobytes()
        ).hexdigest(),
        "audioSeconds": len(samples) / SAMPLE_RATE,
        "fps": FRAME_RATE,
        "frames": frames,
        "outputShape": list(predictions.shape),
        "geometryShape": list(vertices.shape),
        "sessionLoadSeconds": load_seconds,
        "networkSeconds": sum(timings),
        "networkFrameMedianMs": float(np.median(timings) * 1000),
        "networkFrameMaxMs": max(timings) * 1000,
        "oneSkinReconstructionSeconds": reconstruction_seconds,
        "maxCoefficientChangeFromFirstFrame": float(
            np.max(np.abs(predictions - predictions[0]))
        ),
        "skinBounds": [vertices.min(axis=0).tolist(), vertices.max(axis=0).tolist()],
        "omitted": [
            "SDK skin postprocessing/smoothing/contact offsets",
            "tongue/jaw/eye animation and expression controls",
            "mesh connectivity, renderer and audio playback",
            "actual speech or visual/human quality evaluation",
            "end-to-end latency and peak-memory measurement",
        ],
    }
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--wav", type=Path, help="Local mono 16 kHz 16-bit PCM, <=10s.")
    args = parser.parse_args()
    report = run(args.wav)
    target = ROOT / ".local" / "cpu-probe.json"
    target.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

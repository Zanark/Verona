"""Bounded Windows process measurements; synthetic audio, private derived cache, no UI."""

import argparse
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time


def memory():
    class Counters(ctypes.Structure):
        _fields_ = [("cb", wintypes.DWORD), ("faults", wintypes.DWORD)] + [
            (name, ctypes.c_size_t) for name in (
                "peakWorkingSet", "workingSet", "peakPaged", "paged",
                "peakNonpaged", "nonpaged", "pagefile", "peakPagefile", "privateBytes")]

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    psapi = ctypes.WinDLL("psapi", use_last_error=True)
    psapi.GetProcessMemoryInfo.argtypes = [
        wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
    counters = Counters()
    counters.cb = ctypes.sizeof(counters)
    if not psapi.GetProcessMemoryInfo(
            kernel.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
        raise ctypes.WinError(ctypes.get_last_error())
    return {name: getattr(counters, name) for name in
            ("workingSet", "peakWorkingSet", "privateBytes", "peakPagefile")}


def worker(kind, output=None, model="claire"):
    started = time.perf_counter()
    result = {"scenario": kind, "initial": memory()}
    if kind == "manager":
        from verona.manager import SessionManager
        manager = SessionManager()
        assert not manager.children
        result["importSeconds"] = time.perf_counter() - started
        result["residentModules"] = [name for name in (
            "numpy", "onnxruntime", "verona.engine",
            "scripts.mpfb_motion_transfer", "scripts.claire_reference_study")
            if name in sys.modules]
    else:
        from unittest.mock import patch
        from verona import engine
        from verona.mesh import claire_topology
        from verona.variants import prepare_variant
        from verona.speech import Speech, package_pcm
        loaded = []
        create = engine.create_cpu_session

        def session(path):
            result["beforeInferenceSession"] = memory()
            loaded.append(str(path.relative_to(engine.ROOT)))
            return create(path)

        with tempfile.TemporaryDirectory(prefix="verona-performance-") as directory:
            with (patch.object(engine, "claire_topology", side_effect=lambda n, s, c, f:
                               claire_topology(n, s, Path(directory), f)),
                  patch.object(engine, "create_cpu_session", side_effect=session)):
                face = engine.FaceEngine("mark" if model == "mark" else "claire")
                prepare_variant(face, model)
            result["model"] = model
            result["startupSecondsIncludingImportAndColdTopology"] = time.perf_counter() - started
            result["ready"] = memory()
            result["inferenceModels"] = loaded
            result["basisBytes"] = face.basis.nbytes
            result["meshBytes"] = len(face.mesh_bytes)
            result["meshSha256"] = engine.hashlib.sha256(face.mesh_bytes).hexdigest()
            if output is not None:
                output.mkdir(parents=True, exist_ok=False)
                (output / "mesh.bin").write_bytes(face.mesh_bytes)
                (output / "mesh.json").write_text(json.dumps(face.mesh_metadata))
            pcm = bytes(6400 * 2)
            speech = Speech(package_pcm(pcm), pcm, "Synthetic silence; not listening evidence")
            result["clips"] = []
            for expression in ("neutral", "happy", "neutral", "happy"):
                clip = face.generate(speech, expression, expression_gain=4)
                result["clips"].append({key: clip.metadata[key] for key in (
                    "expression", "frames", "generationSeconds", "motionSha256")})
            result["residentAdapters"] = [name for name in (
                "scripts.mpfb_motion_transfer", "scripts.claire_reference_study")
                if name in sys.modules]
    result["final"] = memory()
    before = time.process_time()
    idle_started = time.perf_counter()
    time.sleep(2)
    result["idleCpuSeconds"] = time.process_time() - before
    result["idleWallSeconds"] = time.perf_counter() - idle_started
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--worker", choices=("manager", "engine"))
    parser.add_argument("--model", choices=("claire", "mpfb", "mark"), default="claire")
    args = parser.parse_args()
    if args.worker:
        print(json.dumps(worker(args.worker, args.output, args.model)))
        return
    if args.output is None:
        parser.error("--output is required")
    args.output.mkdir(parents=True, exist_ok=False)
    result = {"platform": sys.platform, "python": sys.version, "runs": []}
    environment = dict(os.environ, OPENBLAS_NUM_THREADS="2", OMP_NUM_THREADS="2")
    for kind in ("manager", "engine", "manager", "engine"):
        index = len(result["runs"])
        completed = subprocess.run(
            [sys.executable, "-m", "tests.run_performance_probe", "--worker", kind, "--model", args.model,
             *(["--output", str(args.output / f"{index}-{kind}")] if kind == "engine" else [])],
            capture_output=True, text=True, timeout=120, env=environment, check=False)
        (args.output / f"{index}-{kind}.stderr.txt").write_text(completed.stderr)
        if completed.returncode:
            raise RuntimeError(f"{kind} probe failed; inspect retained stderr.")
        result["runs"].append(json.loads(completed.stdout))
        (args.output / "report.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result))


if __name__ == "__main__":
    main()

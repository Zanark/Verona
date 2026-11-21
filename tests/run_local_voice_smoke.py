"""Explicit actual-pack qualification: RAM-only synthetic audio, metadata receipts."""

import argparse
import ctypes
from ctypes import wintypes
import hashlib
import json
from pathlib import Path
import subprocess
import time

from verona.agent_speech import SpeechWorker
from verona.local_voices import verify_assets, voice_metadata
from verona.speech import POWERSHELL, VoiceSettings


def owned_process_ids(pid):
    command = (f"$ids=@({pid});$front=@({pid});"
               "for($n=0;$n -lt 3 -and $front.Count;$n++){"
               "$next=@(foreach($p in $front){Get-CimInstance Win32_Process "
               '-Filter "ParentProcessId = $p" | Select-Object -ExpandProperty ProcessId});'
               "$ids+= $next;$front=$next};ConvertTo-Json -Compress -InputObject @($ids)")
    result = subprocess.run([str(POWERSHELL), "-NoProfile", "-NonInteractive", "-Command", command],
                            capture_output=True, text=True, timeout=15, check=True)
    return json.loads(result.stdout)


def process_resources(pid):
    class Counters(ctypes.Structure):
        _fields_ = [("cb", wintypes.DWORD), ("faults", wintypes.DWORD)] + [
            (name, ctypes.c_size_t) for name in (
                "peakWorkingSet", "workingSet", "peakPaged", "paged",
                "peakNonPaged", "nonPaged", "pagefile", "peakPagefile", "private")]

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.GetProcessTimes.argtypes = [wintypes.HANDLE] + [ctypes.POINTER(wintypes.FILETIME)] * 4
    psapi = ctypes.WinDLL("psapi", use_last_error=True)
    psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
    handle = kernel.OpenProcess(0x410, False, pid)
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        counters = Counters()
        counters.cb = ctypes.sizeof(counters)
        times = [wintypes.FILETIME() for _ in range(4)]
        if not psapi.GetProcessMemoryInfo(handle, ctypes.byref(counters), counters.cb) or not (
                kernel.GetProcessTimes(handle, *(ctypes.byref(value) for value in times))):
            raise ctypes.WinError(ctypes.get_last_error())
        cpu = sum(value.dwLowDateTime + (value.dwHighDateTime << 32) for value in times[2:]) / 10_000_000
        return {"privateBytes": counters.private, "workingSetBytes": counters.workingSet,
                "peakWorkingSetBytes": counters.peakWorkingSet, "cpuSeconds": cpu}
    finally:
        kernel.CloseHandle(handle)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--voice", action="append", choices=[row["name"] for row in voice_metadata()])
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    verify_assets()
    report = {"completed": False, "cases": [], "audioPersisted": False,
              "limits": "Synthetic technical qualification, not independent listening or perceptual identity acceptance."}
    target = args.output / "report.json"

    def save():
        target.write_text(json.dumps(report, indent=2) + "\n")

    save()
    worker = SpeechWorker()
    process_ids = None
    try:
        assert worker.local_worker is None
        windows = next(row["name"] for row in worker.voices if row.get("provider") != "kokoro")
        selected = [row for row in voice_metadata() if not args.voice or row["name"] in args.voice]
        for voice in selected:
            started = time.perf_counter()
            speech = worker.synthesize(
                "Hello there. This is a different local voice for your speaking session.",
                voice["name"], worker.voices, VoiceSettings())
            elapsed = time.perf_counter() - started
            import numpy as np
            samples = np.frombuffer(speech.pcm, dtype="<i2")
            assert .5 < speech.seconds <= 25
            assert np.max(np.abs(samples.astype(np.int32))) > 300
            process_ids = owned_process_ids(worker.local_worker.process.pid)
            resources = [{"pid": pid, **process_resources(pid)} for pid in process_ids]
            report["cases"].append({"voice": voice["name"], "culture": voice["culture"],
                                    "seconds": speech.seconds,
                                    "synthesisSeconds": elapsed,
                                    "pcmSha256": hashlib.sha256(speech.pcm).hexdigest(),
                                    "workerPid": worker.local_worker.process.pid,
                                    "resources": resources,
                                    "treePrivateBytes": sum(row["privateBytes"] for row in resources)})
            save()
        assert len({row["pcmSha256"] for row in report["cases"]}) == len(selected)
        assert len({row["workerPid"] for row in report["cases"]}) == 1
        child = worker.local_worker.process
        before = sum(process_resources(pid)["cpuSeconds"] for pid in process_ids)
        time.sleep(1.5)
        after = sum(process_resources(pid)["cpuSeconds"] for pid in process_ids)
        report["idleCpuSecondsOver1_5s"] = after - before
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        handles = [kernel.OpenProcess(0x00100000, False, pid) for pid in process_ids]
        try:
            if not all(handles):
                raise ctypes.WinError(ctypes.get_last_error())
            speech = worker.synthesize("The Windows voice is still available.", windows, worker.voices, VoiceSettings())
            assert speech.voice == windows and child.poll() is not None and worker.local_worker is None
            assert all(kernel.WaitForSingleObject(handle, 0) == 0 for handle in handles)
        finally:
            for handle in handles:
                if handle:
                    kernel.CloseHandle(handle)
        report.update(completed=True, newVoiceCount=len(selected),
                      oneLocalChildReused=True, localChildReleasedOnWindows=True,
                      entireLocalProcessTreeExited=True)
        save()
    finally:
        worker.close()
    print(json.dumps({key: value for key, value in report.items() if key != "cases"}))


if __name__ == "__main__":
    main()

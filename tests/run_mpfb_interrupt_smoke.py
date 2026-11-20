"""Send real Ctrl+C only to a disposable native-study console."""

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time


CONTROL = r"""
import ctypes, sys, time
k = ctypes.WinDLL("kernel32", use_last_error=True)
k.FreeConsole()
if not k.AttachConsole(int(sys.argv[1])): raise ctypes.WinError(ctypes.get_last_error())
try:
    if not k.SetConsoleCtrlHandler(None, True): raise ctypes.WinError(ctypes.get_last_error())
    if not k.GenerateConsoleCtrlEvent(int(sys.argv[2]), 0): raise ctypes.WinError(ctypes.get_last_error())
    time.sleep(.5)
finally:
    k.FreeConsole()
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    environment = dict(os.environ, TEMP=str(output), TMP=str(output),
                       OPENBLAS_NUM_THREADS="2", OMP_NUM_THREADS="2")
    ready = threading.Event()
    report = {"ready":False,"ctrlCExited":False}
    process = subprocess.Popen([sys.executable,"-m","scripts.mpfb_speaking_study","--no-open"],
        env=environment, creationflags=subprocess.CREATE_NEW_CONSOLE,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8")

    def consume():
        for line in process.stdout:
            if "study ready" in line:
                ready.set()
            if "Stopping this owned MPFB study." in line:
                report["keyboardInterruptHandled"] = True
        process.stdout.close()

    reader = threading.Thread(target=consume, daemon=True)
    reader.start()
    try:
        if not ready.wait(75):
            raise RuntimeError("Owned native study did not become ready.")
        report["ready"] = True
        started = time.monotonic()
        subprocess.run([sys.executable,"-c",CONTROL,str(process.pid),"0"],
                       creationflags=subprocess.CREATE_NO_WINDOW, check=True, timeout=10)
        code = process.wait(timeout=10)
        report.update(exitCode=code,ctrlCSeconds=time.monotonic()-started,
                      ctrlCExited=code==0 and report.get("keyboardInterruptHandled",False))
        if not report["ctrlCExited"]:
            raise RuntimeError("Ctrl+C did not take the owned graceful cleanup path.")
    finally:
        if process.poll() is None:
            subprocess.run([sys.executable,"-c",CONTROL,str(process.pid),"1"],
                           creationflags=subprocess.CREATE_NO_WINDOW, check=True, timeout=10)
            process.wait(timeout=10)
        reader.join(timeout=3)
        report["ownedTemporaryDirectoriesRemoved"] = not list(output.glob("verona-native-mpfb-*"))
        (output / "interrupt-report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()

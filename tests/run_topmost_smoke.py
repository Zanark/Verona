"""Qualify actual per-head Windows topmost state without touching user heads."""

import argparse
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import subprocess
import sys
import time

from verona.agent import call, read_descriptor
from verona.desktop import ROOT


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    output = parser.parse_args().output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    (output / "tmp").mkdir()
    environment = dict(os.environ, LOCALAPPDATA=str(output / "appdata"),
                       TEMP=str(output / "tmp"), TMP=str(output / "tmp"),
                       OPENBLAS_NUM_THREADS="2", OMP_NUM_THREADS="2")
    descriptor_path = output / "appdata" / "Verona" / "manager.json"
    descriptor = None
    receipt = {"checks": [], "isolation": "Own manager, capabilities, profiles and temp data; no user session driven."}
    user = ctypes.WinDLL("user32", use_last_error=True)
    user.GetWindowLongPtrW.argtypes = [wintypes.HWND, ctypes.c_int]
    user.GetWindowLongPtrW.restype = ctypes.c_ssize_t
    user.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    user.IsWindowVisible.argtypes = [wintypes.HWND]
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user.EnumWindows.argtypes = [callback_type, wintypes.LPARAM]

    def wait_for(check, message, seconds=60):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            result = check()
            if result:
                return result
            time.sleep(.1)
        raise TimeoutError(message)

    def native_state(pid):
        states = []

        @callback_type
        def visit(window, _):
            owner = wintypes.DWORD()
            user.GetWindowThreadProcessId(window, ctypes.byref(owner))
            if owner.value == pid and user.IsWindowVisible(window):
                states.append(bool(user.GetWindowLongPtrW(window, -20) & 0x8))
            return True

        if not user.EnumWindows(visit, 0):
            raise ctypes.WinError(ctypes.get_last_error())
        if len(states) != 1:
            raise RuntimeError(f"Expected exactly one visible owned native window, got {len(states)}.")
        return states[0]

    with (output / "runtime.log").open("w", encoding="utf-8") as log:
        manager = subprocess.Popen([sys.executable, "-m", "verona.manager", "--no-open"],
                                   cwd=ROOT, env=environment, stdout=log, stderr=log)
        try:
            wait_for(lambda: descriptor_path.exists(), "Owned manager did not start.", 30)
            descriptor = read_descriptor(descriptor_path)
            heads = {}
            for name, model in (("pin-claire", "claire"), ("pin-mpfb", "mpfb")):
                call(descriptor, {"action": "create", "session": name, "model": model, "colors": {}})
                state = wait_for(lambda: (value if (value := call(descriptor, {
                    "action": "inspect", "session": name})).get("ready") else None),
                    f"Owned {name} did not become ready.")
                controls = {item["id"]: item for item in state["controls"]}
                if controls["pin-overlay"]["value"] is not True:
                    raise RuntimeError(f"{name} did not report default-on pinning.")
                heads[name] = read_descriptor(descriptor_path.parent / "agent" / f"{name}.json")["pid"]
            query = " OR ".join(f"ParentProcessId={pid}" for pid in heads.values())
            command = ("Get-CimInstance Win32_Process -Filter \"Name='electron.exe' AND (" +
                       query + ")\" | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress")
            rows = json.loads(subprocess.run(["pwsh", "-NoProfile", "-Command", command],
                text=True, capture_output=True, check=True, timeout=30).stdout)
            native = {}
            for name, pid in heads.items():
                children = [row["ProcessId"] for row in rows if row["ParentProcessId"] == pid]
                if len(children) != 1:
                    raise RuntimeError(f"Could not identify exact owned Electron main for {name}.")
                native[name] = children[0]
                wait_for(lambda: native_state(children[0]), f"{name} was not natively topmost.", 10)
            receipt["checks"].append("Both real Claire and MPFB heads start with WS_EX_TOPMOST and confirmed checked controls.")
            for name, pid in native.items():
                for pinned in (False, True):
                    state = call(descriptor, {"action": "settings", "session": name,
                                             "settings": {"pin-overlay": pinned}})
                    wait_for(lambda: native_state(pid) == pinned, "Native pin update did not apply.", 10)
                    other = next(key for key in native if key != name)
                    if not native_state(native[other]):
                        raise RuntimeError("Pinning one head changed the other head.")
                    controls = {item["id"]: item for item in state["controls"]}
                    if controls["pin-overlay"]["value"] is not pinned:
                        raise RuntimeError("Confirmed control and native pin state disagree.")
                receipt["checks"].append(f"{name}: manager off/on changes native topmost; other head remains pinned.")
        except Exception as error:
            receipt["error"] = repr(error)
            raise
        finally:
            if manager.poll() is None:
                if descriptor:
                    call(descriptor, {"action": "shutdown"})
                else:
                    manager.terminate()
                manager.wait(timeout=45)
            receipt["managerStopped"] = manager.poll() is not None
            receipt["headDescriptorsRemoved"] = not list(
                (descriptor_path.parent / "agent").glob("*.json"))
            (output / "topmost-report.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    if manager.returncode or not receipt["headDescriptorsRemoved"] or descriptor_path.exists():
        raise RuntimeError("Owned topmost qualification did not clean up.")
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()

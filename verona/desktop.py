"""Own one local server and one isolated desktop compositor; no service/install."""

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import ctypes
from ctypes import wintypes

from .server import LocalServer, create_state


ROOT = Path(__file__).resolve().parents[1]
ELECTRON = ROOT / "desktop" / "node_modules" / "electron" / "dist" / "electron.exe"


def stop_desktop(child: subprocess.Popen) -> None:
    if child.poll() is not None:
        return
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.EnumWindows.argtypes = [callback_type, wintypes.LPARAM]

    @callback_type
    def close_owned_window(handle, _parameter):
        identifier = wintypes.DWORD()
        user32.GetWindowThreadProcessId(handle, ctypes.byref(identifier))
        if identifier.value == child.pid:
            user32.PostMessageW(handle, 0x0010, 0, 0)
        return True

    if not user32.EnumWindows(close_owned_window, 0):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        child.wait(timeout=10)
    except subprocess.TimeoutExpired:
        print("Owned desktop did not close in 10 seconds; terminating its exact process.",
              file=sys.stderr)
        child.terminate()
        child.wait(timeout=10)


def main() -> None:
    if not ELECTRON.is_file():
        print("Desktop runtime missing. Run Setup-VeronaDesktop.cmd explicitly, then VeronaDesktop.cmd.",
              file=sys.stderr)
        raise SystemExit(1)
    child = None
    server = None
    thread = None
    state = None
    try:
        state = create_state()
        server = LocalServer(0, state)
        thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": .05})
        thread.start()
        environment = {key: os.environ[key] for key in
                       ("SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA",
                        "LOCALAPPDATA", "PATH") if key in os.environ}
        with tempfile.TemporaryDirectory(prefix="verona-desktop-") as directory:
            # Only the owned, disposable profile receives GPU/code caches; speech stays in RAM.
            environment["VERONA_LOCAL_URL"] = server.url
            child = subprocess.Popen(
                [str(ELECTRON), str(ROOT / "desktop"),
                 f"--user-data-dir={directory}"], text=True,
                cwd=ROOT, env=environment,
            )
            print(f"Verona desktop process {child.pid}; close its window or Ctrl+C here to stop.",
                  flush=True)
            try:
                code = child.wait()
                if code:
                    raise RuntimeError(f"Desktop compositor exited with code {code}.")
            finally:
                stop_desktop(child)
    except KeyboardInterrupt:
        print("\nStopping owned Verona desktop and discarding speech RAM.", flush=True)
    except (OSError, RuntimeError, ValueError) as error:
        print(f"Verona desktop failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
    finally:
        if state is not None:
            state.stop.set()
        if server is not None:
            server.shutdown()
            server.server_close()
        if thread is not None:
            thread.join(timeout=10)
            if thread.is_alive():
                raise RuntimeError("Owned desktop server did not stop.")


if __name__ == "__main__":
    main()

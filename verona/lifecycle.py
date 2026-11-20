"""Watch an explicitly supplied manager process without signalling other apps."""

from contextlib import contextmanager
import ctypes
from ctypes import wintypes
import os
import threading


@contextmanager
def parent_lifetime():
    stopping, done = threading.Event(), threading.Event()
    value = os.environ.pop("VERONA_MANAGER_PID", None)
    if value is None:
        yield stopping
        return
    if not value.isdecimal() or int(value) <= 0 or int(value) == os.getpid():
        raise ValueError("Invalid manager process identity.")
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = kernel.OpenProcess(0x00100000, False, int(value))
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    errors = []

    def watch():
        while not done.is_set():
            result = kernel.WaitForSingleObject(handle, 200)
            if result == 0:
                stopping.set()
                return
            if result != 258:
                errors.append(ctypes.WinError(ctypes.get_last_error()))
                stopping.set()
                return

    thread = threading.Thread(target=watch, daemon=True)
    thread.start()
    try:
        yield stopping
    finally:
        done.set()
        thread.join(timeout=2)
        if thread.is_alive():
            raise RuntimeError("Owned manager-lifetime watcher did not stop.")
        if not kernel.CloseHandle(handle):
            raise ctypes.WinError(ctypes.get_last_error())
        if errors:
            raise errors[0]

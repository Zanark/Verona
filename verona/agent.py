"""Explicit, stdin-driven agent speech. Clients import only the standard library."""

import argparse
import http.client
import json
import os
from pathlib import Path
import re
import sys
import time
import uuid


def session_path(name: str) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,47}", name):
        raise ValueError("Session must be 1-48 letters, digits, underscores or hyphens.")
    return Path(os.environ["LOCALAPPDATA"]) / "Verona" / "agent" / f"{name}.json"


def manager_path() -> Path:
    return session_path("inventory").parent.parent / "manager.json"


def private_descriptor(path: Path, data: dict) -> None:
    """Create, never replace, a descriptor readable only by this Windows user/System."""
    raw = json.dumps(data).encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    if os.name != "nt":
        with os.fdopen(os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600), "wb") as stream:
            stream.write(raw)
        return
    import ctypes
    from ctypes import wintypes
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    security = ctypes.WinDLL("advapi32", use_last_error=True)
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    security.OpenProcessToken.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
    security.GetTokenInformation.argtypes = [
        wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
    security.ConvertSidToStringSidW.argtypes = [ctypes.c_void_p, ctypes.POINTER(wintypes.LPWSTR)]
    security.ConvertStringSecurityDescriptorToSecurityDescriptorW.argtypes = [
        wintypes.LPCWSTR, wintypes.DWORD, ctypes.POINTER(ctypes.c_void_p), ctypes.c_void_p]
    token, size = wintypes.HANDLE(), wintypes.DWORD()
    sid, descriptor = wintypes.LPWSTR(), ctypes.c_void_p()
    if not security.OpenProcessToken(kernel.GetCurrentProcess(), 8, ctypes.byref(token)):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        security.GetTokenInformation(token, 1, None, 0, ctypes.byref(size))
        buffer = ctypes.create_string_buffer(size.value)
        if not security.GetTokenInformation(token, 1, buffer, size, ctypes.byref(size)):
            raise ctypes.WinError(ctypes.get_last_error())
        if not security.ConvertSidToStringSidW(
                ctypes.cast(buffer, ctypes.POINTER(ctypes.c_void_p))[0], ctypes.byref(sid)):
            raise ctypes.WinError(ctypes.get_last_error())
        if not security.ConvertStringSecurityDescriptorToSecurityDescriptorW(
                f"D:P(A;;FA;;;SY)(A;;FA;;;{sid.value})", 1, ctypes.byref(descriptor), None):
            raise ctypes.WinError(ctypes.get_last_error())

        class Attributes(ctypes.Structure):
            _fields_ = [("length", wintypes.DWORD), ("descriptor", ctypes.c_void_p),
                        ("inherit", wintypes.BOOL)]

        attributes = Attributes(ctypes.sizeof(Attributes), descriptor, False)
        kernel.CreateFileW.argtypes = [
            wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(Attributes),
            wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
        kernel.CreateFileW.restype = wintypes.HANDLE
        kernel.WriteFile.argtypes = [
            wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD),
            ctypes.c_void_p]
        handle = kernel.CreateFileW(str(path), 0x40000000, 0, ctypes.byref(attributes), 1, 0x80, None)
        if handle == ctypes.c_void_p(-1).value:
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            written = wintypes.DWORD()
            if not kernel.WriteFile(handle, raw, len(raw), ctypes.byref(written), None):
                raise ctypes.WinError(ctypes.get_last_error())
            if written.value != len(raw):
                raise OSError("Agent session descriptor was not completely written.")
        finally:
            kernel.CloseHandle(handle)
    finally:
        kernel.CloseHandle(token)
        if sid:
            kernel.LocalFree(ctypes.cast(sid, ctypes.c_void_p))
        if descriptor:
            kernel.LocalFree(descriptor)


def read_descriptor(path: Path) -> dict:
    try:
        with path.open("rb") as stream:
            raw = stream.read(2049)
    except FileNotFoundError as error:
        raise RuntimeError("Named agent host is absent. Start it explicitly; clients never launch it.") from error
    if len(raw) > 2048:
        raise ValueError("Invalid agent session descriptor.")
    value = json.loads(raw)
    if (not isinstance(value, dict) or set(value) != {"version", "port", "token", "pid", "instance"}
            or value["version"] != 1 or type(value["port"]) is not int
            or not 1 <= value["port"] <= 65535 or type(value["pid"]) is not int
            or value["pid"] <= 0 or not isinstance(value["token"], str)
            or not re.fullmatch(r"[A-Za-z0-9_-]{43}", value["token"])
            or not isinstance(value["instance"], str)
            or not re.fullmatch(r"[0-9a-f]{32}", value["instance"])):
        raise ValueError("Invalid agent session descriptor; do not reuse an old host.")
    return value


def call(descriptor: dict, payload: dict, *, timeout=20) -> dict:
    connection = http.client.HTTPConnection("127.0.0.1", descriptor["port"], timeout=timeout)
    origin = f"http://127.0.0.1:{descriptor['port']}"
    try:
        connection.request("POST", "/api/agent", json.dumps(payload), {
            "Origin": origin, "X-Verona-Token": descriptor["token"],
            "Content-Type": "application/json",
        })
        response = connection.getresponse()
        raw = response.read(65537)
        if len(raw) > 65536:
            raise RuntimeError("Agent host returned an oversized response.")
        result = json.loads(raw)
        if not isinstance(result, dict):
            raise RuntimeError("Agent host returned an invalid response.")
        if response.status != 200:
            raise RuntimeError(result.get("error", f"Agent host failed ({response.status})."))
        return result
    except OSError as error:
        raise RuntimeError("Agent host is unavailable or stale; no speech was automatically retried.") from error
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list")
    from .session_config import MODELS, COLOR_KEYS, colors_patch
    for name in ("host", "create", "status", "say", "stop", "configure", "close"):
        command = commands.add_parser(name)
        command.add_argument("--session", required=True, help="Explicit named host; no global default.")
        if name in ("host", "create", "configure"):
            for key in COLOR_KEYS:
                command.add_argument(f"--{key}-color", help="RGB hex, or 'default' to restore original.")
        if name in ("host", "create"):
            command.add_argument("--model", choices=tuple(MODELS), default="claire")
            command.add_argument("--voice", help="Installed voice; manager otherwise reserves an unused voice.")
            command.add_argument("--performance-mode", action="store_true",
                                 help="Create a performance-only head: 10% idle / 100% speaking. Fixed for its lifetime.")
        if name == "say":
            command.add_argument("--id", default=uuid.uuid4().hex, help="Stable request ID for safe explicit retries.")
            command.add_argument("--voice")
            command.add_argument("--expression", default="neutral")
            command.add_argument("--intensity", type=float, default=.35)
            command.add_argument("--gain", type=int, choices=(2, 4), default=4)
            command.add_argument("--voice-only", action="store_true", help="Skip neural motion explicitly.")
            command.add_argument("--timeout", type=float, default=180, help="Total wait budget, 1-600 seconds.")
        elif name == "stop":
            command.add_argument("--id", required=True, help="Cancel only this request, not another speaker.")
    args = parser.parse_args()
    try:
        if args.command == "list":
            print(json.dumps(call(read_descriptor(manager_path()), {"action": "list"})), flush=True)
            return
        path = session_path(args.session)
        if args.command == "create":
            colors = colors_patch({key: None if value == "default" else value
                                   for key in COLOR_KEYS
                                   if (value := getattr(args, key + "_color")) is not None})
            print(json.dumps(call(read_descriptor(manager_path()), {
                "action":"create","session":args.session,"model":args.model,"colors":colors,
                **({"voice": args.voice} if args.voice is not None else {}),
                **({"performanceMode": True} if args.performance_mode else {})})), flush=True)
            return
        if args.command == "host":
            from .agent_host import host
            colors = colors_patch({key: None if value == "default" else value
                                   for key in COLOR_KEYS
                                   if (value := getattr(args, key + "_color")) is not None})
            host(path, model=args.model, colors=colors, voice=args.voice,
                 performance_mode=args.performance_mode)
            return
        descriptor = read_descriptor(path)
        if args.command == "status":
            result = call(descriptor, {"action": "status"})
        elif args.command == "configure":
            colors = colors_patch({key: None if value == "default" else value
                                   for key in COLOR_KEYS
                                   if (value := getattr(args, key + "_color")) is not None})
            if not colors:
                raise ValueError("Supply at least one --FEATURE-color.")
            result = call(descriptor, {"action": "configure", "colors": colors})
        elif args.command == "close":
            result = call(descriptor, {"action": "close"})
        elif args.command == "stop":
            result = call(descriptor, {"action": "cancel", "id": args.id})
        else:
            if not 1 <= args.timeout <= 600:
                raise ValueError("Timeout must be 1-600 seconds.")
            raw = sys.stdin.buffer.read(8193)
            if len(raw) > 8192:
                raise ValueError("Speech input exceeds 8192 UTF-8 bytes.")
            text = raw.decode("utf-8-sig").strip()
            if not text or len(text) > 280:
                raise ValueError("Pipe 1-280 characters of UTF-8 plain text to say.")
            started = time.monotonic()
            try:
                result = call(descriptor, {
                    "action": "say", "id": args.id, "text": text, "voice": args.voice,
                    "expression": args.expression, "intensity": args.intensity, "gain": args.gain,
                    "mode": "voice" if args.voice_only else "face",
                })
                while result["state"] not in ("completed", "failed", "cancelled"):
                    remaining = args.timeout - (time.monotonic() - started)
                    if remaining <= 0:
                        call(descriptor, {"action": "cancel", "id": args.id})
                        raise RuntimeError("Speech wait timed out; cancellation requested, not completion.")
                    result = call(descriptor, {"action": "wait", "id": args.id,
                                               "version": result["version"],
                                               "seconds": min(10, remaining)})
            except KeyboardInterrupt:
                call(descriptor, {"action": "cancel", "id": args.id})
                raise RuntimeError("Interrupted; cancellation requested for this speech only.") from None
            result["clientSeconds"] = time.monotonic() - started
        print(json.dumps(result, allow_nan=False), flush=True)
        if result.get("state") in ("failed", "cancelled"):
            raise SystemExit(1)
    except (OSError, RuntimeError, ValueError, KeyError) as error:
        print(json.dumps({"error": str(error),
                          **({"id": args.id} if args.command in ("say", "stop") else {})}),
              file=sys.stderr, flush=True)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()

"""Qualify the unified GUI and owned simultaneous heads with disposable data."""

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import signal
import ctypes
from ctypes import wintypes

from verona.agent import call, read_descriptor
from verona.desktop import ELECTRON, ROOT, stop_desktop


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    (output / "tmp").mkdir()
    environment = {key: os.environ[key] for key in
                   ("SystemRoot","SystemDrive","ProgramData","ALLUSERSPROFILE",
                    "WINDIR","USERPROFILE","APPDATA","LOCALAPPDATA","PATH")
                   if key in os.environ}
    environment.update(LOCALAPPDATA=str(output / "appdata"), TEMP=str(output / "tmp"),
                       TMP=str(output / "tmp"), OPENBLAS_NUM_THREADS="2", OMP_NUM_THREADS="2")
    descriptor_path = output / "appdata" / "Verona" / "manager.json"
    manager = browser = external = None
    descriptor = None
    with (output / "runtime.log").open("w", encoding="utf-8") as log:
        def wait_session(name, process):
            path = output / "appdata" / "Verona" / "agent" / f"{name}.json"
            deadline = time.monotonic() + 60
            while time.monotonic() < deadline and process.poll() is None:
                if path.exists():
                    value = read_descriptor(path)
                    if call(value, {"action":"status"}).get("ready"):
                        return path, value
                time.sleep(.1)
            raise RuntimeError(f"Owned qualification head {name} did not become ready.")

        try:
            manager = subprocess.Popen([sys.executable, "-m", "verona.manager", "--no-open"],
                                       cwd=ROOT, env=environment, stdout=log, stderr=log)
            deadline = time.monotonic() + 30
            while not descriptor_path.exists():
                if manager.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError("Owned manager did not start; inspect runtime.log.")
                time.sleep(.05)
            descriptor = read_descriptor(descriptor_path)
            environment["VERONA_LOCAL_URL"] = (
                f"http://127.0.0.1:{descriptor['port']}/#{descriptor['token']}")
            browser = subprocess.Popen([
                str(ELECTRON), str(ROOT / "tests" / "session_smoke.cjs"),
                f"--user-data-dir={output / 'browser-profile'}",
                f"--qualification-output={output}"], cwd=ROOT, env=environment,
                stdout=log, stderr=log)
            code = browser.wait(timeout=360)
            if code:
                raise RuntimeError(f"Unified GUI qualification failed ({code}); retain its receipt.")
            report = json.loads((output / "session-report.json").read_text())
            if report.get("error") or len(report.get("models", [])) != 6:
                raise RuntimeError("Incomplete unified session qualification.")

            def cli(*arguments, text=None):
                result = subprocess.run([sys.executable,"-m","verona.agent",*arguments],
                    cwd=ROOT,env=environment,input=text,text=True,capture_output=True,timeout=60)
                if result.returncode:
                    raise RuntimeError(f"CLI qualification failed: {result.stderr[:400]}")
                return json.loads(result.stdout)

            created = cli("create","--session","qual-cli","--model","robot",
                          "--hair-color","#123456","--lips-color","#ABC",
                          "--eyebrows-color","#778899")
            if created["state"] != "starting":
                raise RuntimeError("CLI create did not acknowledge a separately starting head.")
            _, cli_descriptor = wait_session("qual-cli", manager)
            configured = cli("configure","--session","qual-cli","--hair-color","#FEDCBA",
                             "--lips-color","default")
            if configured["appearance"]["colors"]["hair"] != "#FEDCBA" or (
                    configured["appearance"]["colors"]["lips"] is not None):
                raise RuntimeError("CLI configuration was not confirmed by the renderer.")
            if not any(row["session"]=="qual-cli" for row in cli("list")["sessions"]):
                raise RuntimeError("CLI list omitted its created session.")
            call(cli_descriptor,{"action":"configure","settings":{"volume":"0"}})
            spoken = cli("say","--session","qual-cli","--voice-only",text="A quiet CLI check.")
            if spoken["state"] != "completed":
                raise RuntimeError("CLI did not wait for actual playback completion.")
            cli("close","--session","qual-cli")
            report["cliCreateConfigureListSpeechClose"] = True
            external = subprocess.Popen([sys.executable, "-m", "verona.agent", "host",
                "--session", "external", "--model", "robot"], cwd=ROOT, env=environment,
                stdout=log, stderr=log)
            external_path, external_descriptor = wait_session("external", external)
            call(descriptor, {"action":"shutdown"})
            manager.wait(timeout=45)
            if manager.returncode or descriptor_path.exists():
                raise RuntimeError("Owned manager did not cleanly remove its descriptor.")
            if not call(external_descriptor, {"action":"status"}).get("ready"):
                raise RuntimeError("Manager Exit disturbed the external session.")
            report["externalSurvivedManagerExit"] = True
            call(external_descriptor, {"action":"close"})
            external.wait(timeout=30)
            if external.returncode or external_path.exists():
                raise RuntimeError("External head did not close when explicitly requested.")
            manager = subprocess.Popen([sys.executable, "-m", "verona.manager", "--no-open"],
                                       cwd=ROOT, env=environment, stdout=log, stderr=log)
            deadline = time.monotonic() + 30
            while not descriptor_path.exists():
                if manager.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError("Owned second manager did not start.")
                time.sleep(.05)
            descriptor = read_descriptor(descriptor_path)
            call(descriptor, {"action":"create","session":"parent-crash","model":"robot","colors":{}})
            head_path, head = wait_session("parent-crash", manager)
            kernel = ctypes.WinDLL("kernel32", use_last_error=True)
            kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
            kernel.OpenProcess.restype = wintypes.HANDLE
            kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
            kernel.CloseHandle.argtypes = [wintypes.HANDLE]
            handle = kernel.OpenProcess(0x00100000, False, head["pid"])
            if not handle:
                raise ctypes.WinError(ctypes.get_last_error())
            try:
                os.kill(descriptor["pid"], signal.SIGTERM)
                manager.wait(timeout=15)
                if kernel.WaitForSingleObject(handle, 20000) != 0:
                    raise RuntimeError("Managed host survived loss of its exact manager.")
            finally:
                kernel.CloseHandle(handle)
            if head_path.exists():
                raise RuntimeError("Parent-death shutdown retained a head descriptor.")
            if read_descriptor(descriptor_path)["instance"] != descriptor["instance"]:
                raise RuntimeError("Qualification manager descriptor changed ownership.")
            descriptor_path.unlink()
            report["parentDeathStoppedOwnedHost"] = True
            records = list((output / "appdata" / "Verona" / "agent").glob("*.json"))
            if records:
                raise RuntimeError("Qualification retained a head descriptor.")
            report["managerStopped"] = report["headDescriptorsRemoved"] = True
            (output / "session-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        finally:
            if browser and browser.poll() is None:
                stop_desktop(browser)
            if manager and manager.poll() is None:
                if descriptor:
                    call(descriptor, {"action":"shutdown"})
                manager.wait(timeout=45)
            if external and external.poll() is None:
                call(read_descriptor(external_path), {"action":"close"})
                external.wait(timeout=30)
    print(json.dumps({"report":str(output / "session-report.json"),"managerStopped":True}))


if __name__ == "__main__":
    main()

"""Exercise owned real desktop windows and synthetic background, never user apps."""

import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
from unittest.mock import patch

from verona.desktop import ELECTRON, ROOT, stop_desktop
from verona.mesh import claire_topology
from verona.server import LocalServer, create_state


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if args.output.exists() or not ELECTRON.is_file():
        parser.error("Choose a NEW receipt directory and explicitly set up the desktop runtime first.")
    args.output.mkdir(parents=True)
    with (patch("verona.engine.claire_topology", side_effect=lambda neutral, scene, cache, fingerprint:
                claire_topology(neutral, scene, args.output / "derived-cache", fingerprint)),
          patch("verona.speech.ROOT", args.output.resolve())):
        run(args)


def run(args) -> None:
    state = create_state()
    server = LocalServer(0, state)
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": .05})
    thread.start()
    environment = {key: os.environ[key] for key in
                   ("SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA",
                    "LOCALAPPDATA", "PATH") if key in os.environ}
    try:
        environment["VERONA_LOCAL_URL"] = server.url
        with tempfile.TemporaryDirectory(prefix="owned-desktop-", dir=args.output) as directory:
            with (args.output / "desktop-stderr.log").open("w") as log:
                child = subprocess.Popen(
                    [str(ELECTRON), str(ROOT / "tests" / "desktop_smoke.cjs"),
                     f"--user-data-dir={Path(directory).resolve()}",
                     f"--qualification-output={args.output.resolve()}"],
                    text=True, cwd=ROOT, env=environment,
                    stdout=log, stderr=log,
                )
                try:
                    until = time.monotonic() + 120
                    while not (args.output / "desktop-report.json").exists() and child.poll() is None:
                        if time.monotonic() >= until:
                            raise TimeoutError("Native desktop did not produce its receipt in 120 seconds.")
                        time.sleep(.05)
                    stop_desktop(child)
                    result = child.returncode
                finally:
                    stop_desktop(child)
                if result:
                    raise RuntimeError(f"Native desktop qualification failed ({result}); keep its receipt.")
                report = json.loads((args.output / "desktop-report.json").read_text())
                if report.get("error") or len(report.get("checks", [])) < 10:
                    raise RuntimeError("Native qualification did not produce its full expected receipt.")
    finally:
        state.stop.set()
        server.shutdown()
        server.server_close()
        thread.join(timeout=10)
        if thread.is_alive():
            raise RuntimeError("Owned desktop qualification server did not stop.")
    print(json.dumps({"serverStopped": True, "desktopStopped": True, "profileRemoved": True,
                      "report": str(args.output / "desktop-report.json")}))


if __name__ == "__main__":
    main()

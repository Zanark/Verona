"""Isolated production-host robot regression; never captures images."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
from unittest.mock import patch

from verona.desktop import ELECTRON, stop_desktop
from verona.mesh import claire_topology
from verona.server import LocalServer, create_state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    with (patch("verona.engine.claire_topology", side_effect=lambda neutral, scene, cache, fingerprint:
                claire_topology(neutral, scene, output / "derived-cache", fingerprint)),
          patch("verona.speech.ROOT", output)):
        state = create_state()
        server = LocalServer(0, state)
        thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": .05})
        thread.start()
        environment = {key: os.environ[key] for key in
                       ("SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA",
                        "LOCALAPPDATA", "PATH") if key in os.environ}
        environment["VERONA_LOCAL_URL"] = server.url
        try:
            with tempfile.TemporaryDirectory(prefix="owned-robot-", dir=output) as directory:
                with (output / "desktop-stderr.log").open("w") as log:
                    child = subprocess.Popen(
                        [str(ELECTRON), str(root / "tests" / "robot_smoke.cjs"),
                         f"--user-data-dir={Path(directory).resolve()}",
                         "--force-device-scale-factor=1", f"--probe-output={output / 'report.json'}"],
                        cwd=root, env=environment, stdout=log, stderr=log)
                    try:
                        child.wait(timeout=180)
                        if child.returncode:
                            raise RuntimeError(f"Robot probe failed; retain {output}.")
                    finally:
                        stop_desktop(child)
        finally:
            state.stop.set()
            server.shutdown()
            server.server_close()
            thread.join(timeout=10)
            if thread.is_alive():
                raise RuntimeError("Owned robot qualification server did not stop.")
    report = json.loads((output / "report.json").read_text())
    report["sourceSha256"] = {
        name: hashlib.sha256((root / name).read_bytes()).hexdigest()
        for name in ("verona/web/app.js", "verona/web/robot.mjs", "verona/web/index.html",
                     "tests/robot_smoke.cjs", "tests/browser_smoke.mjs")
    }
    report["cleanup"] = {"serverStopped": True, "desktopStopped": True, "profileRemoved": True}
    (output / "report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({
        "status": report["status"], "receipt": str(output / "report.json"),
        "robotTriangles": report["setup"]["description"], "seekSamples": len(report["motion"]["poses"]),
        "distinctMotionPoses": len(set(report["motion"]["poses"])),
        "distinctRenderedPoses": len(set(report["motion"]["pixelHashes"])),
        "redMaximum": report["redMaximum"], "noImagesCaptured": report["noImagesCaptured"],
        "cleanup": report["cleanup"],
    }))


if __name__ == "__main__":
    main()

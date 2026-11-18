"""Own a bounded isolated server/browser test; never drive the user's profile."""

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import time
from unittest.mock import patch

from verona.server import LocalServer, create_state
from verona.speech import POWERSHELL
from verona.mesh import claire_topology


EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="New private qualification directory.")
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Choose a new output directory to preserve previous evidence.")
    node = shutil.which("node")
    if not node or not EDGE.is_file():
        parser.error("This optional test needs the existing Node.js and Microsoft Edge.")
    args.output.mkdir(parents=True, exist_ok=False)
    with (patch("verona.engine.claire_topology", side_effect=lambda neutral, scene, cache, fingerprint:
                claire_topology(neutral, scene, args.output / "derived-cache", fingerprint)),
          patch("verona.speech.ROOT", args.output.resolve())):
        run_browser(args, node)


def run_browser(args, node) -> None:
    state = create_state()
    server = LocalServer(0, state)
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": .05})
    thread.start()
    environment = {
        key: os.environ[key] for key in
        ("SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "PATH")
        if key in os.environ
    }
    result = None
    try:
        with tempfile.TemporaryDirectory(prefix="owned-edge-", dir=args.output) as directory:
            profile = Path(directory).resolve()
            with (args.output / "edge-stderr.log").open("w", encoding="utf-8") as log:
                browser = subprocess.Popen(
                    [str(EDGE), "--headless=new", "--remote-debugging-port=0",
                     f"--user-data-dir={profile}", "--no-first-run",
                     "--no-default-browser-check", "--disable-background-networking",
                     "--disable-component-update", "--disable-sync", "--disable-extensions",
                     "--mute-audio", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
                     "about:blank"],
                    stdout=subprocess.DEVNULL, stderr=log, env=environment,
                )
                try:
                    port_file = profile / "DevToolsActivePort"
                    until = time.monotonic() + 30
                    while not port_file.is_file():
                        if browser.poll() is not None or time.monotonic() > until:
                            raise RuntimeError("Owned Edge did not expose a debugging endpoint within 30 seconds.")
                        time.sleep(.1)
                    port = int(port_file.read_text().splitlines()[0])
                    result = subprocess.run(
                        [node, str(Path(__file__).with_name("browser_smoke.mjs").resolve()),
                         server.origin, state.token, str(port), str(args.output.resolve())],
                        timeout=180, env=environment, check=False,
                    )
                finally:
                    try:
                        browser.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        # The exact Popen PID belongs to this unique test profile.
                        subprocess.run(
                            [str(POWERSHELL), "-NoProfile", "-NonInteractive", "-Command",
                             f"Stop-Process -Id {browser.pid} -ErrorAction Stop"],
                            timeout=10, check=True, env=environment,
                        )
                        browser.wait(timeout=10)
    finally:
        state.stop.set()
        server.shutdown()
        server.server_close()
        thread.join(timeout=10)
        if thread.is_alive():
            raise RuntimeError("Owned test server did not stop.")
    print(json.dumps({"serverStopped": True, "browserStopped": True,
                      "profileRemoved": True, "report": str(args.output / "browser-report.json")}))
    if result is None or result.returncode:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

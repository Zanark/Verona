"""Qualify idle life with real selected engines and an owned native agent."""

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
from unittest.mock import patch

from verona.desktop import ELECTRON, ROOT, stop_desktop


MODELS = ("claire", "mpfb", "mark", "reference-structure", "reference-shell", "male-sharp")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--model", choices=(*MODELS, "all"), default="claire")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists() or not ELECTRON.is_file():
        parser.error("Choose a NEW receipt directory and use the explicitly installed desktop runtime.")
    output.mkdir(parents=True)
    if args.model == "all":
        reports = []
        for model in MODELS:
            subprocess.run([sys.executable, "-m", "tests.run_idle_smoke", "--model", model,
                            "--output", str(output / model)], cwd=ROOT, check=True, timeout=240)
            reports.append(json.loads((output / model / "idle-report.json").read_text()))
        (output / "all-models.json").write_text(json.dumps({
            "models": [{"model": row["model"], "checks": len(row["checks"]),
                        "views": row["views"], "waiting": row["waiting"]} for row in reports],
            "allOwnedProcessesStopped": True,
            "limits": "Owned native renderer pixels; muted audio, not OS composition or human acceptance.",
        }, indent=2) + "\n", encoding="utf-8")
        return
    run(args.model, output)


def run(model, output, name="idle", extra_args=(), performance_mode=False):
    from verona.agent_host import AgentBridge
    from verona.agent_speech import SpeechWorker
    from verona.engine import FaceEngine
    from verona.mesh import claire_topology
    from verona.server import LocalServer, State
    from verona.session_config import appearance
    from verona.variants import prepare_variant

    with (patch("verona.engine.claire_topology", side_effect=lambda n, s, c, f:
                claire_topology(n, s, output / "derived-cache", f)),
          patch("verona.speech.ROOT", output)):
        speech = SpeechWorker()
        bridge = server = thread = child = None
        try:
            state = State(FaceEngine("mark" if model == "mark" else "claire"), speech.voices)
            state.static = prepare_variant(state.engine, model)
            state.appearance = appearance(model, {}, "idle-qualification", performance_mode=performance_mode)
            state.synthesizer = speech.synthesize
            bridge = AgentBridge(state, output / "owned-agent.json", speech)
            state.agent = bridge
            server = LocalServer(0, state)
            thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": .05})
            thread.start()
            environment = {key: os.environ[key] for key in
                           ("SystemRoot", "SystemDrive", "ProgramData", "ALLUSERSPROFILE",
                            "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "PATH")
                           if key in os.environ}
            environment.update(VERONA_LOCAL_URL=server.url, VERONA_AGENT_MODE="1",
                               VERONA_AGENT_PORT=str(bridge.listen()),
                               OPENBLAS_NUM_THREADS="2", OMP_NUM_THREADS="2")
            with tempfile.TemporaryDirectory(prefix="owned-idle-", dir=output) as profile:
                with (output / "native.log").open("w", encoding="utf-8") as log:
                    child = subprocess.Popen([
                        str(ELECTRON), str(ROOT / "tests" / f"{name}_smoke.cjs"),
                        f"--user-data-dir={profile}", f"--qualification-output={output}",
                        f"--qualification-model={model}", *extra_args], cwd=ROOT, env=environment,
                        stdout=log, stderr=log)
                    bridge.attach(child, server)
                    try:
                        code = child.wait(timeout=300 if name == "performance" else 210)
                        if code:
                            raise RuntimeError(f"Owned {model} qualification failed ({code}); retain {name}-report.json/native.log.")
                    finally:
                        stop_desktop(child)
            report = json.loads((output / f"{name}-report.json").read_text())
            if report.get("error") or len(report.get("views", [])) != 4:
                raise RuntimeError("Idle qualification did not produce all four view receipts.")
        finally:
            if child is not None:
                stop_desktop(child)
            if bridge is not None:
                bridge.close()
            else:
                speech.close()
            if server is not None:
                state.stop.set()
                server.shutdown()
                server.server_close()
                thread.join(timeout=10)
                if thread.is_alive():
                    raise RuntimeError("Owned idle server did not stop.")
    print(json.dumps({"model": model, "serverStopped": True, "nativeStopped": True,
                      "descriptorRemoved": not (output / "owned-agent.json").exists(),
                      "profileRemoved": True, "report": str(output / f"{name}-report.json")}))


if __name__ == "__main__":
    main()

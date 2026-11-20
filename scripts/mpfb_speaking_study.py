"""Opt-in native MPFB head with transferred Claire speech; production is unchanged."""

import argparse
from contextlib import contextmanager
import tempfile
from pathlib import Path
import threading
from unittest.mock import patch
import webbrowser

from scripts.mpfb_motion_transfer import apply_transfer


@contextmanager
def native_session(port=0):
    from verona.engine import FaceEngine
    from verona.mesh import claire_topology
    from verona.server import LocalServer, State
    from verona.speech import installed_voices

    static = {
        "/": ("mpfb.html", "text/html; charset=utf-8"),
        "/app.js": ("mpfb.js", "text/javascript; charset=utf-8"),
        "/style.css": ("mpfb.css", "text/css; charset=utf-8"),
        "/mpfb-renderer.mjs": ("mpfb-renderer.mjs", "text/javascript; charset=utf-8"),
    }
    with tempfile.TemporaryDirectory(prefix="verona-native-mpfb-") as directory:
        owned = Path(directory)
        with (patch("verona.engine.claire_topology", side_effect=lambda n,s,c,f:
                    claire_topology(n,s,owned/"cache",f)),
              patch("verona.speech.ROOT", owned),
              patch.dict("verona.server.STATIC", static, clear=True)):
            engine = FaceEngine()
            receipt = apply_transfer(engine)
            state = State(engine, installed_voices())
            server = LocalServer(port, state)
            thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": .05})
            thread.start()
            try:
                yield server, receipt
            finally:
                state.stop.set()
                server.shutdown()
                server.server_close()
                thread.join()
                state.clip = state.speech = None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=0)
    parser.add_argument("--no-open", action="store_true")
    args = parser.parse_args()
    with native_session(args.port) as (server, receipt):
        print(f"Native MPFB / Claire 4x study ready ({receipt['fitSeconds']:.2f}s binding).", flush=True)
        print(f"{server.url}\nKeep this console open. Ctrl+C stops it and clears speech RAM.", flush=True)
        if not args.no_open and not webbrowser.open(server.url):
            raise RuntimeError("Browser launch failed; restart with --no-open and open its printed URL.")
        try:
            server.state.stop.wait()
        except KeyboardInterrupt:
            print("Stopping this owned MPFB study.")


if __name__ == "__main__":
    main()

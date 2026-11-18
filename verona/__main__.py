"""Launch the small local Verona text-to-face window."""

import argparse
import os
import sys
import webbrowser

from .server import LocalServer, create_state


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=0, help="Local port; 0 chooses an available one.")
    parser.add_argument("--open", action="store_true", help="Open the ready page in your default browser.")
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("Port must be 0-65535.")
    try:
        state = create_state()
        server = LocalServer(args.port, state)
    except (OSError, RuntimeError, ValueError) as error:
        print(f"Verona could not start: {error}", file=sys.stderr)
        print("See README.md for local setup; nothing was downloaded automatically.", file=sys.stderr)
        raise SystemExit(1) from error
    print(f"Verona ready: {server.url}", flush=True)
    print(f"Local process {os.getpid()}. Press Ctrl+C here to stop; no background service is installed.", flush=True)
    if args.open and not webbrowser.open(server.url, new=2):
        print("Browser did not open; use the local URL above.", file=sys.stderr)
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print("\nStopping Verona; a current Windows speech step may take up to 45 seconds.", flush=True)
    finally:
        state.stop.set()
        server.server_close()


if __name__ == "__main__":
    main()

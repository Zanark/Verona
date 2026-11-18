"""Generate a private offline clip from text without launching a server."""

import argparse
import json
from pathlib import Path

from .engine import FaceEngine
from .speech import installed_voices, synthesize


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--text", required=True)
    parser.add_argument("--output", type=Path, required=True, help="New directory; never overwritten.")
    parser.add_argument("--voice", help="Exact installed English desktop voice.")
    parser.add_argument("--expression", choices=("neutral", "happy", "sad", "surprised"), default="neutral")
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Output directory already exists; choose a new one.")
    voices = installed_voices()
    speech = synthesize(args.text, args.voice or voices[0]["name"], voices)
    engine = FaceEngine()
    clip = engine.generate(speech, args.expression)
    args.output.mkdir(parents=True, exist_ok=False)
    (args.output / "audio.wav").write_bytes(clip.audio)
    (args.output / "motion.bin").write_bytes(clip.motion)
    (args.output / "mesh.bin").write_bytes(engine.mesh_bytes)
    (args.output / "clip.json").write_text(
        json.dumps({"mesh": engine.mesh_metadata, "clip": clip.metadata}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(clip.metadata, indent=2))


if __name__ == "__main__":
    main()

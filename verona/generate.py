"""Generate a private offline clip from text without launching a server."""

import argparse
import json
from pathlib import Path

from .engine import FaceEngine
from .speech import VoiceSettings, installed_voices, preferred_voice, synthesize


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--text", required=True)
    parser.add_argument("--output", type=Path, required=True, help="New directory; never overwritten.")
    parser.add_argument("--voice", help="Exact installed English desktop voice.")
    parser.add_argument("--expression", choices=("neutral", "happy", "sad", "surprised"), default="neutral")
    parser.add_argument("--pitch", type=int, default=0, help="Pitch request in semitones, -8 to 8.")
    parser.add_argument("--rate", type=int, default=0, help="Windows speaking-rate steps, -5 to 5.")
    parser.add_argument("--bass", type=int, default=0, help="Bass shelf dB, -6 to 6.")
    parser.add_argument("--treble", type=int, default=0, help="Treble shelf dB, -6 to 6.")
    parser.add_argument("--emphasis", choices=("none", "reduced", "moderate", "strong"), default="none")
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Output directory already exists; choose a new one.")
    voices = installed_voices()
    voice = args.voice or preferred_voice(voices)
    if not args.voice and voice != "Microsoft Hazel Desktop":
        print(f"Hazel is not installed; using the available voice {voice}.")
    settings = VoiceSettings.parse({n: getattr(args, n) for n in ("pitch", "rate", "bass", "treble", "emphasis")})
    speech = synthesize(args.text, voice, voices, settings)
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

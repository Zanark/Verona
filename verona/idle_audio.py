"""Exact authenticated routes for explicitly prepared, ignored local idle effects."""

import io
from pathlib import Path
import wave

DIRECTORY = Path(__file__).resolve().parents[1] / ".local" / "idle-sounds"
LIMITS = {"yawn": 100800, "sneeze": 64800}
ROUTES = {f"/api/idle-sound/{kind}-{style}": f"{kind}-{style}.wav"
          for kind in LIMITS for style in ("male", "female")}
MAX_BYTES = 202000


def read_effect(route: str) -> bytes:
    path = DIRECTORY / ROUTES[route]
    frames = LIMITS[path.stem.split("-")[0]]
    try:
        if path.stat().st_size > MAX_BYTES:
            raise RuntimeError("Prepared idle effect exceeds its bounded audio size.")
        with path.open("rb") as stream:
            data = stream.read(MAX_BYTES+1)
        if len(data) > MAX_BYTES:
            raise RuntimeError("Prepared idle effect exceeds its bounded audio size.")
    except OSError as error:
        raise RuntimeError("Local idle effect is missing or unreadable; prepare the supplied effects first.") from error
    try:
        with wave.open(io.BytesIO(data), "rb") as sound:
            if (sound.getnchannels(), sound.getsampwidth(), sound.getframerate()) != (1, 2, 24000):
                raise RuntimeError("Prepared idle effect must be mono 24-kHz PCM16 WAV.")
            if not 0 < sound.getnframes() <= frames or len(sound.readframes(frames+1)) != sound.getnframes()*2:
                raise RuntimeError(f"Prepared idle effect must contain at most {frames/24000:g} seconds of complete PCM.")
    except (wave.Error, EOFError) as error:
        raise RuntimeError("Prepared local idle effect is invalid WAV audio.") from error
    return data

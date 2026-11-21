"""Exact authenticated routes for explicitly prepared, ignored local yawn effects."""

import io
from pathlib import Path
import wave

DIRECTORY = Path(__file__).resolve().parents[1] / ".local" / "idle-sounds"
ROUTES = {f"/api/idle-sound/yawn-{style}": f"yawn-{style}.wav" for style in ("male", "female")}
MAX_BYTES = 202000


def read_yawn(route: str) -> bytes:
    path = DIRECTORY / ROUTES[route]
    try:
        if path.stat().st_size > MAX_BYTES:
            raise RuntimeError("Prepared yawn exceeds its bounded audio size.")
        with path.open("rb") as stream:
            data = stream.read(MAX_BYTES+1)
        if len(data) > MAX_BYTES:
            raise RuntimeError("Prepared yawn exceeds its bounded audio size.")
    except OSError as error:
        raise RuntimeError("Local yawn is missing or unreadable; prepare the supplied effects first.") from error
    try:
        with wave.open(io.BytesIO(data), "rb") as sound:
            if (sound.getnchannels(), sound.getsampwidth(), sound.getframerate()) != (1, 2, 24000):
                raise RuntimeError("Prepared yawn must be mono 24-kHz PCM16 WAV.")
            if not 0 < sound.getnframes() <= 100800 or len(sound.readframes(100801)) != sound.getnframes()*2:
                raise RuntimeError("Prepared yawn must contain at most 4.2 seconds of complete PCM.")
    except (wave.Error, EOFError) as error:
        raise RuntimeError("Prepared local yawn is invalid WAV audio.") from error
    return data

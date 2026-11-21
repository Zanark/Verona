"""Optional voice metadata and pinned assets; importing this loads no TTS stack."""

import hashlib
import importlib.util
from pathlib import Path


MODEL_ROOT = Path(__file__).resolve().parents[1] / ".local" / "models" / "kokoro-v1.0"
ASSETS = {
    "kokoro-v1.0.int8.onnx": (92361271, "6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb"),
    "voices-v1.0.bin": (28214398, "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d"),
}
SOURCE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
VOICE_IDS = (
    "af_heart", "af_bella", "am_michael", "bf_emma", "af_nicole", "bm_george",
    "af_sarah", "am_fenrir", "bm_fable", "af_kore", "af_aoede", "am_puck",
    "af_nova", "bf_isabella", "af_alloy", "af_jessica", "af_river", "af_sky",
    "am_adam", "am_echo", "am_eric", "am_liam", "am_onyx", "am_santa",
    "bf_alice", "bf_lily", "bm_daniel", "bm_lewis",
)


def voice_metadata():
    return [{"name": "Kokoro " + key[3:].title(), "id": key, "provider": "kokoro",
             "culture": "en-US" if key[0] == "a" else "en-GB",
             "style": "female" if key[1] == "f" else "male",
             "pitchSupported": False, "emphasisSupported": False}
            for key in VOICE_IDS]


def voice_pack_status():
    missing = [name for name, (size, _) in ASSETS.items()
               if not (MODEL_ROOT / name).is_file() or (MODEL_ROOT / name).stat().st_size != size]
    dependencies = [name for name in ("kokoro_onnx", "soxr")
                    if importlib.util.find_spec(name) is None]
    ready = not missing and not dependencies
    return {"ready": ready, "voices": len(VOICE_IDS) if ready else 0,
            "message": "28 optional English Kokoro voices installed locally; synthesis is offline."
            if ready else "Optional Kokoro voices unavailable. Run explicit setup: "
            "python -m pip install -r requirements-local-voices.txt; "
            "python scripts\\fetch_local_voices.py",
            "missingAssets": missing, "missingDependencies": dependencies}


def local_voice_catalog():
    return voice_metadata() if voice_pack_status()["ready"] else []


def verify_assets():
    for name, (size, expected) in ASSETS.items():
        path = MODEL_ROOT / name
        if not path.is_file() or path.stat().st_size != size:
            raise RuntimeError(f"Local voice asset {name} is missing or incomplete; run explicit voice setup.")
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            while chunk := stream.read(1024 * 1024):
                digest.update(chunk)
        if digest.hexdigest() != expected:
            raise RuntimeError(f"Local voice asset {name} failed SHA-256; it was not loaded.")


def is_local_voice(name):
    return isinstance(name, str) and name.startswith("Kokoro ")


def validate_voice_settings(voice, settings):
    if is_local_voice(voice) and (settings.pitch != 0 or settings.emphasis != "none"):
        raise ValueError("Kokoro supports speed, bass and treble, not pitch/emphasis. Reset pitch to 0 and emphasis to none.")


def choose_session_voice(voices, used, requested=None):
    names = [row["name"] for row in voices]
    if requested is not None:
        if not isinstance(requested, str) or requested not in names:
            raise ValueError("Choose an installed voice; no voice was substituted.")
        if requested in used:
            raise ValueError("That voice is already used by another session; choose a different voice.")
        return requested
    ordered = [name for name in names if is_local_voice(name)] + [
        name for name in names if not is_local_voice(name)]
    for name in ordered:
        if name not in used:
            return name
    raise ValueError("All installed voices are in use; close an unused head or install more voices.")

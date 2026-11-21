"""Bounded stdin/stdout-only local TTS child. No downloads or speech files."""

import base64
import json
import sys

from .local_voices import MODEL_ROOT, validate_voice_settings, verify_assets, voice_metadata
from .speech import MAX_SECONDS, SAMPLE_RATE, VoiceSettings, validate_text


class LocalSynthesizer:
    def __init__(self):
        self.model = None

    def synthesize(self, request):
        text = validate_text(request["text"])
        settings = VoiceSettings.parse(request["settings"])
        voice = next((row for row in voice_metadata() if row["name"] == request["voice"]), None)
        if voice is None:
            raise ValueError("Choose an installed local Kokoro voice.")
        validate_voice_settings(voice["name"], settings)
        import numpy as np
        import soxr
        if self.model is None:
            verify_assets()
            import onnxruntime as rt
            from kokoro_onnx import Kokoro
            options = rt.SessionOptions()
            options.intra_op_num_threads = 2
            options.inter_op_num_threads = 1
            options.enable_cpu_mem_arena = False
            options.log_severity_level = 3
            session = rt.InferenceSession(str(MODEL_ROOT / "kokoro-v1.0.int8.onnx"),
                                          sess_options=options, providers=["CPUExecutionProvider"])
            self.model = Kokoro.from_session(session, str(MODEL_ROOT / "voices-v1.0.bin"))
        audio, rate = self.model.create(
            text, voice=voice["id"], speed=2 ** (settings.rate / 5),
            lang="en-us" if voice["culture"] == "en-US" else "en-gb")
        if (rate != 24000 or audio.ndim != 1 or not len(audio)
                or not np.isfinite(audio).all()):
            raise RuntimeError("Local neural voice returned invalid audio.")
        if len(audio) > MAX_SECONDS * rate:
            raise ValueError("Local speech exceeds 25 seconds; shorten the text or increase speed.")
        audio = soxr.resample(audio, rate, SAMPLE_RATE, quality="HQ")
        return np.rint(np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes()


def main():
    synth = LocalSynthesizer()
    while True:
        line = sys.stdin.readline(8193)
        if not line:
            return
        if len(line) > 8192:
            print(json.dumps({"error": "Local voice request exceeds its input limit; restart the worker."}), flush=True)
            return
        try:
            request = json.loads(line)
            if not isinstance(request, dict):
                raise ValueError("Supply one local voice request object.")
            if request.get("action") == "voices":
                result = {"voices": voice_metadata()}
            elif request.get("action") == "speak":
                result = {"pcm": base64.b64encode(synth.synthesize(request)).decode("ascii")}
            else:
                raise ValueError("Unsupported local voice action.")
        except (ValueError, RuntimeError, OSError, ImportError) as error:
            # Third-party exceptions can contain the input text; never echo it.
            result = {"error": f"Local Kokoro failed ({type(error).__name__}). Check the voice setup, "
                      "use pitch 0/emphasis none and keep speech below 25 seconds; no voice was substituted."}
        print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()

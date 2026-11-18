"""Bounded Windows offline plain-text synthesis, with no user text in commands."""

from dataclasses import asdict, dataclass
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import wave
import xml.etree.ElementTree as ET

os.environ["OPENBLAS_NUM_THREADS"] = "2"
os.environ["OMP_NUM_THREADS"] = "2"
import numpy as np

from scripts.fetch_cpu_model import ROOT


MAX_TEXT = 280
MAX_SECONDS = 25
SAMPLE_RATE = 16000
LEAD_SAMPLES = 2880
TAIL_SAMPLES = 6400
POWERSHELL = Path(os.environ.get("SystemRoot", r"C:\Windows")) / (
    r"System32\WindowsPowerShell\v1.0\powershell.exe"
)
SCRIPT = r"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    if ($request.action -eq 'voices') {
        $voices = @($synth.GetInstalledVoices() | Where-Object {
            $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq 'en'
        } | ForEach-Object {
            @{ name = $_.VoiceInfo.Name; culture = $_.VoiceInfo.Culture.Name }
        })
        ConvertTo-Json -InputObject $voices -Compress
    } elseif ($request.action -eq 'speak') {
        $synth.SelectVoice($request.voice)
        $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
            16000,
            [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
            [System.Speech.AudioFormat.AudioChannel]::Mono)
        $synth.SetOutputToWaveFile($request.output, $format)
        $synth.Rate = [int]$request.rate
        $synth.SpeakSsml([string]$request.ssml)
        $synth.SetOutputToNull()
        Write-Output '{"ok":true}'
    } else { throw 'Unsupported speech action.' }
} finally { $synth.Dispose() }
"""


@dataclass(frozen=True)
class VoiceSettings:
    pitch: int = 0
    rate: int = 0
    emphasis: str = "none"
    bass: int = 0
    treble: int = 0

    @classmethod
    def parse(cls, values: object) -> "VoiceSettings":
        if not isinstance(values, dict) or set(values) - set(asdict(cls())):
            raise ValueError("Supply only pitch, rate, emphasis, bass and treble voice settings.")
        settings = cls(**values)
        for name, low, high in (("pitch", -8, 8), ("rate", -5, 5),
                                ("bass", -6, 6), ("treble", -6, 6)):
            value = getattr(settings, name)
            if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
                raise ValueError(f"Voice {name} must be an integer from {low} to {high}.")
        if settings.emphasis not in ("none", "reduced", "moderate", "strong"):
            raise ValueError("Choose none, reduced, moderate or strong emphasis.")
        return settings


def preferred_voice(voices: list[dict[str, str]]) -> str:
    return next((v["name"] for v in voices if v["name"] == "Microsoft Hazel Desktop"), voices[0]["name"])


def speech_markup(text: str, culture: str, settings: VoiceSettings) -> str:
    namespace = "http://www.w3.org/2001/10/synthesis"
    root = ET.Element("speak", {"xmlns": namespace, "version": "1.0",
                               "xml:lang": culture})
    prosody = ET.SubElement(root, "prosody", {"pitch": f"{settings.pitch:+d}st"})
    ET.SubElement(prosody, "emphasis", {"level": settings.emphasis}).text = text
    return ET.tostring(root, encoding="unicode")


def shape_tone(raw: bytes, bass: int, treble: int) -> bytes:
    if bass == treble == 0:
        return raw
    samples = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768
    # Separate the clip's ends before applying the FFT-domain shelves.
    padding = SAMPLE_RATE // 2
    padded = np.pad(samples, (padding, padding))
    frequencies = np.fft.rfftfreq(len(padded), 1 / SAMPLE_RATE)
    low = 1 / (1 + (frequencies / 300) ** 4)
    high = 1 - 1 / (1 + (frequencies / 2200) ** 4)
    gain = 10 ** ((bass * low + treble * high) / 20)
    shaped = np.fft.irfft(np.fft.rfft(padded) * gain, n=len(padded))[padding:padding + len(samples)]
    peak = float(np.max(np.abs(shaped)))
    if peak > 0.98:
        shaped *= 0.98 / peak
    return np.rint(shaped * 32767).astype("<i2").tobytes()


@dataclass(frozen=True)
class Speech:
    wav: bytes
    pcm: bytes
    voice: str
    settings: VoiceSettings = VoiceSettings()

    @property
    def seconds(self) -> float:
        return len(self.pcm) / (2 * SAMPLE_RATE)


def validate_text(text: object) -> str:
    if not isinstance(text, str) or not text.strip() or len(text) > MAX_TEXT:
        raise ValueError(f"Enter 1-{MAX_TEXT} characters of plain text.")
    if any(ord(c) < 32 and c not in "\n\t\r" for c in text):
        raise ValueError("Text contains unsupported control characters.")
    if any(0xD800 <= ord(c) <= 0xDFFF for c in text):
        raise ValueError("Text contains an invalid Unicode surrogate.")
    if "\ufffe" in text or "\uffff" in text:
        raise ValueError("Text contains an unsupported XML character.")
    return text.strip()


def speech_command(request: dict) -> object:
    if not POWERSHELL.is_file():
        raise RuntimeError("Windows PowerShell/System.Speech is required for local TTS.")
    environment = {
        key: os.environ[key]
        for key in ("SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA")
        if key in os.environ
    }
    try:
        completed = subprocess.run(
            [str(POWERSHELL), "-NoProfile", "-NonInteractive", "-Command", SCRIPT],
            input=json.dumps(request, ensure_ascii=True),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=45,
            env=environment,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise RuntimeError("Local Windows speech synthesis exceeded its 45-second limit.") from error
    if completed.returncode:
        raise RuntimeError(f"Local Windows speech failed: {completed.stderr.strip()[:2000]}")
    try:
        return json.loads(completed.stdout.lstrip("\ufeff"))
    except json.JSONDecodeError as error:
        raise RuntimeError("Windows speech returned an invalid response.") from error


def installed_voices() -> list[dict[str, str]]:
    result = speech_command({"action": "voices"})
    if not isinstance(result, list) or not result:
        raise RuntimeError("No enabled English Windows desktop speech voice is installed.")
    if any(not isinstance(v, dict) or not isinstance(v.get("name"), str)
           or not isinstance(v.get("culture"), str) for v in result):
        raise RuntimeError("Windows speech returned invalid voice metadata.")
    return result


def package_pcm(raw: bytes) -> bytes:
    with io.BytesIO() as output:
        with wave.open(output, "wb") as stream:
            stream.setnchannels(1)
            stream.setsampwidth(2)
            stream.setframerate(SAMPLE_RATE)
            stream.writeframes(raw)
        return output.getvalue()


def synthesize(
    text: object, voice: str, voices: list[dict[str, str]],
    settings: VoiceSettings = VoiceSettings(),
) -> Speech:
    text = validate_text(text)
    settings = VoiceSettings.parse(asdict(settings))
    if voice not in [v["name"] for v in voices]:
        raise ValueError("Choose one of the installed English voices.")
    work = ROOT / ".local" / "work"
    work.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="speech-", dir=work) as directory:
        target = Path(directory) / "speech.wav"
        culture = next(v.get("culture", "en-US") for v in voices if v["name"] == voice)
        speech_command({"action": "speak", "voice": voice, "output": str(target),
                        "rate": settings.rate, "ssml": speech_markup(text, culture, settings)})
        if not target.is_file() or target.stat().st_size > MAX_SECONDS * SAMPLE_RATE * 2 + 4096:
            raise ValueError(f"Speech must fit within {MAX_SECONDS} seconds; shorten the text.")
        with wave.open(str(target), "rb") as stream:
            if (stream.getnchannels(), stream.getsampwidth(), stream.getframerate(),
                    stream.getcomptype()) != (1, 2, SAMPLE_RATE, "NONE"):
                raise RuntimeError("Windows speech did not produce mono 16 kHz 16-bit PCM.")
            raw = stream.readframes(stream.getnframes())
            if not raw or len(raw) != stream.getnframes() * 2:
                raise RuntimeError("Windows speech produced empty or truncated audio.")
    raw = shape_tone(raw, settings.bass, settings.treble)
    pcm = bytes(LEAD_SAMPLES * 2) + raw + bytes(TAIL_SAMPLES * 2)
    if len(pcm) > MAX_SECONDS * SAMPLE_RATE * 2:
        raise ValueError(f"Speech must fit within {MAX_SECONDS} seconds; shorten the text.")
    return Speech(package_pcm(pcm), pcm, voice, settings)

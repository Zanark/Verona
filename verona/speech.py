"""Bounded Windows offline plain-text synthesis, with no user text in commands."""

from dataclasses import dataclass
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import wave

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
        $synth.Speak([string]$request.text)
        $synth.SetOutputToNull()
        Write-Output '{"ok":true}'
    } else { throw 'Unsupported speech action.' }
} finally { $synth.Dispose() }
"""


@dataclass(frozen=True)
class Speech:
    wav: bytes
    pcm: bytes
    voice: str

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


def synthesize(text: object, voice: str, voices: list[dict[str, str]]) -> Speech:
    text = validate_text(text)
    if voice not in [v["name"] for v in voices]:
        raise ValueError("Choose one of the installed English voices.")
    work = ROOT / ".local" / "work"
    work.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="speech-", dir=work) as directory:
        target = Path(directory) / "speech.wav"
        speech_command({"action": "speak", "text": text, "voice": voice, "output": str(target)})
        if not target.is_file() or target.stat().st_size > MAX_SECONDS * SAMPLE_RATE * 2 + 4096:
            raise ValueError(f"Speech must fit within {MAX_SECONDS} seconds; shorten the text.")
        with wave.open(str(target), "rb") as stream:
            if (stream.getnchannels(), stream.getsampwidth(), stream.getframerate(),
                    stream.getcomptype()) != (1, 2, SAMPLE_RATE, "NONE"):
                raise RuntimeError("Windows speech did not produce mono 16 kHz 16-bit PCM.")
            raw = stream.readframes(stream.getnframes())
            if not raw or len(raw) != stream.getnframes() * 2:
                raise RuntimeError("Windows speech produced empty or truncated audio.")
    pcm = bytes(LEAD_SAMPLES * 2) + raw + bytes(TAIL_SAMPLES * 2)
    if len(pcm) > MAX_SECONDS * SAMPLE_RATE * 2:
        raise ValueError(f"Speech must fit within {MAX_SECONDS} seconds; shorten the text.")
    return Speech(package_pcm(pcm), pcm, voice)

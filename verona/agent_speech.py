"""One bounded, RAM-only System.Speech worker for an explicitly started agent host."""

from dataclasses import asdict
import base64
import json
import os
import queue
import subprocess
import threading

from .speech import POWERSHELL, Speech, VoiceSettings, finish_speech, speech_markup, validate_text


WORKER_SCRIPT = r"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
    16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono)
try {
    while ($null -ne ($line = [Console]::ReadLine())) {
        try {
            $request = $line | ConvertFrom-Json
            if ($request.action -eq 'voices') {
                $voices = @($synth.GetInstalledVoices() | Where-Object {
                    $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq 'en'
                } | ForEach-Object {
                    @{ name = $_.VoiceInfo.Name; culture = $_.VoiceInfo.Culture.Name }
                })
                $result = @{ voices = $voices }
            } elseif ($request.action -eq 'speak') {
                $buffer = New-Object System.IO.MemoryStream
                try {
                    $synth.SelectVoice($request.voice)
                    $synth.Rate = [int]$request.rate
                    $synth.SetOutputToAudioStream($buffer, $format)
                    $synth.SpeakSsml([string]$request.ssml)
                    $synth.SetOutputToNull()
                    if ($buffer.Length -gt 800000) { throw 'Speech exceeds 25 seconds.' }
                    $result = @{ pcm = [Convert]::ToBase64String($buffer.ToArray()) }
                } finally { $buffer.Dispose() }
            } else { throw 'Unsupported speech action.' }
        } catch { $result = @{ error = $_.Exception.Message } }
        [Console]::WriteLine(($result | ConvertTo-Json -Compress -Depth 4))
        [Console]::Out.Flush()
    }
} finally { $synth.Dispose() }
"""


class SpeechWorker:
    def __init__(self) -> None:
        if not POWERSHELL.is_file():
            raise RuntimeError("Windows PowerShell/System.Speech is required.")
        environment = {k: os.environ[k] for k in (
            "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA")
            if k in os.environ}
        self.process = subprocess.Popen(
            [str(POWERSHELL), "-NoProfile", "-NonInteractive", "-Command", WORKER_SCRIPT],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, encoding="utf-8", env=environment,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        self.results = queue.Queue(maxsize=1)
        self.error = None
        self.lock = threading.Lock()
        self.reader = threading.Thread(target=self._read, daemon=True)
        self.reader.start()
        try:
            self.voices = self._call({"action": "voices"})["voices"]
            if (not isinstance(self.voices, list) or not self.voices
                    or any(not isinstance(v, dict) or not isinstance(v.get("name"), str)
                           or not isinstance(v.get("culture"), str) for v in self.voices)):
                raise RuntimeError("No valid enabled English Windows voice is installed.")
        except (OSError, RuntimeError, ValueError, KeyError):
            self.close()
            raise

    def _read(self) -> None:
        try:
            while True:
                line = self.process.stdout.readline(1_100_001)
                if not line:
                    raise RuntimeError("Windows speech worker exited; restart the named agent host.")
                if len(line) > 1_100_000:
                    raise RuntimeError("Windows speech worker returned oversized audio.")
                result = json.loads(line.lstrip("\ufeff"))
                if not isinstance(result, dict):
                    raise RuntimeError("Windows speech worker returned an invalid response.")
                self.results.put_nowait(result)
        except (OSError, ValueError, RuntimeError, queue.Full) as error:
            self.error = str(error) or "Unexpected extra Windows speech response."
            try:
                self.results.put_nowait({"error": self.error})
            except queue.Full:
                pass  # The consumer also checks self.error before accepting its response.

    def _call(self, request: dict) -> dict:
        if not self.lock.acquire(blocking=False):
            raise RuntimeError("Windows speech worker is already busy; no request was queued.")
        try:
            if self.error:
                raise RuntimeError(self.error)
            self.process.stdin.write(json.dumps(request, ensure_ascii=True) + "\n")
            self.process.stdin.flush()
            try:
                result = self.results.get(timeout=45)
            except queue.Empty as error:
                self.close()
                raise RuntimeError("Windows speech exceeded 45 seconds; restart the named host.") from error
            if self.error or "error" in result:
                raise RuntimeError(self.error or result["error"])
            return result
        finally:
            self.lock.release()

    def synthesize(self, text: object, voice: str, voices: list[dict],
                   settings: VoiceSettings) -> Speech:
        text = validate_text(text)
        settings = VoiceSettings.parse(asdict(settings))
        if voice not in [v["name"] for v in self.voices]:
            raise ValueError("Choose one of the installed English voices.")
        culture = next(v["culture"] for v in self.voices if v["name"] == voice)
        response = self._call({"action": "speak", "voice": voice, "rate": settings.rate,
                               "ssml": speech_markup(text, culture, settings)})
        if not isinstance(response.get("pcm"), str):
            raise RuntimeError("Windows speech worker omitted its PCM audio.")
        try:
            raw = base64.b64decode(response["pcm"], validate=True)
        except ValueError as error:
            raise RuntimeError("Windows speech worker returned invalid PCM encoding.") from error
        return finish_speech(raw, voice, settings)

    def close(self) -> None:
        if self.process.poll() is None:
            self.process.terminate()
            self.process.wait(timeout=5)
        self.reader.join(timeout=5)
        if self.reader.is_alive():
            raise RuntimeError("Owned Windows speech reader did not stop.")
        self.process.stdin.close()
        self.process.stdout.close()

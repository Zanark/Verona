"""Dedicated warm host and bounded native-push coordination; no narration hooks."""

import hashlib
import json
import math
import os
import re
import secrets
import socket
import sys
import threading
import time
import uuid
from contextlib import ExitStack

from .agent import private_descriptor, read_descriptor
from .agent_speech import SpeechWorker
from .engine import FaceEngine, expression_condition, validate_expression_gain
from .server import State
from .speech import preferred_voice, validate_text


TERMINAL = {"completed", "failed", "cancelled"}


class AgentBridge:
    def __init__(self, state: State, path, speech: SpeechWorker) -> None:
        self.state, self.path, self.speech = state, path, speech
        self.condition = threading.Condition()
        self.ready = False
        self.closed = False
        self.child = self.reader = None
        self.descriptor = None
        self.job = None
        self.version = 0
        self.fault = None
        self.listener = self.connection = self.writer = None

    def listen(self) -> int:
        self.listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.listener.bind(("127.0.0.1", 0))
        self.listener.listen(1)
        self.listener.settimeout(1)
        return self.listener.getsockname()[1]

    def attach(self, child, server) -> None:
        self.child = child
        descriptor = {"version": 1, "port": server.server_port, "token": self.state.token,
                      "pid": os.getpid(), "instance": uuid.uuid4().hex}
        private_descriptor(self.path, descriptor)
        self.descriptor = descriptor
        self.reader = threading.Thread(target=self._read, daemon=True)
        self.reader.start()

    def snapshot(self) -> dict:
        result = {"ready": self.ready and not self.closed, "version": self.version,
                  "state": "disconnected" if self.closed else "failed" if self.fault
                  else "idle" if self.ready else "starting"}
        if self.fault:
            result["error"] = self.fault
        if self.job:
            result.update({k: v for k, v in self.job.items()
                           if k not in ("fingerprint", "cancel", "started")})
        return result

    def _send(self, payload: dict) -> None:
        try:
            self.writer.write(json.dumps(payload, ensure_ascii=True) + "\n")
            self.writer.flush()
        except (OSError, ValueError) as error:
            self.ready = False
            self.fault = "Owned native player disconnected; no speech was retried."
            if self.job and self.job["state"] not in TERMINAL:
                self.job["cancel"].set()
                self.job.update(state="failed", error=self.fault)
            self.version += 1
            self.condition.notify_all()
            raise RuntimeError(self.fault) from error

    def command(self, request: object) -> dict:
        if not isinstance(request, dict) or not isinstance(request.get("action"), str):
            raise ValueError("Supply one agent action.")
        action = request["action"]
        allowed = {"status": {"action"}, "cancel": {"action", "id"},
                   "wait": {"action", "id", "version", "seconds"},
                   "say": {"action", "id", "text", "voice", "expression", "intensity", "gain", "mode"}}
        if action not in allowed or set(request) != allowed[action]:
            raise ValueError("Invalid agent action fields.")
        with self.condition:
            if action == "status":
                return self.snapshot()
            identifier = request["id"]
            if not isinstance(identifier, str) or not re.fullmatch(r"[0-9a-f]{32}", identifier):
                raise ValueError("Request ID must contain 32 lowercase hexadecimal characters.")
            if action == "say":
                text = validate_text(request["text"])
                voice = preferred_voice(self.state.voices) if request["voice"] is None else request["voice"]
                if not isinstance(voice, str) or voice not in [v["name"] for v in self.state.voices]:
                    raise ValueError("Choose one of the installed English voices.")
                expression_condition(self.state.engine.condition, request["expression"], request["intensity"])
                gain = validate_expression_gain(request["gain"])
                if request["mode"] not in ("face", "voice"):
                    raise ValueError("Choose face or voice mode.")
                if request["mode"] == "voice" and request["expression"] != "neutral":
                    raise ValueError("Voice-only mode does not apply facial emotion.")
                payload = {"id": identifier, "text": text, "voice": voice,
                           "expression": request["expression"], "intensity": request["intensity"],
                           "gain": gain, "mode": request["mode"]}
                fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
                if self.job and self.job["id"] == identifier:
                    if self.job["fingerprint"] != fingerprint:
                        raise ValueError("Request ID already belongs to different speech.")
                    return self.snapshot()
                if not self.ready or self.closed:
                    raise RuntimeError("Native agent player is not ready; start/restart this host explicitly.")
                if self.job and self.job["state"] not in TERMINAL:
                    raise BlockingIOError("Agent is already speaking/generating; no request was queued.")
                self.job = {"id": identifier, "state": "generating", "mode": request["mode"],
                            "fingerprint": fingerprint, "cancel": threading.Event(),
                            "started": time.monotonic()}
                self.version += 1
                try:
                    self._send({"action": "say", **payload})
                except RuntimeError as error:
                    self.job.update(state="failed", error=str(error))
                    self.condition.notify_all()
                    raise
                return self.snapshot()
            if not self.job or self.job["id"] != identifier:
                raise ValueError("Request is absent or replaced; it will not be replayed.")
            if action == "cancel" and self.job["state"] not in TERMINAL:
                self.job["cancel"].set()
                self.job["state"] = "cancelling"
                self.version += 1
                self._send({"action": "cancel", "id": identifier})
                self.condition.notify_all()
            elif action == "wait":
                if type(request["version"]) is not int or request["version"] < 0:
                    raise ValueError("Supply a nonnegative status version.")
                seconds = request["seconds"]
                if (isinstance(seconds, bool) or not isinstance(seconds, (float, int))
                        or not math.isfinite(seconds) or not 0 < seconds <= 10):
                    raise ValueError("Wait must be greater than zero and at most ten seconds.")
                self.condition.wait_for(
                    lambda: self.version != request["version"] or self.closed
                    or self.job["id"] != identifier or self.job["state"] in TERMINAL, timeout=seconds)
                if self.job["id"] != identifier:
                    raise ValueError("Request was replaced; inspect the current status.")
            return self.snapshot()

    def generation_stop(self, identifier: object) -> threading.Event:
        with self.condition:
            if (not self.job or self.job["id"] != identifier
                    or self.job["state"] not in ("generating", "cancelling")):
                raise ValueError("Generation does not belong to an active agent request.")
            return self.job["cancel"]

    def event(self, event: dict) -> None:
        with self.condition:
            if event == {"event": "ready"}:
                if not self.closed:
                    self.ready = True
                    self.version += 1
                    self.condition.notify_all()
                return
            if (event.get("event") != "job" or not self.job
                    or event.get("id") != self.job["id"]
                    or not isinstance(event.get("state"), str)
                    or event.get("state") not in TERMINAL | {"playing"}):
                raise RuntimeError("Native player returned an invalid speech acknowledgement.")
            if self.job["state"] in TERMINAL:
                raise RuntimeError("Native player acknowledged a speech request twice.")
            phase = event["state"]
            if phase == "playing":
                self.job["secondsToPlayback"] = time.monotonic() - self.job["started"]
                if not self.job["cancel"].is_set():
                    self.job["state"] = phase
            else:
                self.job["state"] = "cancelled" if self.job["cancel"].is_set() else phase
                self.job["secondsTotal"] = time.monotonic() - self.job["started"]
            if phase == "failed":
                self.job["error"] = str(event.get("error", "Native speech failed."))[:400]
            for name in ("cacheHit", "speechCacheHit"):
                if type(event.get(name)) is bool:
                    self.job[name] = event[name]
            self.version += 1
            self.condition.notify_all()

    def _read(self) -> None:
        try:
            deadline = time.monotonic() + 30
            while not self.closed:
                try:
                    self.connection, _ = self.listener.accept()
                    break
                except socket.timeout:
                    if time.monotonic() >= deadline:
                        raise RuntimeError("Owned native player did not connect in thirty seconds.")
            if self.closed:
                return
            self.connection.settimeout(5)
            self.stream = self.connection.makefile("r", encoding="utf-8")
            hello = json.loads(self.stream.readline(2049))
            if (not isinstance(hello, dict) or set(hello) != {"token"}
                    or not isinstance(hello["token"], str)
                    or not secrets.compare_digest(hello["token"].encode("utf-8"),
                                                  self.state.token.encode("ascii"))):
                raise RuntimeError("Native control connection failed authentication.")
            self.connection.settimeout(None)
            self.writer = self.connection.makefile("w", encoding="utf-8", newline="\n")
            while True:
                line = self.stream.readline(8193)
                if not line:
                    raise RuntimeError("Owned native player exited; no speech was replayed.")
                if len(line) > 8192:
                    raise RuntimeError("Native player returned an oversized acknowledgement.")
                if not line.strip():
                    continue
                event = json.loads(line)
                if not isinstance(event, dict):
                    raise RuntimeError("Native player returned an invalid acknowledgement.")
                self.event(event)
        except (OSError, ValueError, RuntimeError) as error:
            with self.condition:
                self.ready = False
                self.fault = str(error)
                if self.job and self.job["state"] not in TERMINAL:
                    self.job["cancel"].set()
                    self.job.update(state="failed", error=str(error))
                self.version += 1
                self.condition.notify_all()

    def close(self) -> None:
        with self.condition:
            self.closed, self.ready = True, False
            if self.job and self.job["state"] not in TERMINAL:
                self.job["cancel"].set()
                self.job.update(state="failed", error="Named agent host closed before speech completed.")
            self.version += 1
            self.condition.notify_all()
        with ExitStack() as cleanup:
            cleanup.callback(self._remove_descriptor)
            cleanup.callback(self._close_reader)
            cleanup.callback(self.speech.close)

    def _close_reader(self) -> None:
        if self.listener:
            self.listener.close()
        if self.connection:
            try:
                self.connection.shutdown(socket.SHUT_RDWR)
            except OSError as error:
                print(f"Native control shutdown: {type(error).__name__}", file=sys.stderr)
        if self.reader:
            self.reader.join(timeout=5)
            if self.reader.is_alive():
                raise RuntimeError("Owned native acknowledgement reader did not stop.")
        if self.writer:
            self.writer.close()
        if hasattr(self, "stream"):
            self.stream.close()
        if self.connection:
            self.connection.close()
    def _remove_descriptor(self) -> None:
        if self.descriptor:
            if read_descriptor(self.path)["instance"] != self.descriptor["instance"]:
                raise RuntimeError("Agent descriptor ownership changed; it was not removed.")
            self.path.unlink()
            self.descriptor = None


def host(path) -> None:
    from .desktop import run_desktop
    if path.exists():
        raise RuntimeError("Session already exists. Stop its host; remove a stale descriptor explicitly after checking ownership.")
    speech = SpeechWorker()
    try:
        print("Preparing the dedicated warm CPU face and native player...", file=sys.stderr, flush=True)
        state = State(FaceEngine(), speech.voices)
        state.synthesizer = speech.synthesize
        bridge = AgentBridge(state, path, speech)
        state.agent = bridge
        run_desktop(state, bridge)
    finally:
        speech.close()

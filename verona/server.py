"""Loopback-only bounded prototype HTTP service, not a production web server."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import secrets
import sys
import threading
import time

from .engine import FaceEngine, expression_condition
from .speech import (
    MAX_SECONDS, MAX_TEXT, VoiceSettings, installed_voices, preferred_voice, synthesize, validate_text,
)


WEB = Path(__file__).with_name("web")
STATIC = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
    "/orientation.mjs": ("orientation.mjs", "text/javascript; charset=utf-8"),
    "/framing.mjs": ("framing.mjs", "text/javascript; charset=utf-8"),
    "/presentations.mjs": ("presentations.mjs", "text/javascript; charset=utf-8"),
    "/hairstyles.mjs": ("hairstyles.mjs", "text/javascript; charset=utf-8"),
    "/robot.mjs": ("robot.mjs", "text/javascript; charset=utf-8"),
}
MAX_BODY = 8192
CSP = (
    "default-src 'none'; script-src 'self'; style-src 'self'; "
    "connect-src 'self'; media-src blob:; img-src 'self'; "
    "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
)


class State:
    def __init__(self, engine: FaceEngine, voices: list[dict[str, str]]) -> None:
        self.engine = engine
        self.voices = voices
        self.token = secrets.token_urlsafe(32)
        self.clip = None
        self.clip_key = None
        self.speech = None
        self.speech_key = None
        self.busy = threading.Lock()
        self.stop = threading.Event()


class LocalServer(ThreadingHTTPServer):
    daemon_threads = False
    block_on_close = True
    allow_reuse_address = False

    def __init__(self, port: int, state: State) -> None:
        self.state = state
        self.slots = threading.BoundedSemaphore(8)
        super().__init__(("127.0.0.1", port), Handler)
        self.host = f"127.0.0.1:{self.server_port}"
        self.origin = f"http://{self.host}"
        self.url = f"{self.origin}/#{state.token}"

    def process_request(self, request, client_address) -> None:
        if not self.slots.acquire(blocking=False):
            try:
                request.settimeout(1)
                body = b'{"error":"Local Verona reached its eight-request limit; retry shortly."}'
                request.sendall(
                    b"HTTP/1.1 503 Service Unavailable\r\n"
                    b"Connection: close\r\nContent-Type: application/json\r\n"
                    + f"Content-Length: {len(body)}\r\n\r\n".encode("ascii") + body
                )
            except OSError as error:
                print(f"Overloaded connection closed: {error}", file=sys.stderr)
            finally:
                self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address) -> None:
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "VeronaLocal"
    sys_version = ""

    def setup(self) -> None:
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, format, *args) -> None:
        # Do not log request text, URLs, tokens or generated speech.
        return

    def reply(self, status: int, content: bytes, kind: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        try:
            self.wfile.write(content)
        except (BrokenPipeError, ConnectionResetError) as error:
            print(f"Local client disconnected during response: {type(error).__name__}", file=sys.stderr)

    def json_reply(self, status: int, data: dict) -> None:
        self.reply(status, json.dumps(data, allow_nan=False).encode("utf-8"), "application/json")

    def guard(self, authenticated: bool = False) -> bool:
        hosts = self.headers.get_all("Host", [])
        origins = self.headers.get_all("Origin", [])
        site = self.headers.get("Sec-Fetch-Site")
        if (hosts != [self.server.host]
                or (origins and origins != [self.server.origin])
                or site not in (None, "same-origin", "none")):
            self.json_reply(403, {"error": "Only this exact local Verona origin is allowed."})
            return False
        if authenticated:
            tokens = self.headers.get_all("X-Verona-Token", [])
            if len(tokens) != 1 or not secrets.compare_digest(
                tokens[0].encode("utf-8"), self.server.state.token.encode("utf-8")
            ):
                self.json_reply(403, {"error": "Invalid local session; reload this Verona page."})
                return False
        return True

    def do_GET(self) -> None:
        if not self.guard():
            return
        state = self.server.state
        if self.path in STATIC:
            name, kind = STATIC[self.path]
            self.reply(200, (WEB / name).read_bytes(), kind)
        elif self.path == "/favicon.ico":
            self.reply(204, b"", "image/x-icon")
        elif self.path == "/api/session":
            if self.guard(authenticated=True):
                self.json_reply(200, {
                    "voices": state.voices,
                    "defaultVoice": preferred_voice(state.voices),
                    "mesh": state.engine.mesh_metadata,
                    "limits": {"characters": MAX_TEXT, "seconds": MAX_SECONDS},
                })
        elif self.path == "/api/mesh":
            if self.guard(authenticated=True):
                self.reply(200, state.engine.mesh_bytes, "application/octet-stream")
        elif self.path.startswith("/api/clip/"):
            if not self.guard(authenticated=True):
                return
            clip = state.clip
            if clip is None or self.path not in (
                f"/api/clip/{clip.id}/audio", f"/api/clip/{clip.id}/motion"
            ):
                self.json_reply(404, {"error": "Clip is absent or replaced; generate it again."})
            elif self.path.endswith("/audio"):
                self.reply(200, clip.audio, "audio/wav")
            else:
                self.reply(200, clip.motion, "application/octet-stream")
        else:
            self.json_reply(404, {"error": "Unknown Verona resource."})

    def do_POST(self) -> None:
        if not self.guard(authenticated=True):
            return
        if self.headers.get_all("Origin", []) != [self.server.origin]:
            self.json_reply(403, {"error": "Generation requires this local page's origin."})
            return
        if self.path not in ("/api/generate", "/api/preview"):
            self.json_reply(404, {"error": "Unknown Verona operation."})
            return
        lengths = self.headers.get_all("Content-Length", [])
        if (self.headers.get("Transfer-Encoding") is not None or len(lengths) != 1
                or not lengths[0].isascii() or not lengths[0].isdigit()
                or len(lengths[0]) > 5):
            self.json_reply(400, {"error": "Supply one bounded Content-Length, without transfer encoding."})
            return
        length = int(lengths[0])
        if not 0 < length <= MAX_BODY:
            self.json_reply(413, {"error": "Request exceeds the local input limit."})
            return
        if self.headers.get_content_type() != "application/json":
            self.json_reply(415, {"error": "Use a JSON text request."})
            return
        state = self.server.state
        if not state.busy.acquire(blocking=False):
            self.json_reply(409, {"error": "One local clip is already generating; wait for it to finish."})
            return
        try:
            started = time.perf_counter()
            raw = self.rfile.read(length)
            if len(raw) != length:
                self.json_reply(400, {"error": "Request body is incomplete."})
                return
            request = json.loads(raw)
            required = {"text", "voice", "expression", "intensity"}
            if (not isinstance(request, dict) or not required <= set(request)
                    or set(request) - required - {"voiceSettings"}):
                raise ValueError("Supply text, voice, expression, intensity and optional voiceSettings only.")
            text = validate_text(request["text"])
            voice = request["voice"]
            if not isinstance(voice, str) or voice not in [v["name"] for v in state.voices]:
                raise ValueError("Choose one of the installed English voices.")
            expression_condition(state.engine.condition, request["expression"], request["intensity"])
            settings = VoiceSettings.parse(request.get("voiceSettings", {}))
            speech_key = hashlib.sha256(json.dumps(
                [text, voice, asdict(settings)], sort_keys=True, ensure_ascii=True
            ).encode("utf-8")).hexdigest()
            clip_key = f"{speech_key}:{request['expression']}:{float(request['intensity'])}"
            if self.path == "/api/generate" and state.clip is not None and state.clip_key == clip_key:
                self.json_reply(200, {
                    **state.clip.metadata, "cacheHit": True,
                    "requestSeconds": time.perf_counter() - started,
                })
                return
            speech_hit = state.speech is not None and state.speech_key == speech_key
            if not speech_hit:
                state.speech = synthesize(text, voice, state.voices, settings)
                state.speech_key = speech_key
            speech = state.speech
            if self.path == "/api/preview":
                self.reply(200, speech.wav, "audio/wav")
                return
            clip = state.engine.generate(
                speech, request["expression"], request["intensity"], stop=state.stop
            )
            state.clip = clip
            state.clip_key = clip_key
            self.json_reply(200, {
                **clip.metadata, "cacheHit": False, "speechCacheHit": speech_hit,
                "requestSeconds": time.perf_counter() - started,
            })
        except (ValueError, UnicodeDecodeError) as error:
            self.json_reply(400, {"error": str(error)})
        except TimeoutError:
            self.json_reply(408, {"error": "Local request input timed out."})
        except (OSError, RuntimeError) as error:
            print(f"Local clip generation failed: {error}", file=sys.stderr, flush=True)
            self.json_reply(503, {"error": "Local generation failed. See the Verona terminal for details."})
        finally:
            state.busy.release()

    def do_OPTIONS(self) -> None:
        self.json_reply(403, {"error": "Cross-origin access is not enabled."})


def create_state() -> State:
    voices = installed_voices()
    print("Verifying local model/topology and preparing CPU geometry...", flush=True)
    return State(FaceEngine(), voices)

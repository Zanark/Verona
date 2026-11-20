"""One local control room for explicitly created, independent warm head sessions."""

from concurrent.futures import ThreadPoolExecutor
from collections import deque
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time
import uuid
import webbrowser

from .agent import call, manager_path, private_descriptor, read_descriptor, session_path
from .server import Handler, LocalServer, MAX_BODY, State, WEB
from .session_config import MODELS, appearance, colors_patch


ROOT = Path(__file__).resolve().parents[1]


class SessionManager:
    def __init__(self):
        self.lock = threading.Lock()
        self.children = {}
        self.closing = False

    def create(self, name, model, colors):
        path = session_path(name)
        config = appearance(model, colors, name)
        with self.lock:
            if self.closing:
                raise RuntimeError("Manager is closing; no head was created.")
            for old in [key for key, value in self.children.items()
                        if value["process"].poll() is not None]:
                del self.children[old]
            if path.exists() or (name in self.children and self.children[name]["process"].poll() is None):
                raise ValueError("That session already exists; choose another name or close it first.")
            if sum(value["process"].poll() is None for value in self.children.values()) >= 8:
                raise ValueError("This manager already owns eight warm heads; close one first.")
            args = [sys.executable, "-m", "verona.agent", "host", "--session", name, "--model", model]
            for key, value in config["colors"].items():
                if value is not None:
                    args.extend([f"--{key}-color", value])
            env = {key: os.environ[key] for key in
                   ("SystemRoot","SystemDrive","ProgramData","ALLUSERSPROFILE","WINDIR",
                    "TEMP","TMP","USERPROFILE","APPDATA","LOCALAPPDATA","PATH")
                   if key in os.environ}
            env.update(OPENBLAS_NUM_THREADS="2", OMP_NUM_THREADS="2")
            used = {value["slot"] for value in self.children.values() if value["process"].poll() is None}
            slot = next(index for index in range(8) if index not in used)
            env["VERONA_HEAD_SLOT"] = str(slot)
            env["VERONA_MANAGER_PID"] = str(os.getpid())
            child = subprocess.Popen(args, cwd=ROOT, env=env, stdin=subprocess.DEVNULL,
                                     stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                     text=True, encoding="utf-8", errors="replace",
                                     creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            record = {"process": child, "appearance": config, "messages": deque(maxlen=6), "slot": slot}
            self.children[name] = record

            def read_output():
                try:
                    for line in child.stdout:
                        with self.lock:
                            record["messages"].append(line.strip()[:400])
                finally:
                    child.stdout.close()
            threading.Thread(target=read_output, daemon=True).start()
        return {"session": name, "state": "starting", "appearance": config}

    def inspect(self, name):
        path = session_path(name)
        with self.lock:
            owned = self.children.get(name)
            code = owned["process"].poll() if owned else None
            config = owned["appearance"] if owned else None
            error = " | ".join(owned["messages"]) if owned else ""
        if not path.exists():
            return {"session": name, "state": "starting" if owned and code is None else
                    "closed" if code == 0 else "failed",
                    "appearance": config, "owned": bool(owned),
                    **({"error": error or "No live session descriptor."} if code not in (None, 0) else {})}
        try:
            descriptor = read_descriptor(path)
            result = call(descriptor, {"action": "status"}, timeout=.8)
            return {**result, "session": name, "owned": bool(owned)}
        except (OSError, RuntimeError, ValueError, KeyError) as failure:
            return {"session": name, "state": "unavailable", "owned": bool(owned),
                    "appearance": config, "error": str(failure)}

    def list(self):
        directory = session_path("inventory").parent
        names = {path.stem for path in directory.glob("*.json")} if directory.exists() else set()
        with self.lock:
            names.update(name for name, value in self.children.items()
                         if value["process"].poll() != 0)
        if len(names) > 64:
            raise RuntimeError("More than 64 session records; inspect stale descriptors explicitly.")
        with ThreadPoolExecutor(max_workers=8) as pool:
            return [{key: value for key, value in row.items() if key != "controls"}
                    for row in pool.map(self.inspect, sorted(names))]

    def command(self, value):
        if not isinstance(value, dict):
            raise ValueError("Supply one manager action.")
        action = value.get("action")
        allowed = {"status": {"action"}, "list": {"action"}, "shutdown": {"action"},
                   "inspect": {"action","session"},
                   "create": {"action","session","model","colors"},
                   "configure": {"action","session","colors"},
                   "settings": {"action","session","settings"}, "close": {"action","session"},
                   "cancel": {"action","session","id"},
                   "say": {"action","session","text","voice","expression","intensity","gain","mode"}}
        if action not in allowed or set(value) != allowed[action]:
            raise ValueError("Invalid manager action fields.")
        if action == "status":
            return {"ready": True, "manager": True}
        if action == "list":
            return {"sessions": self.list(), "models": MODELS}
        if action == "inspect":
            return self.inspect(value["session"])
        if action == "create":
            return self.create(value["session"], value["model"], colors_patch(value["colors"]))
        if action == "shutdown":
            return {"state": "closing"}
        descriptor = read_descriptor(session_path(value["session"]))
        request = {key: item for key, item in value.items() if key != "session"}
        if action == "settings":
            request["action"] = "configure"
        elif action == "say":
            request["id"] = uuid.uuid4().hex
        return call(descriptor, request)

    def close(self):
        with self.lock:
            self.closing = True
            children = list(self.children.items())
        errors = []
        for name, record in children:
            child = record["process"]
            deadline = time.monotonic() + 30
            requested = False
            while child.poll() is None and time.monotonic() < deadline:
                path = session_path(name)
                if path.exists() and not requested:
                    try:
                        call(read_descriptor(path), {"action": "close"}, timeout=2)
                        requested = True
                    except (OSError, RuntimeError, ValueError) as error:
                        record["closeError"] = str(error)
                time.sleep(.1)
            if child.poll() is None:
                errors.append(f"{name}: owned head did not close; inspect its live descriptor.")
        if errors:
            raise RuntimeError(" ".join(errors))


class ManagerHandler(Handler):
    def do_GET(self):
        if not self.guard():
            return
        static = {"/": ("manager.html", "text/html; charset=utf-8"),
                  "/manager.js": ("manager.js", "text/javascript; charset=utf-8"),
                  "/manager.css": ("manager.css", "text/css; charset=utf-8")}
        if self.path in static:
            name, kind = static[self.path]
            self.reply(200, (WEB / name).read_bytes(), kind)
        elif self.path == "/favicon.ico":
            self.reply(204, b"", "image/x-icon")
        else:
            self.json_reply(404, {"error": "Manager route not found."})

    def do_POST(self):
        if not self.guard(authenticated=True):
            return
        if self.path != "/api/agent":
            self.json_reply(404, {"error": "Manager route not found."})
            return
        try:
            lengths = self.headers.get_all("Content-Length", [])
            if len(lengths) != 1 or not lengths[0].isdigit() or not 0 < int(lengths[0]) <= MAX_BODY:
                raise ValueError("Supply one bounded JSON request.")
            if self.headers.get("Transfer-Encoding") is not None:
                raise ValueError("Transfer encoding is not supported.")
            value = json.loads(self.rfile.read(int(lengths[0])))
            if self.server.state.stop.is_set():
                raise RuntimeError("Manager is closing; no new action was accepted.")
            result = self.server.manager.command(value)
            self.json_reply(200, result)
            if value["action"] == "shutdown":
                self.server.state.stop.set()
        except BlockingIOError as error:
            self.json_reply(409, {"error": str(error)})
        except (OSError, RuntimeError, ValueError, KeyError, TypeError) as error:
            self.json_reply(400, {"error": str(error)})


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-open", action="store_true")
    args = parser.parse_args()
    path = manager_path()
    if path.exists():
        descriptor = read_descriptor(path)
        status = call(descriptor, {"action": "status"})
        if not status.get("manager"):
            raise RuntimeError("Existing descriptor is not a Verona manager.")
        if not args.no_open and not webbrowser.open(
                f"http://127.0.0.1:{descriptor['port']}/#{descriptor['token']}"):
            raise RuntimeError("Could not open the existing manager.")
        return
    state = State(None, [])
    server = LocalServer(0, state)
    server.RequestHandlerClass = ManagerHandler
    server.manager = SessionManager()
    descriptor = {"version":1,"port":server.server_port,"token":state.token,
                  "pid":os.getpid(),"instance":uuid.uuid4().hex}
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": .05})
    try:
        private_descriptor(path, descriptor)
        thread.start()
        print("Verona session manager ready. Use its GUI to create heads; Ctrl+C or Exit stops owned heads.", flush=True)
        if not args.no_open and not webbrowser.open(server.url):
            raise RuntimeError("Could not open the manager browser.")
        while not state.stop.wait(.2):
            pass
    except KeyboardInterrupt:
        print("Closing manager-owned heads.", flush=True)
    finally:
        state.stop.set()
        try:
            server.manager.close()
        finally:
            if thread.is_alive():
                server.shutdown()
            server.server_close()
            if thread.ident:
                thread.join(timeout=10)
            if path.exists():
                if read_descriptor(path)["instance"] != descriptor["instance"]:
                    raise RuntimeError("Manager ownership changed; descriptor retained.")
                path.unlink()


if __name__ == "__main__":
    main()

const { app, BrowserWindow, ipcMain, screen, session, dialog } = require("electron");
const path = require("node:path");

const profile = process.argv.find((arg) => arg.startsWith("--user-data-dir="));
if (!profile) throw new Error("Launch through VeronaDesktop.cmd to use an owned disposable profile.");
app.setPath("userData", profile.slice("--user-data-dir=".length));
app.setPath("sessionData", profile.slice("--user-data-dir=".length));
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("disable-component-update");
app.commandLine.appendSwitch("disable-sync");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND, EXCLUDE 127.0.0.1");

let window, timer, parentWatch, overlay = false, pinned = true, follow = true, controlBounds, overlayBounds;
let agentSocket;
let headZoom = 1, overlayAreaKey = "";
let dormant = false;
const endpoint = process.env.VERONA_LOCAL_URL;
const agentEnabled = process.env.VERONA_AGENT_MODE === "1";
const agentPort = Number(process.env.VERONA_AGENT_PORT);
const headSlot = Number(process.env.VERONA_HEAD_SLOT || 0);
delete process.env.VERONA_LOCAL_URL;
delete process.env.VERONA_AGENT_MODE;
delete process.env.VERONA_AGENT_PORT;
delete process.env.VERONA_HEAD_SLOT;
start({ url: endpoint }).catch(fatal);

function fatal(error) {
  const message = endpoint ? error.message.replaceAll(endpoint, "[private Verona URL]") : error.message;
  dialog.showErrorBox("Verona desktop failed", `${message}\nInspect the Verona terminal, then restart VeronaDesktop.cmd.`);
  console.error(message);
  app.exit(1);
}

function overlayLayout(area, previous, requestedZoom, slot = 0) {
  const availableWidth = Math.max(1, area.width - 40), availableHeight = Math.max(1, area.height - 40);
  const baseScale = Math.min(1, availableWidth / 480, availableHeight / 600);
  const baseWidth = Math.max(1, Math.floor(480 * baseScale)), referenceHeight = Math.max(1, Math.floor(600 * baseScale));
  const maxZoom = Math.min(2.3, Math.floor(Math.min(availableWidth / baseWidth, availableHeight / referenceHeight) * 20) / 20);
  const zoom = Math.min(requestedZoom, maxZoom), growth = Math.max(1, zoom);
  const width = Math.round(baseWidth * growth), height = Math.round(referenceHeight * growth);
  const columns = Math.max(1, Math.floor((area.width - 20) / (width + 12)));
  const x = previous ? previous.x + (previous.width - width) / 2
    : area.x + area.width - width - 20 - (slot % columns) * (width + 12);
  const y = previous ? previous.y + (previous.height - height) / 2
    : area.y + 20 + Math.floor(slot / columns) * (height + 12);
  return { zoom, requestedZoom, maxZoom, referenceHeight, bounds: {
    x: Math.round(Math.max(area.x, Math.min(x, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(y, area.y + area.height - height))), width, height,
  } };
}

async function start(config) {
  const url = new URL(config.url);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port
      || url.pathname !== "/" || url.search || !/^#[A-Za-z0-9_-]{43}$/.test(url.hash)
      || url.username || url.password) throw new Error("Invalid private Verona endpoint.");
  await app.whenReady();
  if (process.platform === "win32") app.setAppUserModelId("Zanark.Verona");
  // An in-memory partition, never the owner's browser profile or a persisted Electron session.
  const isolated = session.fromPartition(`verona-${process.pid}`, { cache: false });
  isolated.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  isolated.setPermissionCheckHandler(() => false);
  isolated.on("will-download", (event) => event.preventDefault());
  isolated.webRequest.onBeforeRequest((details, callback) => {
    const allowed = details.url.startsWith(url.origin + "/") || details.url.startsWith(`blob:${url.origin}/`);
    callback({ cancel: !allowed });
  });
  const area = screen.getPrimaryDisplay().workArea;
  window = new BrowserWindow({
    width: Math.min(1280, area.width - 40), height: Math.min(980, area.height - 40),
    frame: false, transparent: true, backgroundColor: "#00000000",
    resizable: false, maximizable: false, fullscreenable: false, show: false,
    title: "Verona",
    icon: path.join(__dirname, "..", "verona", "web", "verona.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"), session: isolated,
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, devTools: false, backgroundThrottling: false,
      spellcheck: false, navigateOnDragDrop: false,
      ...(agentEnabled ? { autoplayPolicy: "no-user-gesture-required",
        additionalArguments: ["--verona-agent"] } : {}),
    },
  });
  window.removeMenu();
  window.webContents.setZoomFactor(1);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, destination) => {
    if (destination !== url.href) event.preventDefault();
  });
  window.webContents.on("will-redirect", (event) => event.preventDefault());
  window.webContents.on("render-process-gone", (_event, details) => fatal(new Error(`Face renderer stopped: ${details.reason}`)));
  window.webContents.on("unresponsive", () => {
    console.error("Verona desktop renderer is unresponsive; close and restart VeronaDesktop.cmd.");
  });
  let previous = "";
  function trusted(event) {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame
        || new URL(event.senderFrame.url).origin !== url.origin) throw new Error("Untrusted desktop command.");
  }
  function resizeOverlay(previous) {
    const area = screen.getDisplayMatching(previous || window.getBounds()).workArea;
    const slot = agentEnabled && Number.isInteger(headSlot) && headSlot >= 0 && headSlot < 8 ? headSlot : 0;
    const layout = overlayLayout(area, previous, headZoom, slot);
    overlayAreaKey = JSON.stringify(area);
    headZoom = layout.zoom;
    window.setBounds(layout.bounds);
    return layout;
  }
  window.on("moved", () => {
    if (overlay && JSON.stringify(screen.getDisplayMatching(window.getBounds()).workArea) !== overlayAreaKey) {
      window.webContents.send("verona:mode", { overlay, ...resizeOverlay(window.getBounds()) });
    }
  });
  screen.on("display-metrics-changed", () => {
    if (overlay) window.webContents.send("verona:mode", { overlay, ...resizeOverlay(window.getBounds()) });
  });
  if (agentEnabled) {
    if (!Number.isInteger(agentPort) || agentPort < 1 || agentPort > 65535) {
      throw new Error("Invalid owned agent control endpoint.");
    }
    agentSocket = require("node:net").createConnection({ host: "127.0.0.1", port: agentPort });
    const report = (value) => agentSocket.write(JSON.stringify(value) + "\n");
    report({ token: url.hash.slice(1) });
    agentSocket.on("error", fatal);
    agentSocket.on("close", () => app.quit());
    ipcMain.handle("verona:agent-ready", (event) => {
      trusted(event);
      report({ event: "ready" });
    });
    ipcMain.handle("verona:agent-appearance", (event, value) => {
      trusted(event);
      if (!value || !value.colors || typeof value.colors !== "object"
          || (value.revision != null && !/^[0-9a-f]{32}$/.test(value.revision))) {
        throw new Error("Invalid native appearance confirmation.");
      }
      report({ event: "appearance", ...value });
    });
    ipcMain.handle("verona:agent-controls", (event, value) => {
      trusted(event);
      if (!value || !Array.isArray(value.controls) || value.controls.length > 64
          || (value.revision != null && !/^[0-9a-f]{32}$/.test(value.revision))) {
        throw new Error("Invalid native controls confirmation.");
      }
      report({event: "controls", ...value});
    });
    ipcMain.handle("verona:agent-result", (event, result) => {
      trusted(event);
      if (!result || !/^[0-9a-f]{32}$/.test(result.id)
          || !["playing", "completed", "failed", "cancelled"].includes(result.state)) {
        throw new Error("Invalid native speech result.");
      }
      report({ event: "job", ...result });
    });
    let pending = "";
    agentSocket.setEncoding("utf8");
    agentSocket.on("data", (chunk) => {
      try {
        pending += chunk;
        if (Buffer.byteLength(pending) > 8192) throw new Error("Oversized agent command.");
        let newline;
        while ((newline = pending.indexOf("\n")) >= 0) {
          const command = JSON.parse(pending.slice(0, newline));
          pending = pending.slice(newline + 1);
          if (command?.action === "close") { window.close(); continue; }
          if (!command || !["say", "cancel", "configure"].includes(command.action)
              || (command.action === "configure"
                ? !/^[0-9a-f]{32}$/.test(command.revision)
                : !/^[0-9a-f]{32}$/.test(command.id))) throw new Error("Invalid agent command.");
          window.webContents.send("verona:agent", command);
        }
      } catch (error) { fatal(error); }
    });
    follow = false;
    pinned = true;
  }
  ipcMain.handle("verona:command", (event, action, value) => {
    trusted(event);
    if (action === "overlay" || action === "controls") {
      const next = action === "overlay";
      if (next !== overlay) {
        overlay = next;
        let layout;
        if (next) {
          controlBounds = window.getBounds();
          layout = resizeOverlay(overlayBounds);
        } else { overlayBounds = window.getBounds(); window.setBounds(controlBounds); }
        window.setAlwaysOnTop(overlay && pinned, "pop-up-menu");
        window.webContents.send("verona:mode", { overlay, zoom: headZoom, maxZoom: 2.3, ...layout });
      }
    } else if (action === "zoom" && typeof value === "number" && Number.isFinite(value) && value >= .35 && value <= 2.3) {
      headZoom = value;
      if (overlay) window.webContents.send("verona:mode", { overlay, ...resizeOverlay(window.getBounds()) });
    } else if (action === "pin" && typeof value === "boolean") {
      pinned = value;
      window.setAlwaysOnTop(overlay && pinned, "pop-up-menu");
    } else if (action === "follow" && typeof value === "boolean") {
      follow = value; previous = ""; syncCursorTimer();
    } else if (action === "sleep" && typeof value === "boolean") {
      dormant = value; previous = ""; syncCursorTimer();
    }
    else if (action === "minimize") window.minimize();
    else if (action === "close") window.close();
    else throw new Error("Unknown or invalid desktop command.");
    return { overlay, pinned, follow, dormant };
  });
  function pollCursor() {
    if (!follow || dormant || window.isDestroyed() || !window.isVisible() || window.isMinimized()) return;
    const point = screen.getCursorScreenPoint(), bounds = window.getContentBounds();
    const key = `${point.x},${point.y},${bounds.x},${bounds.y}`;
    if (key !== previous) {
      previous = key;
      window.webContents.send("verona:cursor", { x: point.x - bounds.x, y: point.y - bounds.y });
    }
  }
  function syncCursorTimer() {
    if (!follow || dormant) { clearInterval(timer); timer = null; }
    else if (!timer) timer = setInterval(pollCursor, 33);
  }
  syncCursorTimer();
  const parent = process.ppid;
  parentWatch = setInterval(() => {
    try { process.kill(parent, 0); }
    catch (error) {
      if (error.code !== "ESRCH") console.error(`Cannot verify owned Python host: ${error.code}`);
      app.quit();
    }
  }, 1000);
  await window.loadURL(url.href);
  if (agentEnabled) window.showInactive();
  else window.show();
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  clearInterval(timer); clearInterval(parentWatch); agentSocket?.destroy();
});

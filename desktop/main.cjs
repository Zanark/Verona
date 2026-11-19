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

let window, timer, parentWatch, overlay = false, pinned = true, follow = true, controlBounds;
const endpoint = process.env.VERONA_LOCAL_URL;
delete process.env.VERONA_LOCAL_URL;
start({ url: endpoint }).catch(fatal);

function fatal(error) {
  dialog.showErrorBox("Verona desktop failed", `${error.message}\nInspect the Verona terminal, then restart VeronaDesktop.cmd.`);
  console.error(error.message);
  app.exit(1);
}

async function start(config) {
  const url = new URL(config.url);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port
      || url.pathname !== "/" || url.search || !/^#[A-Za-z0-9_-]{43}$/.test(url.hash)
      || url.username || url.password) throw new Error("Invalid private Verona endpoint.");
  await app.whenReady();
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
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"), session: isolated,
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, devTools: false, backgroundThrottling: false,
      spellcheck: false, navigateOnDragDrop: false,
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
  ipcMain.handle("verona:command", (event, action, value) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame
        || new URL(event.senderFrame.url).origin !== url.origin) throw new Error("Untrusted desktop command.");
    if (action === "overlay" || action === "controls") {
      const next = action === "overlay";
      if (next !== overlay) {
        if (next) {
          controlBounds = window.getBounds();
          const bounds = screen.getDisplayMatching(controlBounds).workArea;
          const width = Math.min(480, bounds.width - 40), height = Math.min(600, bounds.height - 40);
          window.setBounds({ x: bounds.x + bounds.width - width - 20, y: bounds.y + 20, width, height });
        } else window.setBounds(controlBounds);
        overlay = next;
        window.setAlwaysOnTop(overlay && pinned, "pop-up-menu");
        window.webContents.send("verona:mode", { overlay });
      }
    } else if (action === "pin" && typeof value === "boolean") {
      pinned = value;
      window.setAlwaysOnTop(overlay && pinned, "pop-up-menu");
    } else if (action === "follow" && typeof value === "boolean") { follow = value; previous = ""; }
    else if (action === "minimize") window.minimize();
    else if (action === "close") window.close();
    else throw new Error("Unknown or invalid desktop command.");
    return { overlay, pinned, follow };
  });
  timer = setInterval(() => {
    if (!follow || window.isDestroyed() || !window.isVisible() || window.isMinimized()) return;
    const point = screen.getCursorScreenPoint(), bounds = window.getContentBounds();
    const key = `${point.x},${point.y},${bounds.x},${bounds.y}`;
    if (key !== previous) {
      previous = key;
      window.webContents.send("verona:cursor", { x: point.x - bounds.x, y: point.y - bounds.y });
    }
  }, 33);
  const parent = process.ppid;
  parentWatch = setInterval(() => {
    try { process.kill(parent, 0); }
    catch (error) {
      if (error.code !== "ESRCH") console.error(`Cannot verify owned Python host: ${error.code}`);
      app.quit();
    }
  }, 1000);
  await window.loadURL(url.href);
  window.show();
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => { clearInterval(timer); clearInterval(parentWatch); });

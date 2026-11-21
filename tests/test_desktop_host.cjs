const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

async function run() {
  const source = fs.readFileSync(path.join(__dirname, "..", "desktop", "main.cjs"), "utf8");
  for (const endpoint of [undefined, "https://127.0.0.1:1234/", `http://127.0.0.1:1234/#${"A".repeat(43)}`]) {
    const calls = [];
    const app = {
      setPath() {}, on() {}, commandLine: { appendSwitch() {} },
      whenReady: async () => { throw new Error("Fixture compositor initialization failed"); },
      exit: (code) => calls.push(["exit", code]),
      quit: () => calls.push(["unexpected-success-exit"]),
    };
    const electron = { app, dialog: { showErrorBox: (...args) => calls.push(["dialog", ...args]) } };
    const environment = { VERONA_LOCAL_URL: endpoint };
    vm.runInNewContext(source, {
      require: (name) => name === "electron" ? electron : require(name),
      process: { argv: ["electron", "--user-data-dir=fixture-profile"], env: environment },
      URL, console: { error: (message) => calls.push(["error", message]) },
    });
    await new Promise(setImmediate);
    assert.equal("VERONA_LOCAL_URL" in environment, false);
    assert.deepEqual(calls.map(([kind]) => kind), ["dialog", "error", "exit"]);
    assert.equal(calls.at(-1)[1], 1);
    assert.match(calls[0][2], /restart VeronaDesktop\.cmd/);
  }
  let windowOptions, appId;
  const app = {
    setPath() {}, on() {}, commandLine: { appendSwitch() {} },
    whenReady: async () => {},
    setAppUserModelId: value => { appId = value; },
    exit() {},
  };
  const isolated = {
    setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, on() {},
    webRequest: {onBeforeRequest() {}},
  };
  vm.runInNewContext(source, {
    require: name => name === "electron" ? {
      app, dialog: {showErrorBox() {}},
      session: {fromPartition: () => isolated},
      screen: {getPrimaryDisplay: () => ({workArea: {width:1600,height:1200}})},
      BrowserWindow: class {constructor(options) {windowOptions=options;throw Error("Stop after native construction.");}},
    } : require(name),
    process: {argv:["electron","--user-data-dir=fixture-profile"],platform:"win32",
      env:{VERONA_LOCAL_URL:`http://127.0.0.1:1234/#${"A".repeat(43)}`}},
    __dirname:path.join(__dirname,"..","desktop"),URL,console:{error() {}},
  });
  await new Promise(setImmediate);
  assert.equal(appId,"Zanark.Verona");
  assert.equal(windowOptions.icon,path.join(__dirname,"..","verona","web","verona.ico"));
  assert(fs.statSync(windowOptions.icon).size>0);
  console.log("Desktop startup failures surface recovery, remove the endpoint and exit unsuccessfully.");
  console.log("Successful Windows startup supplies the original Verona native icon and application identity.");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });

const { app, BrowserWindow, screen } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const output = process.argv.find((arg) => arg.startsWith("--qualification-output=")).split("=").slice(1).join("=");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = { checks: [], audio: "Muted native playback; not independent listening acceptance." };
let fixture;
app.once("browser-window-created", (_event, window) => {
  report.nativeEvents = [];
  for (const name of ["show", "hide", "always-on-top-changed"]) {
    window.on(name, () => report.nativeEvents.push({ event: name,
      visible: window.isVisible(), pinned: window.isAlwaysOnTop() }));
  }
  window.webContents.once("did-finish-load", () => run(window).catch(async (error) => {
    report.error = error.stack;
    await fs.writeFile(path.join(output, "desktop-report.json"), JSON.stringify(report, null, 2));
    console.error(error.stack);
    app.exit(1);
  }));
});
require("../desktop/main.cjs");

async function run(window) {
  const evaluate = (code) => window.webContents.executeJavaScript(code, true);
  async function wait(code, limit = 60000) {
    const until = Date.now() + limit;
    while (Date.now() < until) {
      if (await evaluate(code)) return;
      await pause(50);
    }
    throw new Error("Desktop condition timed out: " + code);
  }
  async function waitNative(condition, description) {
    const until = Date.now() + 5000;
    while (Date.now() < until) {
      if (condition()) return;
      await pause(25);
    }
    throw new Error("Native desktop state timed out: " + description);
  }
  await wait(`document.getElementById("generate") && !document.getElementById("generate").disabled`);
  assert.equal(window.webContents.getLastWebPreferences().sandbox, true);
  assert.equal(window.webContents.getLastWebPreferences().nodeIntegration, false);
  assert.equal(await evaluate(`typeof require`), "undefined");
  assert(await evaluate(`document.documentElement.classList.contains("desktop")`));
  report.checks.push("Real sandboxed Electron desktop with isolated preload and ready WebGL2.");
  assert(await evaluate(`window.veronaDesktop.command("arbitrary-file").then(()=>false,()=>true)`));
  report.checks.push("Unrecognized native bridge command rejected.");
  await evaluate(`document.getElementById("follow-eyes").checked=false;
    document.getElementById("follow-eyes").dispatchEvent(new Event("input"));
    document.getElementById("audio").muted=true; document.getElementById("generate").click();`);
  await wait(`!document.getElementById("play").disabled || !document.getElementById("error").hidden`);
  assert(await evaluate(`document.getElementById("error").hidden`),
    await evaluate(`document.getElementById("error").textContent`));
  const before = await evaluate(`({source:document.getElementById("audio").src,
    text:document.getElementById("text").value,voice:document.getElementById("voice").value})`);
  await evaluate(`document.getElementById("audio").play()`);
  await pause(200);
  report.framing = await evaluate(`(() => {
    const $=id=>document.getElementById(id),a=$("audio"),before=a.currentTime;
    const g=$("face").getContext("webgl2"),draw=g.drawElements;let calls=[];
    g.drawElements=function(mode,count,...args){calls.push({mode,count});return draw.call(this,mode,count,...args);};
    $("framing").dispatchEvent(new Event("input"));const full=calls;calls=[];
    $("framing").value="head-neck";$("framing").dispatchEvent(new Event("input"));
    g.drawElements=draw;
    return {full,cropped:calls,before,after:a.currentTime,paused:a.paused,error:g.getError()};
  })()`);
  assert(report.framing.cropped[0].count < report.framing.full[0].count);
  assert(report.framing.cropped.at(-2).count < report.framing.full.at(-2).count);
  assert(!report.framing.paused && report.framing.after >= report.framing.before && report.framing.error === 0);
  report.checks.push("Head/neck framing reduces actual skin/hair submissions without pausing or seeking speech.");
  report.overlayCommand = await evaluate(`window.veronaDesktop.command("overlay")`);
  report.beforePinWait = { visible: window.isVisible(), pinned: window.isAlwaysOnTop() };
  await wait(`document.documentElement.classList.contains("overlay")`);
  await waitNative(() => window.isAlwaysOnTop(), "overlay always-on-top");
  for (const pinned of [false, true]) {
    await evaluate(`document.getElementById("pin-overlay").checked=${pinned};
      document.getElementById("pin-overlay").dispatchEvent(new Event("input"));`);
    await waitNative(() => window.isAlwaysOnTop() === pinned, "overlay pin checkbox");
  }
  await pause(200);
  const after = await evaluate(`({source:document.getElementById("audio").src,
    time:document.getElementById("audio").currentTime,paused:document.getElementById("audio").paused})`);
  assert.equal(after.source, before.source);
  assert(after.time > .25 && !after.paused);
  report.checks.push("Pop-out preserves the same live audio/clip/renderer, advances its audio clock and toggles native pin state.");
  await evaluate(`document.getElementById("audio").pause(); document.getElementById("audio").currentTime=0;
    document.getElementById("yaw").dispatchEvent(new Event("input"));`);
  const alpha = await evaluate(`(() => {
    document.getElementById("yaw").dispatchEvent(new Event("input"));
    const c=document.getElementById("face"),g=c.getContext("webgl2"),p=new Uint8Array(c.width*c.height*4);
    g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);
    let clear=0,solid=0; for(let i=3;i<p.length;i+=4){if(p[i]===0)clear++;if(p[i]===255)solid++;}
    return {clear,solid,error:g.getError(),width:c.width,height:c.height};
  })()`);
  assert(alpha.clear > 10000 && alpha.solid > 1000 && alpha.error === 0, JSON.stringify(alpha));
  report.alpha = alpha;
  const lowerNeck = await evaluate(`(async () => {
    const $=id=>document.getElementById(id),c=$("face"),g=c.getContext("webgl2");
    const meta=(await (await fetch("/api/session",{headers:{"X-Verona-Token":location.hash.slice(1)}})).json()).mesh;
    const row=c.height/2+(134-meta.center[1])/meta.scale*.91*c.height/2;
    let leaked=0;
    for(const view of ["polygon","shaded"]){
      $("appearance").value=view;$("points").checked=true;$("points").dispatchEvent(new Event("input"));
      const p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);
      for(let y=0;y<row-2;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3])leaked++;
    }
    $("appearance").value="polygon";$("points").checked=false;$("points").dispatchEvent(new Event("input"));
    return {leaked,row,error:g.getError()};
  })()`);
  assert.equal(lowerNeck.leaked,0,JSON.stringify(lowerNeck));
  assert.equal(lowerNeck.error,0);
  report.lowerNeck=lowerNeck;
  report.checks.push("Both materials, native contours, hair and diagnostic points leave zero alpha below the neck.");
  report.presentationViews = [];
  for (const id of ["facemesh", "facedot", "uniform"]) {
    const data = await evaluate(`(() => {
      const $=id=>document.getElementById(id);$("presentation").value=${JSON.stringify(id)};
      $("presentation").dispatchEvent(new Event("input"));
      const c=$("face"),g=c.getContext("webgl2"),p=new Uint8Array(c.width*c.height*4);
      g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);
      let clear=0,colored=0;for(let i=3;i<p.length;i+=4){if(p[i]===0)clear++;else colored++;}
      return {id:$("presentation").value,clear,colored,error:g.getError(),
        source:$("audio").src,time:$("audio").currentTime,description:$("geometry-details").textContent};
    })()`);
    assert.equal(data.error,0,JSON.stringify(data));
    assert(data.clear>10000 && data.colored>1000,JSON.stringify(data));
    assert.equal(data.source,before.source);
    await pause(150);
    await fs.writeFile(path.join(output, `view-${id}.png`), (await window.webContents.capturePage()).toPNG());
    if (id === "facemesh") {
      await evaluate(`document.getElementById("mesh-detail").value="1";
        document.getElementById("mesh-detail").dispatchEvent(new Event("input"));`);
      await pause(150);
      await fs.writeFile(path.join(output, "view-facemesh-detail1.png"), (await window.webContents.capturePage()).toPNG());
      await evaluate(`document.getElementById("mesh-detail").value="5";
        document.getElementById("mesh-detail").dispatchEvent(new Event("input"));`);
    }
    report.presentationViews.push(data);
  }
  await evaluate(`document.getElementById("presentation").value="claire";
    document.getElementById("presentation").dispatchEvent(new Event("input"));`);
  assert.equal(await evaluate(`document.getElementById("framing").value`),"head-neck");
  report.checks.push("All three new views have real native overlay alpha, preserve the clip and restore Claire framing.");
  for (const id of ["tilt", "yaw", "roll"]) {
    for (const value of [-Math.PI, Math.PI / 2, Math.PI]) {
      const state = await evaluate(`(() => {const e=document.getElementById("${id}");e.value="${value}";
        e.dispatchEvent(new Event("input"));const c=document.getElementById("face");
        return {value:Number(e.value),error:c.getContext("webgl2").getError()};})()`);
      assert(Math.abs(state.value - value) < .002 && state.error === 0);
    }
    await evaluate(`document.getElementById("${id}").value="0";document.getElementById("${id}").dispatchEvent(new Event("input"));`);
  }
  report.checks.push("All XYZ axes reach +/-180 degrees and 90 degrees without GL errors.");
  await evaluate(`for(const [id,value] of Object.entries({tilt:".22",yaw:".55",roll:"-.12"})){
    document.getElementById(id).value=value;document.getElementById(id).dispatchEvent(new Event("input"));}`);
  await pause(150);
  const turned = await window.webContents.capturePage();
  await fs.writeFile(path.join(output, "head-neck-turned.png"), turned.toPNG());
  await evaluate(`document.getElementById("reset-view").click();`);
  await evaluate(`document.getElementById("follow-eyes").checked=true;
    document.getElementById("follow-eyes").dispatchEvent(new Event("input"));`);
  await pause(500);
  const cursor = screen.getCursorScreenPoint(), bounds = window.getContentBounds();
  report.cursor = { outside: cursor.x < bounds.x || cursor.x > bounds.x + bounds.width
    || cursor.y < bounds.y || cursor.y > bounds.y + bounds.height,
    gaze: await evaluate(`document.getElementById("face").dataset.gaze.split(",").map(Number)`) };
  assert(report.cursor.outside, "Qualification needs cursor outside owned overlay; no cursor warping is permitted.");
  assert(report.cursor.gaze.some((v) => Math.abs(v) > .01));
  report.checks.push("Global cursor outside the overlay drives bounded procedural gaze without moving the system cursor.");
  report.cadence = await evaluate(`new Promise(async resolve => {
    const a=document.getElementById("audio"),g=document.getElementById("face").getContext("webgl2");
    const original=g.clear;let draws=0;g.clear=function(...args){draws++;return original.apply(this,args);};
    a.loop=true;await a.play();const intervals=[];let first=0,last=0;
    function sample(now){
      if(!first)first=now;
      if(last && now-first>300)intervals.push(now-last);last=now;
      if(now-first<30300)requestAnimationFrame(sample);
      else {a.pause();a.loop=false;g.clear=original;
        const sorted=intervals.slice().sort((x,y)=>x-y);
        resolve({samples:sorted.length,meanMs:intervals.reduce((x,y)=>x+y,0)/intervals.length,
          p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),
          over25Ms:sorted.filter(x=>x>25).length,submittedDraws:draws,
          canvas:[g.canvas.width,g.canvas.height]});}
    }requestAnimationFrame(sample);
  })`);
  assert(report.cadence.samples > 1500 && report.cadence.submittedDraws >= report.cadence.samples);
  assert(report.cadence.meanMs < 17.55 && report.cadence.p95Ms < 20, JSON.stringify(report.cadence));
  report.checks.push("Visible native overlay submits real audio-clocked draws within the bounded mean/p95 display budget.");
  report.presentationCadence = [];
  for (const id of ["facemesh", "facedot", "uniform"]) {
    const data = await evaluate(`new Promise(async resolve => {
      const $=id=>document.getElementById(id);$("presentation").value=${JSON.stringify(id)};
      $("presentation").dispatchEvent(new Event("input"));
      if($("presentation").value==="facemesh"){$("mesh-detail").value="1";$("mesh-detail").dispatchEvent(new Event("input"));}
      const a=$("audio"),g=$("face").getContext("webgl2"),original=g.clear,update=g.bufferSubData;
      let draws=0,updates=0;g.clear=function(...args){draws++;return original.apply(this,args);};
      g.bufferSubData=function(...args){updates++;return update.apply(this,args);};
      a.loop=true;await a.play();const intervals=[];let first=0,last=0;
      function sample(now){
        if(!first)first=now;if(last&&now-first>300)intervals.push(now-last);last=now;
        if(now-first<3300)requestAnimationFrame(sample);
        else {a.pause();a.loop=false;g.clear=original;g.bufferSubData=update;
          const sorted=intervals.slice().sort((x,y)=>x-y);
          resolve({id:$("presentation").value,samples:sorted.length,
            meanMs:intervals.reduce((x,y)=>x+y,0)/intervals.length,
            p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),
            over25Ms:sorted.filter(x=>x>25).length,submittedDraws:draws,
            normalUpdates:updates,error:g.getError(),source:a.src,
            canvas:[g.canvas.width,g.canvas.height]});}
      }requestAnimationFrame(sample);
    })`);
    assert(data.samples>150 && data.submittedDraws>=data.samples,JSON.stringify(data));
    assert(data.meanMs<17.55 && data.p95Ms<20,JSON.stringify(data));
    assert.equal(data.normalUpdates,0);
    assert.equal(data.error,0);
    assert.equal(data.source,before.source);
    report.presentationCadence.push(data);
  }
  await evaluate(`document.getElementById("mesh-detail").value="5";
    document.getElementById("mesh-detail").dispatchEvent(new Event("input"));
    document.getElementById("presentation").value="claire";
    document.getElementById("presentation").dispatchEvent(new Event("input"));`);
  report.checks.push("Native low-detail FaceMesh, FaceDot and UniformPolygons animate within budget with zero normal updates.");
  const b = window.getBounds();
  fixture = new BrowserWindow({ ...b, frame: false, show: false, alwaysOnTop: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  await fixture.loadURL("data:text/html,<html style='background:rgb(37,103,71)'><body></body></html>");
  fixture.setAlwaysOnTop(true, "pop-up-menu");
  fixture.showInactive();
  window.moveTop();
  await pause(700);
  const powershell = path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const physical = screen.dipToScreenRect(window, b);
  execFileSync(powershell, ["-NoProfile", "-NonInteractive", "-File", path.join(__dirname, "capture_desktop.ps1"),
    "-Left", String(physical.x), "-Top", String(physical.y), "-Width", String(physical.width), "-Height", String(physical.height),
    "-Output", path.join(output, "desktop-overlay.png")], { timeout: 15000 });
  report.checks.push("Native desktop composition over an owned solid-color fixture captured; no other apps captured.");
  await evaluate(`document.getElementById("appearance").value="shaded";
    document.getElementById("edges").checked=false;
    document.getElementById("appearance").dispatchEvent(new Event("input"));`);
  await pause(150);
  execFileSync(powershell, ["-NoProfile", "-NonInteractive", "-File", path.join(__dirname, "capture_desktop.ps1"),
    "-Left", String(physical.x), "-Top", String(physical.y), "-Width", String(physical.width), "-Height", String(physical.height),
    "-Output", path.join(output, "reference-color-overlay.png")], { timeout: 15000 });
  await evaluate(`document.getElementById("appearance").value="polygon";
    document.getElementById("edges").checked=true;
    document.getElementById("appearance").dispatchEvent(new Event("input"));`);
  fixture.destroy();
  fixture = null;
  await evaluate(`window.veronaDesktop.command("controls")`);
  await wait(`!document.documentElement.classList.contains("overlay")`);
  await waitNative(() => !window.isAlwaysOnTop(), "controls no longer always-on-top");
  const restored = await evaluate(`({source:document.getElementById("audio").src,
    text:document.getElementById("text").value,voice:document.getElementById("voice").value})`);
  assert.deepEqual(restored, before);
  assert.equal(await evaluate(`document.getElementById("framing").value`),"head-neck");
  await evaluate(`document.getElementById("framing").value="full";
    document.getElementById("framing").dispatchEvent(new Event("input"));`);
  assert.match(await evaluate(`document.getElementById("geometry-details").textContent`),/30,746 skin/);
  await evaluate(`document.getElementById("framing").value="head-neck";
    document.getElementById("framing").dispatchEvent(new Event("input"));`);
  const image = await window.webContents.capturePage();
  await fs.writeFile(path.join(output, "desktop-controls.png"), image.toPNG());
  report.checks.push("Returning to controls preserves text/voice/clip and clears always-on-top.");
  await fs.writeFile(path.join(output, "desktop-report.json"), JSON.stringify(report, null, 2));
}

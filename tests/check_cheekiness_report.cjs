const {app, BrowserWindow} = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const output = process.argv.find(a => a.startsWith("--source=")).slice(9);
const profile = process.argv.find(a => a.startsWith("--user-data-dir=")).slice(16);
app.setPath("userData", profile);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const deadline = setTimeout(() => app.exit(1), 60000);
let stage = "opening report", window;

app.whenReady().then(async () => {
  const win = window = new BrowserWindow({show:false, width:1440, height:1200, useContentSize:true,
    webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,
      backgroundThrottling:false,offscreen:true}});
  let painted;
  win.webContents.setFrameRate(60);
  win.webContents.on("paint", (_event, _dirty, image) => { painted=image; });
  win.webContents.on("render-process-gone", (_event, details) => {
    fs.writeFile(path.join(output,"report-renderer-exit.json"),JSON.stringify({stage,...details}));
  });
  const ev = text => win.webContents.executeJavaScript(text, true);
  const external = [];
  const consoleErrors = [];
  win.webContents.on("console-message", (_event, level, message) => {
    if(level>=3)consoleErrors.push(message);
  });
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const allowed = /^(file:|data:|about:)/.test(details.url);
    if (!allowed) external.push(details.url);
    callback({cancel:!allowed});
  });
  const wait = async expression => {
    for (let i=0;!await ev(expression);i++) {
      assert(i < 200, "Report condition timed out: " + expression);
      await pause(25);
    }
  };
  await win.loadFile(path.join(output,"review.html"));
  stage = "decoding comparison images";
  await wait("window.comparisonReady === true");
  const images = await ev(`(async()=>{const all=[...document.images];
    all.forEach(i=>i.loading="eager");
    await Promise.all(all.map(i=>i.decode()));
    return all.map(i=>({width:i.naturalWidth,height:i.naturalHeight}));})()`);
  assert.equal(images.length,3);
  assert(images.every(i=>i.width===1280 && i.height>100));
  const capture = JSON.parse(await fs.readFile(path.join(output,"capture.json"),"utf8"));
  assert.equal(await ev("sequence.length"),capture.frames.length);
  stage = "playing and seeking";
  const first = await ev('document.getElementById("motion").toDataURL()');
  await ev('document.getElementById("play").click()');
  await ev('cancelAnimationFrame(raf); tick(started-1)');
  assert.equal(await ev('position'),0);
  await wait('Number(document.getElementById("seek").value) > .3');
  await ev('document.getElementById("play").click()');
  const playback = await ev('({position,playing,started,now:performance.now(),seek:document.getElementById("seek").value})');
  assert(Number(playback.seek)>.3,JSON.stringify({playback,consoleErrors}));
  assert.notEqual(await ev('document.getElementById("motion").toDataURL()'),first);
  await ev(`(()=>{const s=document.getElementById("seek");s.value="2.1";
    s.dispatchEvent(new Event("input"));})()`);
  assert(await ev('document.getElementById("time").textContent.startsWith("2.10")'));
  await ev('document.getElementById("reset").click()');
  assert.equal(await ev('document.getElementById("motion").toDataURL()'),first);
  const layouts = [];
  stage = "checking responsive layouts";
  for (const width of [1440,600]) {
    win.setContentSize(width,1200);
    await pause(100);
    const layout = await ev("({width:innerWidth,scroll:document.documentElement.scrollWidth})");
    assert(layout.scroll<=layout.width,JSON.stringify(layout));
    layouts.push(layout);
    win.webContents.invalidate();
    for(let i=0;!painted || painted.getSize().width!==width;i++){
      assert(i<100,"Offscreen report paint did not resize.");await pause(25);
    }
    await fs.writeFile(path.join(output,`report-${width}.png`),painted.toPNG());
  }
  assert.equal(external.length,0);
  assert.equal(consoleErrors.length,0,consoleErrors.join("\n"));
  const fixture = path.join(output,"missing-frames-check");
  stage = "checking missing-frame error";
  await fs.mkdir(fixture);
  try {
    await fs.copyFile(path.join(output,"review.html"),path.join(fixture,"review.html"));
    await win.loadFile(path.join(fixture,"review.html"));
    await wait('!document.getElementById("motion-error").hidden');
    assert(await ev('document.getElementById("play").disabled && document.getElementById("seek").disabled'));
  } finally {
    await fs.rm(fixture,{recursive:true});
  }
  await fs.writeFile(path.join(output,"report-check.json"),JSON.stringify({
    passed:true,images,frames:capture.frames.length,playPauseSeekReset:true,layouts,external,
    missingFramesExplicit:true,hidden:true,sandbox:true,
  },null,2));
  clearTimeout(deadline);
  app.quit();
}).catch(async error => {
  await fs.writeFile(path.join(output,"report-error.txt"),stage+"\n"+(error.stack||String(error)));
  clearTimeout(deadline);
  app.exit(1);
});

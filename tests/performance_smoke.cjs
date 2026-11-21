const {app, screen} = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const argument = name => process.argv.find(value => value.startsWith(`--${name}=`)).slice(name.length+3);
const output = argument("qualification-output"), model = argument("qualification-model");
const enabled = argument("head-policy") === "performance";
const report = {model, performanceMode:enabled, checks:[], views:[],
  limits:"Isolated sandboxed native head; synthetic process-local cursor and muted audio, not listening acceptance or new CPU benchmarks."};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let cursorPolls = 0, realCursor;
app.once("browser-window-created", (_event, window) => {
  window.webContents.setAudioMuted(true);
  realCursor = screen.getCursorScreenPoint.bind(screen);
  screen.getCursorScreenPoint = () => {
    cursorPolls++;
    return {x:400+Math.round(300*Math.sin(Date.now()/400)),y:400+Math.round(250*Math.cos(Date.now()/530))};
  };
  window.setOpacity(0);
  window.show = () => window.showInactive();
  window.webContents.once("did-finish-load", () => run(window).then(async () => {
    await fs.writeFile(path.join(output,"performance-report.json"),JSON.stringify(report,null,2));
    screen.getCursorScreenPoint = realCursor;
    window.close();
  }).catch(async error => {
    report.error=error.stack;
    await fs.writeFile(path.join(output,"performance-report.json"),JSON.stringify(report,null,2));
    console.error(error.stack); app.exit(1);
  }));
});
require("../desktop/main.cjs");

async function run(window) {
  const evaluate = code => window.webContents.executeJavaScript(code,true);
  async function wait(code, limit=90000) {
    const until=Date.now()+limit;
    while(Date.now()<until) {
      if(await evaluate(code))return;
      await pause(40);
    }
    throw Error(`Creation-policy qualification timed out: ${code}`);
  }
  await wait(`document.getElementById("generate") && !document.getElementById("generate").disabled`);
  const command = payload => evaluate(`fetch("/api/agent",{method:"POST",
    headers:{"Content-Type":"application/json","X-Verona-Token":location.hash.slice(1)},
    body:${JSON.stringify(JSON.stringify(payload))}}).then(async r=>{
      const v=await r.json();if(!r.ok)throw Error(v.error);return v;})`);
  await wait(`document.documentElement.classList.contains("overlay")`);
  for(let i=0;i<100 && !(await command({action:"status"})).ready;i++)await pause(50);
  const status=await command({action:"status"});
  assert.equal(status.appearance.performanceMode,enabled);
  assert(!status.controls.some(c=>c.id==="performance-mode"||c.id.startsWith("quick-")));
  assert.equal(await evaluate(`document.getElementById("performance-mode")===null
    &&document.getElementById("quick-performance")===null`),true);
  assert.equal(await evaluate(`document.getElementById("performance-badge").hidden`),!enabled);
  await assert.rejects(command({action:"configure",settings:{"performance-mode":!enabled}}),/fixed at creation/);
  await evaluate(`(() => {
    const $=id=>document.getElementById(id),gl=$("face").getContext("webgl2");
    const test=window.__perf={frames:0,uploads:0,storage:0};
    test.change=(id,value)=>{const e=$(id);if(e.type==="checkbox")e.checked=value;else e.value=value;
      e.dispatchEvent(new Event("input",{bubbles:true}));};
    for(const [method,key]of[["clear","frames"],["bufferSubData","uploads"],["bufferData","storage"]]){
      const original=gl[method].bind(gl);gl[method]=(...args)=>{test[key]++;return original(...args);};}
    $("audio").muted=$("voice-preview").muted=true;
    test.change("follow-eyes",true);test.change("natural-blink",true);test.change("idle-life",true);
    test.change("cursor-mode","head");
  })()`);
  const snapshot = () => evaluate(`({frames:__perf.frames,uploads:__perf.uploads,storage:__perf.storage,
    opacity:getComputedStyle(document.getElementById("face")).opacity,
    state:document.getElementById("face").dataset.performanceState})`);
  for(const view of ["claire","facemesh","facedot","uniform"]) {
    await evaluate(`__perf.change("presentation",${JSON.stringify(view)})`);
    await pause(150);
    const before=await snapshot(), polls=cursorPolls;
    await pause(400);
    const after=await snapshot();
    assert.equal(after.opacity,enabled?"0.1":"1");
    assert.equal(after.state,enabled?"sleeping":"off");
    if(enabled) {
      assert.equal(after.frames,before.frames);assert.equal(after.uploads,before.uploads);
      assert.equal(after.storage,before.storage);assert.equal(cursorPolls,polls);
    } else {
      assert(after.frames>before.frames);assert(cursorPolls>polls);
    }
    assert(await evaluate(`document.getElementById("follow-eyes").checked
      &&document.getElementById("natural-blink").checked&&document.getElementById("idle-life").checked`));
    report.views.push({view,policyVerified:true});
  }
  await evaluate(`__perf.change("quick-opacity","0")`);
  assert.equal((await snapshot()).opacity,enabled?"0.1":"0");
  assert.equal(await evaluate(`getComputedStyle(document.getElementById("overlay-toolbar")).opacity`),"1");
  await command({action:"configure",settings:{"head-opacity":"35"}});
  assert.equal(await evaluate(`document.getElementById("quick-opacity").value`),"35");
  const silent=enabled?"0.1":"0.35", speaking=enabled?"1":"0.35";
  assert.equal((await snapshot()).opacity,silent);
  await evaluate(`(() => {
    const rate=8000,bytes=new ArrayBuffer(44+rate*2),d=new DataView(bytes);
    const text=(at,s)=>{for(let i=0;i<s.length;i++)d.setUint8(at+i,s.charCodeAt(i));};
    text(0,"RIFF");d.setUint32(4,bytes.byteLength-8,true);text(8,"WAVEfmt ");d.setUint32(16,16,true);
    d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,rate,true);
    d.setUint32(28,rate*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);
    text(36,"data");d.setUint32(40,rate*2,true);
    window.__fixtureUrl=URL.createObjectURL(new Blob([bytes],{type:"audio/wav"}));
    const voice=document.getElementById("voice-preview");voice.src=__fixtureUrl;voice.load();
  })()`);
  await wait(`document.getElementById("voice-preview").readyState>=1`);
  await evaluate(`document.getElementById("voice-preview").play()`);
  assert.equal((await snapshot()).opacity,speaking);
  await wait(`document.getElementById("voice-preview").ended`);
  assert.equal((await snapshot()).opacity,silent);
  await evaluate(`document.getElementById("voice-preview").removeAttribute("src");
    document.getElementById("voice-preview").load();URL.revokeObjectURL(__fixtureUrl)`);
  if(model==="claire") for(const [index,mode]of["face","voice"].entries()) {
    const id=(index?"b":"a").repeat(32);
    await command({action:"say",id,text:"A quiet local creation check.",voice:null,
      expression:"neutral",intensity:.35,gain:4,mode});
    assert.equal((await snapshot()).opacity,silent);
    const audioId=mode==="face"?"audio":"voice-preview";
    await wait(`!document.getElementById(${JSON.stringify(audioId)}).paused`);
    assert.equal((await snapshot()).opacity,speaking);
    await wait(`document.getElementById(${JSON.stringify(audioId)}).currentTime>.05`,5000);
    await command({action:"cancel",id});
    await wait(`document.getElementById(${JSON.stringify(audioId)}).paused`);
    assert.equal((await snapshot()).opacity,silent);
    await wait(`!document.getElementById("clear-speech").disabled`);
    await evaluate(`document.getElementById("clear-speech").click()`);
  }
  if(enabled) {
    await evaluate(`__perf.change("idle-sounds",true)`);
    assert(await evaluate(`document.getElementById("idle-preview").disabled`));
    const before=await snapshot();
    await pause(13000);
    assert.equal((await snapshot()).frames,before.frames,"Sleeping heads do not start an idle gesture or sound.");
    assert(await evaluate(`!document.getElementById("face").dataset.idleAction`));
    report.checks.push("Performance-only idle remains asleep with idle sounds enabled beyond the minimum scheduling interval.");
  }
  assert.equal(window.webContents.getLastWebPreferences().sandbox,true);
  assert(await evaluate(`document.getElementById("error").hidden`),
    await evaluate(`document.getElementById("error").textContent`));
  report.checks.push("Creation-only policy; no mutable toggle; live policy update rejected.",
    "Four views retain choices; only opted-in heads dim and stop drawing/polling.",
    "Opacity controls remain usable; actual audio prep/play/end/cancel preserves selected policy.");
}

const {app, screen} = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const argument = name => process.argv.find(value => value.startsWith(`--${name}=`)).slice(name.length+3);
const output = argument("qualification-output"), model = argument("qualification-model");
const report = {model, checks: [], views: [], measurements: [],
  limits: "Owned Electron CPU seconds/private working set; invisible unfocused window, synthetic cursor, muted audio. Not whole-machine/GPU energy or human acceptance."};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let cursorPolls = 0, cursorMoving = false, realCursor;
app.once("browser-window-created", (_event, window) => {
  realCursor = screen.getCursorScreenPoint.bind(screen);
  screen.getCursorScreenPoint = () => {
    cursorPolls++;
    return cursorMoving ? {x: 400+Math.round(300*Math.sin(Date.now()/400)),
      y: 400+Math.round(250*Math.cos(Date.now()/530))} : {x: 500, y: 400};
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
  async function wait(code, limit=60000) {
    const until=Date.now()+limit;
    while(Date.now()<until) {
      const value=await evaluate(code);
      if(value)return value;
      await pause(40);
    }
    throw Error(`Performance qualification timed out: ${code}`);
  }
  await wait(`document.getElementById("generate") && !document.getElementById("generate").disabled`);
  const command = payload => evaluate(`fetch("/api/agent",{method:"POST",
    headers:{"Content-Type":"application/json","X-Verona-Token":location.hash.slice(1)},
    body:${JSON.stringify(JSON.stringify(payload))}}).then(async r=>{
      const v=await r.json();if(!r.ok)throw Error(v.error);return v;})`);
  await wait(`document.documentElement.classList.contains("overlay")`);
  for(let i=0;i<100 && !(await command({action:"status"})).ready;i++)await pause(50);
  const controls=(await command({action:"status"})).controls;
  assert(controls.some(c=>c.id==="performance-mode"&&!c.disabled));
  assert(controls.some(c=>c.id==="head-opacity"&&!c.disabled));
  assert(!controls.some(c=>c.id.startsWith("quick-")));
  await evaluate(`(() => {
    const $=id=>document.getElementById(id),gl=$("face").getContext("webgl2");
    const test=window.__perf={frames:0, uploads:0, storage:0};
    test.change=(id,value)=>{const e=$(id);if(e.type==="checkbox")e.checked=value;else e.value=value;
      e.dispatchEvent(new Event("input",{bubbles:true}));};
    for(const [method,key]of[["clear","frames"],["bufferSubData","uploads"],["bufferData","storage"]]){
      const original=gl[method].bind(gl);gl[method]=(...args)=>{test[key]++;return original(...args);};}
    $("audio").muted=$("voice-preview").muted=true;
    test.change("follow-eyes",true);test.change("natural-blink",true);test.change("idle-life",true);
    test.change("cursor-mode","head");test.change("hair",true);test.change("appearance","shaded");
  })()`);
  const snapshot = () => evaluate(`({frames:__perf.frames,uploads:__perf.uploads,storage:__perf.storage,
    opacity:getComputedStyle(document.getElementById("face")).opacity,
    state:document.getElementById("face").dataset.performanceState,
    blink:document.getElementById("face").dataset.blink,
    action:document.getElementById("face").dataset.idleAction})`);
  for(const view of ["claire","facemesh","facedot","uniform"]) {
    await evaluate(`__perf.change("presentation",${JSON.stringify(view)});__perf.change("quick-performance",true)`);
    await pause(120);
    const before=await snapshot(), polls=cursorPolls;
    cursorMoving=true;
    window.webContents.send("verona:cursor",{x:900,y:900});
    await pause(400);
    const after=await snapshot();
    assert.equal(after.opacity,"0.1"); assert.equal(after.state,"sleeping");
    assert.equal(after.frames,before.frames);assert.equal(after.uploads,before.uploads);
    assert.equal(after.storage,before.storage);assert.equal(cursorPolls,polls);
    assert.equal(after.blink,"0");assert.equal(after.action,"");
    assert(await evaluate(`document.getElementById("idle-preview").disabled`));
    assert(await evaluate(`!document.getElementById("follow-eyes").disabled
      && document.getElementById("follow-eyes").checked
      && document.getElementById("natural-blink").checked
      && document.getElementById("idle-life").checked`));
    await evaluate(`__perf.change("quick-opacity","35");__perf.change("quick-performance",false)`);
    assert.equal((await snapshot()).opacity,"0.35");
    assert.equal(await evaluate(`document.getElementById("head-opacity").value`),"35");
    await evaluate(`__perf.change("head-opacity","0")`);
    assert.equal((await snapshot()).opacity,"0");
    assert.equal(await evaluate(`document.getElementById("quick-opacity").value`),"0");
    assert.equal(await evaluate(`getComputedStyle(document.getElementById("overlay-toolbar")).opacity`),"1");
    await command({action:"configure",settings:{"head-opacity":"100"}});
    await command({action:"configure",settings:{"performance-mode":true}});
    report.views.push({view,zeroWaitingDraws:true,zeroUploads:true,zeroNativeCursorPolls:true,
      savedChoicesPreserved:true,quickAndManagerControls:true});
  }
  report.checks.push("All four views: 10% idle; zero RAF draws/uploads/storage/native cursor polling; choices retained; quick/manager controls; 0% remains recoverable.");
  assert.equal(window.webContents.getLastWebPreferences().sandbox,true);
  assert.equal(await evaluate("typeof require"),"undefined");
  if(model==="claire") {
    await evaluate(`__perf.change("performance-mode",false);__perf.change("presentation","claire");
      __perf.change("follow-eyes",false);__perf.change("natural-blink",false);
      __perf.change("idle-life",false);document.getElementById("overlay-toggle").click()`);
    await pause(500);
    const normal=await window.capturePage(), size=normal.getSize(), opaque=normal.toBitmap();
    await evaluate(`__perf.change("quick-performance",true)`);
    await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    const sleeping=await window.capturePage(), dim=sleeping.toBitmap();
    let samples=0;
    for(let y=Math.floor(size.height*.4);y<size.height;y++)for(let x=0;x<size.width;x++){
      const i=(y*size.width+x)*4+3;
      if(opaque[i]>240){samples++;assert(Math.abs(dim[i]-opaque[i]*.1)<=2);}
    }
    assert(samples>1000);
    await fs.writeFile(path.join(output,"normal-opacity.png"),normal.toPNG());
    await fs.writeFile(path.join(output,"performance-idle.png"),sleeping.toPNG());
    report.compositedAlpha={samples,ratio:.1,toleranceByte:2,controlsNotFaded:true};
    await evaluate(`__perf.change("follow-eyes",true);__perf.change("natural-blink",true);
      __perf.change("idle-life",true);document.getElementById("overlay-toggle").click()`);
    report.checks.push("Actual composited head alpha is 10% of opaque; native content snapshots retain readable quick controls.");
  }
  // Real media decoder/playback for every selected engine, without new inference.
  await evaluate(`(() => {
    const rate=8000, seconds=1, bytes=new ArrayBuffer(44+rate*seconds*2),d=new DataView(bytes);
    const text=(at,s)=>{for(let i=0;i<s.length;i++)d.setUint8(at+i,s.charCodeAt(i));};
    text(0,"RIFF");d.setUint32(4,bytes.byteLength-8,true);text(8,"WAVEfmt ");d.setUint32(16,16,true);
    d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,rate,true);
    d.setUint32(28,rate*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);
    text(36,"data");d.setUint32(40,rate*seconds*2,true);
    window.__fixtureUrl=URL.createObjectURL(new Blob([bytes],{type:"audio/wav"}));
    const voice=document.getElementById("voice-preview");voice.src=__fixtureUrl;voice.load();
  })()`);
  await wait(`document.getElementById("voice-preview").readyState>=1`);
  await evaluate(`document.getElementById("voice-preview").play()`);
  await wait(`document.getElementById("face").dataset.performanceState==="speaking"`);
  assert.equal((await snapshot()).opacity,"1");
  await wait(`document.getElementById("voice-preview").ended`);
  assert.equal((await snapshot()).opacity,"0.1");
  await evaluate(`document.getElementById("voice-preview").removeAttribute("src");
    document.getElementById("voice-preview").load();URL.revokeObjectURL(__fixtureUrl)`);
  report.checks.push("Actual muted WAV playback wakes immediately at 100%; natural end sleeps at 10%.");
  if(model==="claire") {
    for(const [index,mode]of["face","voice"].entries()) {
      const id=(index?"b":"a").repeat(32);
      await command({action:"say",id,text:"A quiet local performance check.",voice:null,
        expression:"neutral",intensity:.35,gain:4,mode});
      assert.equal((await snapshot()).opacity,"0.1","Preparation remains asleep.");
      const audioId=mode==="face"?"audio":"voice-preview";
      await wait(`!document.getElementById(${JSON.stringify(audioId)}).paused`,90000);
      assert.equal((await snapshot()).opacity,"1");
      const start=await evaluate(`document.getElementById(${JSON.stringify(audioId)}).currentTime`);
      await wait(`document.getElementById(${JSON.stringify(audioId)}).currentTime > ${start + .05}`,5000);
      const time=await evaluate(`document.getElementById(${JSON.stringify(audioId)}).currentTime`);
      assert(time>start);
      await evaluate(`__perf.change("head-opacity","35");__perf.change("performance-mode",false)`);
      assert.equal((await snapshot()).opacity,"0.35");
      await evaluate(`__perf.change("quick-performance",true)`);
      assert.equal((await snapshot()).opacity,"1");
      await command({action:"cancel",id});
      await wait(`document.getElementById("face").dataset.performanceState==="sleeping"`);
      await wait(`!document.getElementById("clear-speech").disabled`);
      assert.equal((await snapshot()).opacity,"0.1");
      await evaluate(`document.getElementById("clear-speech").click()`);
    }
    report.checks.push("Real agent face and voice: dim throughout preparation, 100% playback, advancing audio clock and 10% cancellation.");
    await evaluate(`__perf.change("presentation","claire");__perf.change("hairstyle","claire");
      __perf.change("framing","head-neck");__perf.change("zoom","1.2");`);
    // Counterbalanced paired windows; the actual desktop cursor never moves.
    if(!process.argv.includes("--checks-only")) for(const moving of [false,true]) for(const enabled of [false,true,true,false]) {
      cursorMoving=moving;
      await evaluate(`__perf.change("performance-mode",${enabled})`);
      await pause(1000);
      const startMetrics=metrics(), before=await snapshot(), polls=cursorPolls, start=performance.now();
      await pause(16000);
      const endMetrics=metrics(), seconds=(performance.now()-start)/1000, after=await snapshot();
      assert.deepEqual(endMetrics.map(p=>p.pid),startMetrics.map(p=>p.pid),"Owned process set must stay stable.");
      const cpuSeconds=endMetrics.reduce((sum,p,i)=>sum+p.cpuSeconds-startMetrics[i].cpuSeconds,0);
      const row={cursor:moving?"moving":"stationary",performance:enabled,seconds,cpuSeconds,
        oneCorePercent:cpuSeconds/seconds*100,frames:after.frames-before.frames,
        nativeCursorPolls:cursorPolls-polls,
        workingSetMiB:endMetrics.reduce((sum,p)=>sum+p.workingSetKiB/1024,0),
        privateMiB:endMetrics.reduce((sum,p)=>sum+p.privateKiB/1024,0),
        processes:endMetrics};
      report.measurements.push(row);
      if(enabled){assert.equal(row.frames,0);assert.equal(row.nativeCursorPolls,0);}
    }
    if(report.measurements.length) report.checks.push("Eight 16-second counterbalanced owned-process measurement windows; sleeping has no draws or native cursor polls.");
  }
  assert(await evaluate(`document.getElementById("error").hidden`),
    await evaluate(`document.getElementById("error").textContent`));
  report.checks.push("No visible app errors; native sandbox and context isolation retained.");
}

function metrics() {
  return app.getAppMetrics().sort((a,b)=>a.pid-b.pid).map(p=>{
    assert(Number.isFinite(p.cpu.cumulativeCPUUsage));
    assert(Number.isFinite(p.memory.privateBytes));
    return {pid:p.pid,type:p.type,cpuSeconds:p.cpu.cumulativeCPUUsage,
      privateKiB:p.memory.privateBytes,workingSetKiB:p.memory.workingSetSize};
  });
}

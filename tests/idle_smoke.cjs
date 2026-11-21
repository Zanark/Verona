const {app, BrowserWindow} = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const argument = name => process.argv.find(value => value.startsWith(`--${name}=`)).slice(name.length+3);
const output = argument("qualification-output"), model = argument("qualification-model");
const report = {model, checks: [], views: [],
  limits: "Actual owned native canvas pixels, not OS-composition capture or human acceptance. Audio muted."};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.once("browser-window-created", (_event, window) => {
  window.setOpacity(0);
  window.webContents.setAudioMuted(true);
  window.show = () => window.showInactive();
  window.webContents.once("did-finish-load", () => run(window).then(async () => {
    await fs.writeFile(path.join(output, "idle-report.json"), JSON.stringify(report, null, 2));
    window.close();
  }).catch(async error => {
    report.error = error.stack;
    await fs.writeFile(path.join(output, "idle-report.json"), JSON.stringify(report, null, 2));
    console.error(error.stack); app.exit(1);
  }));
});
require("../desktop/main.cjs");

async function run(window) {
  const evaluate = code => window.webContents.executeJavaScript(code, true);
  async function wait(code, limit = 60000) {
    const until = Date.now()+limit;
    while (Date.now() < until) {
      const value = await evaluate(code);
      if (value) return value;
      await pause(40);
    }
    throw new Error(`Idle qualification timed out: ${code}`);
  }
  await wait(`document.getElementById("generate") && !document.getElementById("generate").disabled`);
  const command = payload => evaluate(`fetch("/api/agent",{method:"POST",
    headers:{"Content-Type":"application/json","X-Verona-Token":location.hash.slice(1)},
    body:${JSON.stringify(JSON.stringify(payload))}}).then(async response=>{
      const value=await response.json();if(!response.ok)throw Error(value.error);return value;})`);
  for (let i=0; i<100 && !(await command({action:"status"})).ready; i++) await pause(50);
  const status = await command({action:"status"});
  assert(status.ready);
  assert(status.controls.some(control => control.id === "idle-life" && !control.disabled));
  assert(!status.controls.some(control => control.id === "idle-action"));
  for (const value of [false, true]) {
    const changed = await command({action:"configure", settings:{"idle-life":value}});
    assert.equal(changed.controls.find(control => control.id === "idle-life").value, value);
  }
  assert.equal(window.webContents.getLastWebPreferences().sandbox, true);
  assert.equal(await evaluate("typeof require"), "undefined");
  await evaluate(`(() => {
    const $=id=>document.getElementById(id);
    for (const id of ["natural-blink","follow-eyes"]) {
      $(id).checked=false;$(id).dispatchEvent(new Event("input",{bubbles:true}));
    }
    $("audio").muted=$("voice-preview").muted=true;
    window.__idleTest={offset:0, stats:{frames:0,create:0,remove:0,storage:0,uploads:0,requests:0,
      audioContexts:0,audioBuffers:0,audioStarts:0,audioStops:0}};
    const test=window.__idleTest, realNow=performance.now.bind(performance);
    const OriginalContext=window.AudioContext;
    window.AudioContext=function(...args){
      const context=new OriginalContext(...args);test.context=context;test.stats.audioContexts++;
      const buffer=context.createBuffer.bind(context),source=context.createBufferSource.bind(context);
      const gain=context.createGain.bind(context);
      context.createGain=()=>{test.lastGain=gain();return test.lastGain;};
      context.createBuffer=(...values)=>{test.stats.audioBuffers++;return buffer(...values);};
      context.createBufferSource=()=>{
        const node=source(),start=node.start.bind(node),stop=node.stop.bind(node);
        node.start=(...values)=>{test.stats.audioStarts++;test.lastSource=node;return start(...values);};
        node.stop=(...values)=>{test.stats.audioStops++;return stop(...values);};
        return node;
      };
      return context;
    };
    test.realNow=realNow;
    performance.now=()=>realNow()+test.offset;
    const gl=$("face").getContext("webgl2");
    for(const [method,key] of [["clear","frames"],["createBuffer","create"],["deleteBuffer","remove"],
      ["bufferData","storage"],["bufferSubData","uploads"]]){
      const original=gl[method].bind(gl);gl[method]=(...args)=>{test.stats[key]++;return original(...args);};
    }
    const fetchOriginal=window.fetch.bind(window);
    test.requestPaths=[];
    window.fetch=(...args)=>{test.stats.requests++;test.requestPaths.push(String(args[0]));return fetchOriginal(...args);};
    test.change=(id,value)=>{const input=$(id);
      if(input.type==="checkbox")input.checked=value;else input.value=value;
      input.dispatchEvent(new Event("input",{bubbles:true}));};
    test.capture=offset=>{
      test.offset+=offset;
      window.dispatchEvent(new Event("resize"));
      const canvas=$("face"),pixels=new Uint8Array(canvas.width*canvas.height*4);
      gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let hash=2166136261,visible=0;
      for(let i=0;i<pixels.length;i++){hash=Math.imul(hash^pixels[i],16777619)>>>0;
        if(i%4===3 && pixels[i]>128)visible++;}
      const program=gl.getParameter(gl.CURRENT_PROGRAM);
      let changed=0,alphaChanged=0,coverageChanged=0,maxDelta=0,outsideNeutral=0;
      if(test.reference?.length===pixels.length)for(let i=0;i<pixels.length;i++){
        if(test.minimum && (pixels[i]<test.minimum[i] || pixels[i]>test.maximum[i]))outsideNeutral++;
        if(pixels[i]!==test.reference[i]){changed++;if(i%4===3){alphaChanged++;
          if((pixels[i]>128)!==(test.reference[i]>128))coverageChanged++;}
          maxDelta=Math.max(maxDelta,Math.abs(pixels[i]-test.reference[i]));}}
      test.lastPixels=pixels;
      return {id:canvas.dataset.idleAction,hash,visible,error:gl.getError(),width:canvas.width,height:canvas.height,
        difference:{changed,alphaChanged,coverageChanged,maxDelta,outsideNeutral},
        image:canvas.toDataURL("image/png").split(",")[1],
        gaze:Array.from(gl.getUniform(program,gl.getUniformLocation(program,"gaze"))),
        lids:Array.from(gl.getUniform(program,gl.getUniformLocation(program,"idleLids"))),
        uniforms:["idleFaceA","idleFaceB","idleFaceC","idleLids"].map(name=>
          Array.from(gl.getUniform(program,gl.getUniformLocation(program,name))))};
    };
    test.preview=id=>{$("idle-action").value=id;$("idle-preview").click();};
  })()`);
  await pause(500);
  const waitingBefore = await evaluate(`({...__idleTest.stats})`);
  await pause(900);
  const waitingAfter = await evaluate(`({...__idleTest.stats})`);
  assert.equal(waitingAfter.frames-waitingBefore.frames, 0, "Waiting adds zero frames with blink/follow disabled.");
  assert.equal(waitingAfter.requests-waitingBefore.requests, 0);
  assert.equal(waitingAfter.audioContexts-waitingBefore.audioContexts,0);
  assert.equal(waitingAfter.audioStarts-waitingBefore.audioStarts,0);
  report.waiting = {seconds: .9, frames: 0, requests: 0, note: "Blink/follow disabled to isolate this feature."};
  report.checks.push("Real per-head manager toggle; sandbox intact; no waiting redraw or request.");
  if (model === "claire") {
    await wait(`Boolean(document.getElementById("face").dataset.idleAction)`, 31000);
    report.automaticAction = await evaluate(`document.getElementById("face").dataset.idleAction`);
    await wait(`!document.getElementById("face").dataset.idleAction`, 6000);
    report.checks.push("Unprompted timeout selects, plays and finishes a real action without session choice.");
  }
  const catalog = await evaluate(`Array.from(document.getElementById("idle-action").options,o=>({id:o.value,label:o.textContent}))`);
  assert.equal(catalog.length,30);
  const {IDLE_ACTIONS} = await import("../verona/web/idle-life.mjs");
  const durations = Object.fromEntries(IDLE_ACTIONS.map(action=>[action.id,action.duration]));
  for (const view of ["claire","facemesh","facedot","uniform"]) {
    await evaluate(`__idleTest.change("presentation",${JSON.stringify(view)});
      __idleTest.change("hair",true);
      __idleTest.change("hairstyle","claire");
      __idleTest.change("appearance","shaded");
      __idleTest.change("edges",false);
      ${view === "facemesh" ? "" : '__idleTest.change("framing","head-neck");'}
      __idleTest.change("cursor-mode","head");`);
    await pause(100);
    const baseline = await evaluate("__idleTest.capture(0)");
    await evaluate("__idleTest.reference=__idleTest.lastPixels");
    const neutralVariation = await evaluate(`(() => {
      const test=__idleTest;test.minimum=test.reference.slice();test.maximum=test.reference.slice();
      const hashes=new Set([${baseline.hash}]);
      for(let frame=0;frame<64;frame++){
        hashes.add(test.capture(0).hash);
        for(let i=0;i<test.lastPixels.length;i++){
          test.minimum[i]=Math.min(test.minimum[i],test.lastPixels[i]);
          test.maximum[i]=Math.max(test.maximum[i],test.lastPixels[i]);
        }
      }
      let channels=0,maxSpan=0;
      for(let i=0;i<test.minimum.length;i++)if(test.minimum[i]!==test.maximum[i]){
        channels++;maxSpan=Math.max(maxSpan,test.maximum[i]-test.minimum[i]);}
      return {unchangedFrames:65,hashes:hashes.size,channels,maxSpan};
    })()`);
    report.baselineRepeat = {view,neutralVariation};
    assert(baseline.visible > 1000 && baseline.error === 0);
    if(view === "claire") await fs.writeFile(path.join(output,"surface-neutral.png"),Buffer.from(baseline.image,"base64"));
    const before = await evaluate(`({...__idleTest.stats})`);
    const poses=[];
    for (const action of catalog) {
      await evaluate(`__idleTest.preview(${JSON.stringify(action.id)})`);
      const fraction = ["nod","alternate-wink"].includes(action.id) ? .2
        : ["jaw","look","stretch"].includes(action.id) ? .27 : .43;
      const pose = await evaluate(`__idleTest.capture(${durations[action.id]*fraction})`);
      assert.equal(pose.id,action.id,`${view}/${action.id} is actually running`);
      assert.equal(pose.error,0);
      assert(pose.visible>1000);
      assert.notEqual(pose.hash,baseline.hash,`${model}/${view}/${action.id} changes real pixels`);
      assert(pose.difference.changed>50,`${model}/${view}/${action.id} changes more than isolated color readback noise`);
      if(["look","eye-scan","eye-roll","reading"].includes(action.id)) {
        assert(pose.gaze.some(value=>Math.abs(value)>.05),`${action.id} has actual shader gaze in head cursor mode`);
      }
      if(["wink","alternate-wink"].includes(action.id)) {
        assert(pose.lids.some(value=>value>.5) && pose.lids.some(value=>value===0),
          `${action.id} closes only the intended eye, including optical aperture`);
      }
      if(view === "claire" || view === "facemesh") {
        await fs.writeFile(path.join(output,`${view}-${action.id}.png`),Buffer.from(pose.image,"base64"));
      }
      const restored = await evaluate(`__idleTest.capture(${durations[action.id]+10})`);
      assert.equal(restored.id,"");
      if(restored.hash!==baseline.hash) {
        await fs.writeFile(path.join(output,`${view}-${action.id}-restored.png`),Buffer.from(restored.image,"base64"));
        report.restorationDifference={view,action:action.id,baseline:{hash:baseline.hash,width:baseline.width,height:baseline.height},
          restored:{hash:restored.hash,width:restored.width,height:restored.height,uniforms:restored.uniforms,difference:restored.difference}};
      }
      assert.equal(restored.difference.outsideNeutral,0,`${view}/${action.id} restores the measured per-channel neutral envelope`);
      if(view==="claire") assert.equal(restored.hash,baseline.hash,`${action.id} restores exact filled-surface pixels`);
      assert(restored.uniforms.flat().every(value=>value===0));
      poses.push({id:action.id,hash:pose.hash,visible:pose.visible,gaze:pose.gaze,lids:pose.lids,
        changedBytes:pose.difference.changed,restoredDifference:restored.difference});
    }
    const after = await evaluate(`({...__idleTest.stats})`);
    for(const key of ["create","remove","storage","uploads"]) {
      assert.equal(after[key]-before[key],0,`${view}: gestures do not change ${key}`);
    }
    const soundRequests=after.requests-before.requests;
    assert(soundRequests<=1,"Only one bounded supplied-yawn request per view; no motion polling.");
    assert((await evaluate("__idleTest.requestPaths")).slice(before.requests)
      .every(value=>/^\/api\/idle-sound\/yawn-(male|female)$/.test(value)));
    report.views.push({view,neutralVariation,actions:poses,gestureBufferAllocations:0,gestureUploads:0,gestureRequests:soundRequests});
  }
  report.checks.push("All30actions change real pixels in four views; neutral restoration, no gesture buffers/uploads, only bounded local supplied-yawn fetches.");
  await evaluate(`__idleTest.change("presentation","claire");__idleTest.change("cursor-mode","eyes");`);
  report.eyeDirections=[];
  for(const cursorMode of ["eyes","head"]) {
    await evaluate(`__idleTest.change("cursor-mode",${JSON.stringify(cursorMode)});__idleTest.preview("look")`);
    const first=await evaluate("__idleTest.capture(800)");
    const second=await evaluate("__idleTest.capture(1300)");
    assert(first.gaze[0]*second.gaze[0]<0 && first.gaze[1]*second.gaze[1]<0,
      "Look-around changes actual horizontal and vertical eye direction in either cursor mode.");
    await evaluate("__idleTest.capture(4000)");
    await evaluate(`__idleTest.preview("alternate-wink")`);
    const a=await evaluate("__idleTest.capture(580)");
    const b=await evaluate("__idleTest.capture(1400)");
    assert(a.lids[0]*b.lids[0]===0 && a.lids[1]*b.lids[1]===0);
    assert(a.lids.some(v=>v>.5)&&b.lids.some(v=>v>.5));
    await evaluate("__idleTest.capture(4000)");
    report.eyeDirections.push({cursorMode,first:first.gaze,second:second.gaze,winks:[a.lids,b.lids]});
  }
  const starts=await evaluate("__idleTest.stats.audioStarts");
  await evaluate(`__idleTest.preview("yawn")`);
  await wait(`__idleTest.stats.audioStarts>${starts}`);
  const soundBefore=await evaluate("__idleTest.context.currentTime");
  await pause(120);
  const sound=await evaluate(`(() => {
    const data=__idleTest.lastSource.buffer.getChannelData(0);let peak=0,energy=0;
    for(const value of data){peak=Math.max(peak,Math.abs(value));energy+=value*value;}
    return {duration:__idleTest.lastSource.buffer.duration,peak,rms:Math.sqrt(energy/data.length),
      time:__idleTest.context.currentTime,contexts:__idleTest.stats.audioContexts};
  })()`);
  assert(sound.time>soundBefore && sound.peak>.01 && sound.peak<.901 && sound.rms>.005);
  assert(sound.duration>0&&sound.duration<=4.2);assert.equal(sound.contexts,1);
  assert(Math.abs((await evaluate("__idleTest.lastGain.gain.value"))-.2)<1e-6);
  assert.equal(await evaluate('document.getElementById("idle-volume").max'),"20");
  await command({action:"configure",settings:{"idle-sounds":false}});
  await wait(`__idleTest.context.state==="suspended"`);
  assert.equal((await evaluate("__idleTest.capture(0)")).id,"");
  const mutedStarts=await evaluate("__idleTest.stats.audioStarts");
  await evaluate(`__idleTest.preview("sneeze")`);
  await pause(50);
  assert.equal(await evaluate("__idleTest.stats.audioStarts"),mutedStarts);
  await evaluate("__idleTest.capture(4000)");
  await command({action:"configure",settings:{"idle-sounds":true}});
  report.sound={...sound,mutedPreviewStarts:0,contextSuspendedAfterCancel:true};
  report.checks.push("Real local audio buffer/clock, bounded peak and one context; manager mute cancels immediately and suppresses future sounds.");
  if(model==="claire") {
    const originalVoice=(await command({action:"status"})).controls.find(row=>row.id==="voice").value;
    await evaluate('__idleTest.capture(5000)');
    await command({action:"configure",settings:{voice:"Microsoft David Desktop"}});
    const previousStarts=await evaluate("__idleTest.stats.audioStarts");
    await evaluate('__idleTest.preview("yawn")');
    await wait(`__idleTest.stats.audioStarts>${previousStarts}`);
    assert.equal(await evaluate("__idleTest.lastSource.buffer.duration"),1.24);
    assert((await evaluate('document.getElementById("idle-sound-status").textContent')).includes("yawn-male"));
    await evaluate('__idleTest.capture(5000)');
    await command({action:"configure",settings:{voice:originalVoice}});
    report.checks.push("Supplied female/male effect switches with real voice selection; native gain and slider cap20%.");
    await evaluate(`__idleTest.resume=__idleTest.context.resume.bind(__idleTest.context);
      __idleTest.context.resume=()=>Promise.reject(Error("Fixture audio output unavailable"));
      __idleTest.preview("sneeze");`);
    await wait(`!document.getElementById("overlay-error").hidden`);
    assert((await evaluate(`document.getElementById("overlay-error").textContent`)).includes("Fixture audio output unavailable"));
    await evaluate(`__idleTest.capture(4000);__idleTest.context.resume=__idleTest.resume;
      document.getElementById("idle-sound-enable").click();`);
    await wait(`document.getElementById("error").hidden && document.getElementById("overlay-error").hidden`);
    report.checks.push("Audio output failure is visible on the actual overlay; explicit retry recovers and clears only its own error.");
  }
  await evaluate(`__idleTest.change("presentation","claire");__idleTest.change("hairstyle","curls");
    __idleTest.preview("stretch");`);
  await evaluate("__idleTest.capture(1300)");
  await evaluate(`document.getElementById("face").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}))`);
  assert.equal((await evaluate("__idleTest.capture(60000)")).id,"");
  await evaluate(`window.dispatchEvent(new PointerEvent("pointerup",{bubbles:true}));__idleTest.preview("puff");`);
  await evaluate("__idleTest.capture(900)");
  await evaluate(`document.dispatchEvent(new KeyboardEvent("keydown",{key:"a",bubbles:true}))`);
  const interrupted = await evaluate("__idleTest.capture(0)");
  assert.equal(interrupted.id,"");
  assert(interrupted.uniforms.flat().every(value=>value===0));
  report.checks.push("Held pointer suppresses actions; typing removes a running action immediately; curls remain usable.");
  if(model === "claire") {
    await evaluate(`__idleTest.preview("yawn");`);
    await evaluate("__idleTest.capture(1300)");
    const id="a".repeat(32);
    await command({action:"say",id,text:"A quiet local speech check.",voice:null,
      expression:"neutral",intensity:.35,gain:4,mode:"face"});
    await wait(`document.getElementById("idle-preview").disabled`);
    assert.equal((await evaluate("__idleTest.capture(0)")).id,"");
    await wait(`!__idleTest.context || __idleTest.context.state==="suspended"`);
    const until=Date.now()+60000;
    let playing=false;
    while(Date.now()<until) {
      const value=await command({action:"status"});
      if(value.state==="failed")throw Error(value.error);
      if(value.state==="playing"){playing=true;break;}
      await pause(50);
    }
    assert(playing);
    const before = await evaluate(`({source:document.getElementById("audio").src,time:document.getElementById("audio").currentTime})`);
    await pause(180);
    const after = await evaluate(`({source:document.getElementById("audio").src,time:document.getElementById("audio").currentTime,id:document.getElementById("face").dataset.idleAction})`);
    assert.equal(after.source,before.source);assert(after.time>before.time);assert.equal(after.id,"");
    await command({action:"cancel",id});
    const cancelledUntil=Date.now()+10000;
    while((await command({action:"status"})).state!=="cancelled") {
      if(Date.now()>cancelledUntil)throw Error("Speech cancellation did not finish.");
      await pause(50);
    }
    await wait(`!document.getElementById("idle-preview").disabled`);
    const cancelledNeutral = await evaluate("__idleTest.capture(0)");
    assert.equal(await evaluate(`document.getElementById("frame").textContent`),"NEUTRAL");
    await evaluate(`__idleTest.preview("smile")`);
    assert.equal((await evaluate("__idleTest.capture(800)")).id,"smile");
    await evaluate(`document.getElementById("restart").click()`);
    assert.equal((await evaluate("__idleTest.capture(0)")).id,"");
    assert(await evaluate(`document.getElementById("idle-preview").disabled`));
    await evaluate(`document.getElementById("clear-speech").click()`);
    await wait(`!document.getElementById("idle-preview").disabled`);
    assert.equal((await evaluate("__idleTest.capture(0)")).hash,cancelledNeutral.hash,
      "Released agent output uses true neutral without deleting its retained clip.");
    const voiceId="b".repeat(32);
    await command({action:"say",id:voiceId,text:"A quiet local speech check.",voice:null,
      expression:"neutral",intensity:.35,gain:4,mode:"voice"});
    await wait(`!document.getElementById("voice-preview").paused`);
    assert(await evaluate(`document.getElementById("idle-preview").disabled`));
    await command({action:"cancel",id:voiceId});
    await wait(`!document.getElementById("idle-preview").disabled`);
    await evaluate(`document.getElementById("voice-preview").play()`);
    await wait(`document.getElementById("idle-preview").disabled`);
    await evaluate(`document.getElementById("voice-preview").pause()`);
    assert(await evaluate(`document.getElementById("idle-preview").disabled`));
    await evaluate(`document.getElementById("clear-speech").click()`);
    await wait(`!document.getElementById("idle-preview").disabled`);
    report.checks.push("Real face/voice agent playback preempts motion; audio time advances; cancellation restores true neutral, retaining clip; manual paused face/voice inspection blocks until cleared.");
  }
  await evaluate(`__idleTest.change("idle-life",false)`);
  await pause(100);
  const before = await evaluate(`({...__idleTest.stats})`);
  await pause(500);
  const after = await evaluate(`({...__idleTest.stats})`);
  assert.equal(after.frames,before.frames);
  assert(await evaluate(`document.getElementById("error").hidden`),
    await evaluate(`document.getElementById("error").textContent`));
  report.checks.push("Disabled idle life leaves no redraws or visible errors.");
}

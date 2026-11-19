// Bounded real-browser check using Node's built-in CDP/WebSocket support.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const [origin, capability, debuggingPort, output] = process.argv.slice(2);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pages = await (await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)).json();
const target = pages.find((item) => item.type === "page");
assert(target, "An owned browser page must exist.");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
let next = 0, generationRequest, embeddedImages = 0;
const pending = new Map(), exceptions = [], external = [], networkFailures = [];
const report = { audioAudition: "Playback tested muted; no listening/human acceptance claim.", checks: [] };
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const promise = pending.get(message.id);
    if (!promise) return;
    pending.delete(message.id);
    message.error ? promise.reject(new Error(message.error.message)) : promise.resolve(message.result);
  } else if (message.method === "Runtime.exceptionThrown") {
    exceptions.push(message.params.exceptionDetails.text);
  } else if (message.method === "Network.requestWillBeSent") {
    const { request, requestId } = message.params;
    if (request.url === `${origin}/api/generate`) generationRequest = requestId;
    if (request.url.startsWith("data:image/")) {
      embeddedImages++;
    } else if (!request.url.startsWith(origin + "/") && !request.url.startsWith(`blob:${origin}/`)) {
      external.push(request.url.split("#")[0]);
    }
  } else if (message.method === "Network.loadingFailed") {
    networkFailures.push({
      errorText: message.params.errorText, blockedReason: message.params.blockedReason,
    });
  }
});
function cdp(method, params = {}) {
  const id = ++next;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}
async function waitFor(expression, timeout = 60000) {
  const until = Date.now() + timeout;
  do {
    const value = await evaluate(expression);
    if (value) return value;
    await delay(50);
  } while (Date.now() < until);
  const state = await evaluate(`({status:document.getElementById("status")?.textContent,error:document.getElementById("error")?.textContent})`);
  throw new Error(`Browser condition timed out: ${expression}; ${JSON.stringify(state)}`);
}
async function screenshot(name) {
  const data = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await fs.writeFile(path.join(output, `${name}.png`), Buffer.from(data.data, "base64"));
}
async function click(id) {
  const point = await evaluate(`(() => {
    const element=document.getElementById(${JSON.stringify(id)});
    element.scrollIntoView({block:"nearest"});
    const rect=element.getBoundingClientRect();
    return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};
  })()`);
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
}
async function check(name, run) {
  await run();
  report.checks.push(name);
}
async function generate(text, expression = "neutral", voice = null) {
  await evaluate(`document.getElementById("text").value=${JSON.stringify(text)};
    document.getElementById("expression").value=${JSON.stringify(expression)};
    ${voice ? `document.getElementById("voice").value=${JSON.stringify(voice)};` : ""}`);
  await click("generate");
  await waitFor(`!document.getElementById("play").disabled || !document.getElementById("error").hidden`);
  const error = await evaluate(`document.getElementById("error").hidden ? null : document.getElementById("error").textContent`);
  assert.equal(error, null, error || "");
  const body = await cdp("Network.getResponseBody", { requestId: generationRequest });
  return JSON.parse(body.body);
}
try {
  await Promise.all([cdp("Page.enable"), cdp("Runtime.enable"), cdp("Network.enable")]);
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 980, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: `${origin}/#${capability}` });
  await waitFor(`document.getElementById("generate") && !document.getElementById("generate").disabled`);
  await check("Hazel is the explicit default when installed, otherwise substitution is disclosed", async () => {
    const data = await evaluate(`({voices:Array.from(document.getElementById("voice").options,o=>o.value),
      selected:document.getElementById("voice").value,notice:document.getElementById("voice-notice").textContent})`);
    const expected = data.voices.includes("Microsoft Hazel Desktop") ? "Microsoft Hazel Desktop" : data.voices[0];
    assert.equal(data.selected, expected);
    if (expected !== "Microsoft Hazel Desktop") assert.match(data.notice, /not installed/);
    report.defaultVoice = data.selected;
  });
  await check("Real WebGL2 neutral face, no GL errors and visible connected geometry", async () => {
    const result = await evaluate(`(() => {
      document.getElementById("yaw").dispatchEvent(new Event("input"));
      const canvas=document.getElementById("face"), gl=canvas.getContext("webgl2");
      const pixels=new Uint8Array(canvas.width*canvas.height*4);
      gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let colored=0, low=255, high=0;
      for(let i=0;i<pixels.length;i+=4) if(pixels[i+1]>45 && pixels[i+2]>45){
        colored++;low=Math.min(low,pixels[i+1]);high=Math.max(high,pixels[i+1]);}
      return {error:gl.getError(),colored,contrast:high-low,width:canvas.width,height:canvas.height,
        view:document.getElementById("appearance").value,edges:document.getElementById("edges").checked};
    })()`);
    assert.equal(result.error, 0);
    assert(result.colored > 1000, JSON.stringify(result));
    assert(result.contrast > 40, JSON.stringify(result));
    assert.equal(result.view,"polygon");
    assert.equal(result.edges,true);
    report.renderer = result;
    await screenshot("01-neutral");
  });
  await check("Head/neck framing removes submitted geometry below the throat and restores the exact full neutral view", async () => {
    const data = await evaluate(`(async () => {
      const $=id=>document.getElementById(id),c=$("face"),g=c.getContext("webgl2");
      const meta=(await (await fetch("/api/session",{headers:{"X-Verona-Token":location.hash.slice(1)}})).json()).mesh;
      const pixels=()=>{const p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);return p;};
      const draw=g.drawElements;let calls=[];
      g.drawElements=function(mode,count,...args){calls.push({mode,count});return draw.call(this,mode,count,...args);};
      const change=value=>{$("framing").value=value;$("framing").dispatchEvent(new Event("input"));};
      change("full");const before=pixels(),full=calls;calls=[];
      change("head-neck");const after=pixels(),cropped=calls;calls=[];
      const cutRow=c.height/2+(134-meta.center[1])/meta.scale*Number($("zoom").value)*.91*c.height/2;
      let removed=0,aboveChanged=0,aboveMaxChannelDelta=0,belowColored=0;const aboveExamples=[];
      for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
        const i=(y*c.width+x)*4;
        const changed=before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2];
        if(changed)removed++;
        if(y>cutRow+2 && changed){
          aboveChanged++;
          aboveMaxChannelDelta=Math.max(aboveMaxChannelDelta,...[0,1,2].map(channel=>Math.abs(before[i+channel]-after[i+channel])));
          if(aboveExamples.length<8)aboveExamples.push({x,y,before:Array.from(before.slice(i,i+4)),after:Array.from(after.slice(i,i+4))});
        }
        if(y<cutRow-2 && (after[i]!==4||after[i+1]!==6||after[i+2]!==10))belowColored++;
      }
      change("full");const restored=pixels();let roundTrip=0;
      for(let i=0;i<before.length;i++)if(before[i]!==restored[i])roundTrip++;
      g.drawElements=draw;
      change("head-neck");
      return {removed,aboveChanged,aboveMaxChannelDelta,aboveExamples,belowColored,roundTrip,full,cropped,cutRow,error:g.getError(),
        description:$("geometry-details").textContent};
    })()`);
    report.framing=data;
    assert.equal(data.error,0);
    assert(data.removed>1000,JSON.stringify(data));
    assert(data.aboveChanged<=8 && data.aboveMaxChannelDelta<=2,JSON.stringify(data));
    assert.equal(data.belowColored,0);
    assert.equal(data.roundTrip,0);
    const count=(calls,mode)=>calls.filter(c=>c.mode===mode).reduce((sum,c)=>sum+c.count,0);
    assert(count(data.cropped,4)<count(data.full,4));
    assert(count(data.cropped,1)<count(data.full,1));
    assert(data.cropped[0].count<data.full[0].count);
    assert(data.cropped.at(-2).count<data.full.at(-2).count);
    await screenshot("01d-head-neck");
    const points=await evaluate(`(() => {
      const $=id=>document.getElementById(id),g=$("face").getContext("webgl2"),draw=g.drawElements;
      let count=0;g.drawElements=function(mode,n,...args){if(mode===g.POINTS)count=n;return draw.call(this,mode,n,...args);};
      $("points").checked=true;$("points").dispatchEvent(new Event("input"));
      g.drawElements=draw;$("points").checked=false;
      $("framing").value="full";$("framing").dispatchEvent(new Event("input"));return count;
    })()`);
    assert(points>0 && points<15375,points);
    report.framing.indexedPoints=points;
  });
  await check("Original procedural hair toggles independently and the female native head turns", async () => {
    const hairPixels = await evaluate(`(() => {
      const pixels=()=>{const c=document.getElementById("face"),g=c.getContext("webgl2");
        const p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);
        return p;};
      document.getElementById("hair").dispatchEvent(new Event("input"));const on=pixels();
      document.getElementById("hair").checked=false;
      document.getElementById("hair").dispatchEvent(new Event("input"));const off=pixels();let changed=0;
      for(let i=0;i<on.length;i+=4)if(Math.abs(on[i]-off[i])+Math.abs(on[i+1]-off[i+1])+Math.abs(on[i+2]-off[i+2])>15)changed++;
      return {changed};
    })()`);
    assert(hairPixels.changed > 500, JSON.stringify(hairPixels));
    await screenshot("01b-skin-only");
    await evaluate(`document.getElementById("hair").checked=true;document.getElementById("yaw").value=".55";
      document.getElementById("yaw").dispatchEvent(new Event("input"));`);
    await screenshot("01c-turned-hair");
    await evaluate(`document.getElementById("yaw").value="0";document.getElementById("yaw").dispatchEvent(new Event("input"));`);
    report.hairPixels = hairPixels;
  });
  const greeting = await generate("Hey, how are you?");
  report.greeting = greeting;
  report.firstClientReadySeconds = await evaluate(`Number(document.getElementById("details").dataset.readySeconds)`);
  await check("Framing during playback preserves speech and excludes hidden animated normals", async () => {
    const source=await evaluate(`document.getElementById("audio").src`);
    await evaluate(`document.getElementById("audio").muted=true;document.getElementById("audio").play();`);
    await waitFor(`document.getElementById("audio").currentTime>.15`);
    const data=await evaluate(`(() => {
      const $=id=>document.getElementById(id),g=$("face").getContext("webgl2");
      const update=g.bufferSubData;let normals=0;
      g.bufferSubData=function(target,offset,values,...args){
        if(values instanceof Float32Array){for(let i=0;i<values.length;i+=3)
          if(Math.hypot(values[i],values[i+1],values[i+2])>.5)normals++;}
        return update.call(this,target,offset,values,...args);};
      const before=$("audio").currentTime;
      $("framing").value="head-neck";$("framing").dispatchEvent(new Event("input"));
      g.bufferSubData=update;
      return {before,after:$("audio").currentTime,paused:$("audio").paused,
        source:$("audio").src,normalVerticesPerFrame:normals/2,error:g.getError()};
    })()`);
    assert.equal(data.source,source);
    assert.equal(data.paused,false);
    assert(data.after>=data.before);
    assert(data.normalVerticesPerFrame>1000 && data.normalVerticesPerFrame<15375,JSON.stringify(data));
    assert.equal(data.error,0);
    await waitFor(`document.getElementById("audio").currentTime>${data.before+.15}`);
    await evaluate(`document.getElementById("audio").pause();
      document.getElementById("framing").value="full";
      document.getElementById("framing").dispatchEvent(new Event("input"));`);
    report.animatedFraming=data;
  });
  await check("Full XYZ orientation and procedural cursor gaze change rendered pixels without replacing speech", async () => {
    const before = await evaluate(`document.getElementById("audio").src`);
    await evaluate(`window.gazePixels=()=>{
      document.getElementById("yaw").dispatchEvent(new Event("input"));
      const c=document.getElementById("face"),g=c.getContext("webgl2"),p=new Uint8Array(c.width*c.height*4);
      g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);return p;};
      window.neutralEyes=window.gazePixels();
      document.getElementById("follow-eyes").checked=true;
      window.dispatchEvent(new MouseEvent("mousemove",{clientX:innerWidth,clientY:0}));`);
    await delay(1100);
    const gaze = await evaluate(`(() => {const p=window.gazePixels();let changed=0;
      for(let i=0;i<p.length;i+=4) if(Math.abs(p[i]-window.neutralEyes[i])
        +Math.abs(p[i+1]-window.neutralEyes[i+1])+Math.abs(p[i+2]-window.neutralEyes[i+2])>15)changed++;
      return {changed,gaze:document.getElementById("face").dataset.gaze.split(",").map(Number)};})()`);
    assert(gaze.changed > 30,JSON.stringify(gaze));
    assert(gaze.gaze[0] > 0 && gaze.gaze[1] > 0);
    for (const id of ["tilt","yaw","roll"]) {
      await evaluate(`document.getElementById("${id}").value="3.141593";
        document.getElementById("${id}").dispatchEvent(new Event("input"));`);
      assert.equal(await evaluate(`document.getElementById("face").getContext("webgl2").getError()`),0);
    }
    await evaluate(`document.getElementById("follow-eyes").checked=false;
      document.getElementById("follow-eyes").dispatchEvent(new Event("input"));
      document.getElementById("reset-view").click();delete window.neutralEyes;delete window.gazePixels;`);
    await delay(1100);
    assert.equal(await evaluate(`document.getElementById("audio").src`),before);
    report.cursorGaze=gaze;
  });
  await check("Actual text synthesis, complete motion and browser WAV decode", async () => {
    const data = await evaluate(`({duration:document.getElementById("audio").duration,
      source:document.getElementById("audio").currentSrc.startsWith("blob:"),
      ready:document.getElementById("audio").readyState,quote:document.getElementById("spoken").textContent})`);
    assert(Math.abs(data.duration - greeting.duration) < .01);
    assert.equal(data.source, true);
    assert(data.ready >= 1);
    assert.equal(data.quote, "Hey, how are you?");
    assert(greeting.maximumSkinChangeCm > .01);
    assert.equal(greeting.frames, Math.ceil(greeting.duration * 30));
    assert.equal(greeting.identity, "Claire v2.3.1");
  });
  await check("Exact latest request reuses the identical complete clip without neural regeneration", async () => {
    const repeat = await generate("Hey, how are you?");
    assert.equal(repeat.cacheHit, true);
    assert.equal(repeat.id, greeting.id);
    assert.equal(repeat.motionSha256, greeting.motionSha256);
    assert.equal(repeat.audioPcmSha256, greeting.audioPcmSha256);
    report.repeatedRequestSeconds = repeat.requestSeconds;
    report.repeatedClientReadySeconds = await evaluate(`Number(document.getElementById("details").dataset.readySeconds)`);
  });
  await check("Real muted audio-clock advance and pause/resume", async () => {
    await evaluate(`document.getElementById("audio").muted=true;`);
    await click("play");
    await waitFor(`document.getElementById("audio").currentTime>.50`, 5000);
    await screenshot("02-speaking");
    await click("play");
    const data = await evaluate(`({time:document.getElementById("audio").currentTime,frame:document.getElementById("frame").textContent})`);
    await delay(200);
    const paused = await evaluate(`({time:document.getElementById("audio").currentTime,paused:document.getElementById("audio").paused})`);
    assert.equal(paused.paused, true);
    assert(Math.abs(data.time - paused.time) < .025);
    assert.notEqual(data.frame, `FRAME 1 / ${greeting.frames}`);
    await click("play");
    await waitFor(`document.getElementById("audio").currentTime>${paused.time + .12}`);
    await click("play");
  });
  await check("Shaded native contours, static cosmetic eyes and diagnostic point/edge toggles", async () => {
    const data = await evaluate(`(async()=>{
      const session=await (await fetch("/api/session",{headers:{"X-Verona-Token":location.hash.slice(1)}})).json();
      const canvas=document.getElementById("face"), gl=canvas.getContext("webgl2");
      const pixels=()=>{const p=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
      const before=pixels();
      for(const id of ["points","edges"]){const e=document.getElementById(id);e.checked=!e.checked;e.dispatchEvent(new Event("input"));}
      const after=pixels();let changed=0;
      for(let i=0;i<before.length;i+=4)if(Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2])>10)changed++;
      for(const id of ["points","edges"]){const e=document.getElementById(id);e.checked=!e.checked;e.dispatchEvent(new Event("input"));}
      return {changed,error:gl.getError(),mesh:session.mesh};
    })()`);
    assert.equal(data.error,0);
    assert(data.changed>1000);
    assert.equal(data.mesh.vertices,15375);
    assert.equal(data.mesh.edges,30759);
    assert.equal(data.mesh.triangles,30746);
    assert.match(data.mesh.eyes.animation,/static/);
    report.presentation = data;
  });
  await check("Polygon and shaded views switch visibly without replacing or seeking the prepared clip", async () => {
    const data=await evaluate(`(()=>{
      const canvas=document.getElementById("face"),gl=canvas.getContext("webgl2"),audio=document.getElementById("audio");
      const state=()=>({source:audio.currentSrc,time:audio.currentTime,frame:document.getElementById("frame").textContent,
        voice:document.getElementById("voice").value,hair:document.getElementById("hair").checked});
      const pixels=()=>{const p=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
      document.getElementById("appearance").dispatchEvent(new Event("input"));
      const before=state(),polygon=pixels(),view=document.getElementById("appearance");
      view.value="shaded";view.dispatchEvent(new Event("input"));const shaded=pixels(),middle=state();
      view.value="polygon";view.dispatchEvent(new Event("input"));const restored=pixels(),after=state();
      let changed=0,roundTrip=0;
      for(let i=0;i<polygon.length;i+=4){
        if(Math.abs(polygon[i]-shaded[i])+Math.abs(polygon[i+1]-shaded[i+1])+Math.abs(polygon[i+2]-shaded[i+2])>15)changed++;
        if(polygon[i]!==restored[i]||polygon[i+1]!==restored[i+1]||polygon[i+2]!==restored[i+2])roundTrip++;
      }return {before,middle,after,changed,roundTrip,error:gl.getError()};
    })()`);
    assert(data.changed>2000,JSON.stringify(data));
    assert.equal(data.roundTrip,0);
    assert.equal(data.error,0);
    assert.deepEqual(data.middle,data.before);
    assert.deepEqual(data.after,data.before);
    report.viewSwitch=data;
    await screenshot("02b-restored-polygons");
  });
  await check("Reference color renders green outer irises and rosewood lips on the actual 3D surfaces", async () => {
    const data=await evaluate(`(async ()=>{
      const $=id=>document.getElementById(id),c=$("face"),g=c.getContext("webgl2");
      const meta=(await (await fetch("/api/session",{headers:{"X-Verona-Token":location.hash.slice(1)}})).json()).mesh;
      const saved={yaw:$("yaw").value,tilt:$("tilt").value,roll:$("roll").value,
        view:$("appearance").value,edges:$("edges").checked};
      for(const id of ["yaw","tilt","roll"])$(id).value="0";
      $("appearance").value="shaded";$("edges").checked=false;
      $("appearance").dispatchEvent(new Event("input"));
      const p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);
      const factor=Number($("zoom").value)*.91*c.height/(2*meta.scale);
      const point=(x,y)=>[c.width/2+(x-meta.center[0])*factor,c.height/2+(y-meta.center[1])*factor];
      let green=0,rose=0;
      for(const [x,y] of [point(-2.9485,147.6317),point(3.1021,147.5744)]){
        const radius=Math.ceil(.62*factor);
        for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
          if(dx*dx+dy*dy>radius*radius)continue;
          const i=(Math.round(y+dy)*c.width+Math.round(x+dx))*4;
          if(p[i+1]>p[i]*1.1 && p[i+1]>p[i+2]*1.05)green++;
        }
      }
      const [x,y]=point(.08,140.15);
      for(let dy=-Math.ceil(factor);dy<=factor;dy++)for(let dx=-Math.ceil(2.7*factor);dx<=2.7*factor;dx++){
        const i=(Math.round(y+dy)*c.width+Math.round(x+dx))*4;
        if(p[i]>p[i+1]*1.4 && p[i]>p[i+2]*1.1)rose++;
      }
      $("yaw").value=saved.yaw;$("tilt").value=saved.tilt;$("roll").value=saved.roll;
      return {green,rose,error:g.getError(),saved};
    })()`);
    assert.equal(data.error,0);
    assert(data.green>20,JSON.stringify(data));
    assert(data.rose>20,JSON.stringify(data));
    report.referenceColor={greenIrisPixels:data.green,roseLipPixels:data.rose};
    await evaluate(`document.getElementById("appearance").dispatchEvent(new Event("input"));`);
    await screenshot("02c-reference-color");
    await evaluate(`document.getElementById("appearance").value=${JSON.stringify(data.saved.view)};
      document.getElementById("edges").checked=${data.saved.edges};
      document.getElementById("appearance").dispatchEvent(new Event("input"));`);
  });
  await check("Polygon, shaded and shaded-edge playback meet the local 60-fps target at 1x and 2x density", async () => {
    await evaluate(`document.getElementById("audio").loop=true;document.getElementById("audio").currentTime=0;`);
    await click("play");
    await evaluate(`(()=>{
      const gl=document.getElementById("face").getContext("webgl2"),original=gl.clear;
      const allocate=gl.bufferData,update=gl.bufferSubData;
      window.renderProbe={frames:0,allocations:0,updates:0,restore:()=>{
        gl.clear=original;gl.bufferData=allocate;gl.bufferSubData=update;}};
      gl.clear=function(...args){window.renderProbe.frames++;return original.apply(this,args);};
      gl.bufferData=function(...args){window.renderProbe.allocations++;return allocate.apply(this,args);};
      gl.bufferSubData=function(...args){window.renderProbe.updates++;return update.apply(this,args);};
    })()`);
    report.renderCadence = [];
    for (const {density,edges,view,framing} of [
      {density:1,edges:true,view:"polygon"},{density:2,edges:true,view:"polygon"},
      {density:1,edges:false,view:"shaded"},{density:2,edges:false,view:"shaded"},
      {density:1,edges:true,view:"shaded"},{density:2,edges:true,view:"shaded"},
    ].flatMap(mode=>["full","head-neck"].map(framing=>({...mode,framing})))) {
      await evaluate(`document.getElementById("framing").value=${JSON.stringify(framing)};
        document.getElementById("framing").dispatchEvent(new Event("input"));
        document.getElementById("appearance").value=${JSON.stringify(view)};
        document.getElementById("edges").checked=${edges};document.getElementById("edges").dispatchEvent(new Event("input"));`);
      await cdp("Emulation.setDeviceMetricsOverride", { width:1280,height:980,deviceScaleFactor:density,mobile:false });
      await delay(150);
    const timing = await evaluate(`new Promise(resolve=>{
      const intervals=[];let previous=0,start=0;
      const firstDraw=window.renderProbe.frames,firstUpdates=window.renderProbe.updates;
      function sample(now){
        if(!start)start=now;
        if(previous && now-start>300)intervals.push(now-previous);
        previous=now;
        if(now-start<6300)requestAnimationFrame(sample);
        else {
          const sorted=intervals.slice().sort((a,b)=>a-b);
          resolve({samples:sorted.length,meanMs:intervals.reduce((a,b)=>a+b,0)/intervals.length,
            p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),
            over25Ms:sorted.filter(t=>t>25).length,viewport:[innerWidth,innerHeight],
            canvas:[document.getElementById("face").width,document.getElementById("face").height],
            cssCanvas:[document.getElementById("face").clientWidth,document.getElementById("face").clientHeight],
            submittedDraws:window.renderProbe.frames-firstDraw,
            normalBufferAllocations:window.renderProbe.allocations,
            normalBufferUpdates:window.renderProbe.updates-firstUpdates,
            playing:!document.getElementById("audio").paused});
        }
      }requestAnimationFrame(sample);
    })`);
    report.renderCadence.push({...timing,density,edges,view,framing});
    }
    for (const timing of report.renderCadence) {
    assert.equal(timing.playing,true);
    assert.equal(timing.normalBufferAllocations,0);
    assert(timing.normalBufferUpdates>100);
    assert(timing.samples>300,JSON.stringify(timing));
    assert(timing.submittedDraws>=timing.samples,JSON.stringify(timing));
    if(timing.view==="shaded"){
      assert(timing.canvas.every((size,i)=>size<=Math.round(timing.cssCanvas[i]*1.5)),JSON.stringify(timing));
    }
    assert(timing.meanMs<17.55 && timing.p95Ms<20,JSON.stringify(timing));
    }
    await click("play");
    await evaluate(`document.getElementById("audio").loop=false;window.renderProbe.restore();delete window.renderProbe;
      document.getElementById("framing").value="full";
      document.getElementById("framing").dispatchEvent(new Event("input"));
      document.getElementById("appearance").value="polygon";
      document.getElementById("edges").checked=true;document.getElementById("edges").dispatchEvent(new Event("input"));`);
    await cdp("Emulation.setDeviceMetricsOverride", { width:1280,height:980,deviceScaleFactor:1,mobile:false });
  });
  await check("Seek selects the corresponding original-time neural frame", async () => {
    await evaluate(`document.getElementById("seek").value="1.25";document.getElementById("seek").dispatchEvent(new Event("input"));`);
    await waitFor(`Math.abs(document.getElementById("audio").currentTime-1.25)<.01`);
    const frame = await evaluate(`document.getElementById("frame").textContent`);
    assert.equal(frame, `FRAME 38 / ${greeting.frames}`);
    await screenshot("03-seek");
  });
  await check("Restart, replay and natural end clamp to the final frame", async () => {
    await click("restart");
    const restart = await evaluate(`({time:document.getElementById("audio").currentTime,
      paused:document.getElementById("audio").paused,frame:document.getElementById("frame").textContent})`);
    assert.equal(restart.time, 0);
    assert.equal(restart.paused, true);
    assert.equal(restart.frame, `FRAME 1 / ${greeting.frames}`);
    await evaluate(`document.getElementById("seek").value=String(document.getElementById("audio").duration-.07);
      document.getElementById("seek").dispatchEvent(new Event("input"));`);
    await click("play");
    await waitFor(`document.getElementById("audio").ended`);
    assert.equal(await evaluate(`document.getElementById("frame").textContent`), `FRAME ${greeting.frames} / ${greeting.frames}`);
  });
  await check("Second generated clip uses explicit neural expression and replaces prior state", async () => {
    const happy = await generate("Hey, how are you?", "happy");
    report.happy = happy;
    assert.notEqual(happy.id, greeting.id);
    assert.notEqual(happy.motionSha256, greeting.motionSha256);
    assert.equal(happy.expression, "happy");
    assert.equal(happy.speechCacheHit, true);
    assert.equal(happy.audioPcmSha256, greeting.audioPcmSha256);
    await evaluate(`document.getElementById("seek").value=".9";document.getElementById("seek").dispatchEvent(new Event("input"));`);
    await screenshot("04-happy");
  });
  await check("Voice preview skips motion, edited voice drives generation and reset restores Hazel defaults", async () => {
    await evaluate(`document.querySelector(".voice-options").open=true;
      for(const [id,value] of Object.entries({pitch:4,rate:2,bass:3,treble:-2})){
        document.getElementById(id).value=value;document.getElementById(id).dispatchEvent(new Event("input"));}
      document.getElementById("emphasis").value="strong";document.getElementById("voice-preview").muted=true;`);
    await click("preview");
    await waitFor(`!document.getElementById("preview").disabled`);
    assert.equal(await evaluate(`document.getElementById("error").hidden`), true);
    await waitFor(`document.getElementById("voice-preview").readyState>=1`);
    assert.equal(await evaluate(`document.getElementById("voice-preview").paused`), true);
    assert.equal(await evaluate(`document.getElementById("play").disabled`), false);
    const shaped = await generate("Hey, how are you?");
    assert.deepEqual(shaped.voiceSettings, {pitch:4,rate:2,emphasis:"strong",bass:3,treble:-2});
    assert.equal(shaped.speechCacheHit, true);
    assert.notEqual(shaped.audioPcmSha256, greeting.audioPcmSha256);
    report.shapedVoice = shaped;
    await screenshot("04b-voice-controls");
    await click("reset-voice");
    const reset = await evaluate(`({voice:document.getElementById("voice").value,
      values:["pitch","rate","bass","treble"].map(id=>document.getElementById(id).value),
      emphasis:document.getElementById("emphasis").value,previewHidden:document.getElementById("voice-preview").hidden,
      generatedDetails:document.getElementById("details").textContent})`);
    assert.equal(reset.voice, report.defaultVoice);
    assert.deepEqual(reset.values, ["0","0","0","0"]);
    assert.equal(reset.emphasis, "none");
    assert.equal(reset.previewHidden, true);
    assert.match(reset.generatedDetails, /pitch 4 st, speed 2/);
    await evaluate(`document.querySelector(".voice-options").open=false;`);
  });
  await check("Available alternate English voices, P/B/M and vowels generate complete clips", async () => {
    const voices = await evaluate(`Array.from(document.getElementById("voice").options, option=>option.value)`);
    const alternatives = voices.filter(voice => voice !== report.defaultVoice);
    const pbm = await generate("Mom, Bob packed my blue paper bag.", "sad", alternatives[0] || voices[0]);
    const vowels = await generate("We see a blue moon. Oh, wow!", "surprised", alternatives[1] || alternatives[0] || voices[0]);
    assert.equal(pbm.expression, "sad");
    assert.equal(vowels.expression, "surprised");
    assert(pbm.maximumSkinChangeCm > .01 && vowels.maximumSkinChangeCm > .01);
    report.pbm = pbm;
    report.vowels = vowels;
  });
  await check("Overlong synthesized speech fails explicitly without silent truncation", async () => {
    await evaluate(`document.getElementById("text").value="1234567890 ".repeat(24);`);
    await click("generate");
    await waitFor(`!document.getElementById("generate").disabled`);
    assert.match(await evaluate(`document.getElementById("error").textContent`), /25 seconds/);
    assert.equal(await evaluate(`document.getElementById("play").disabled`), true);
  });
  await check("Controlled generation network failure is explicit and retryable", async () => {
    await cdp("Network.setBlockedURLs", { urls: [`${origin}/api/generate`] });
    await click("generate");
    await waitFor(`!document.getElementById("generate").disabled`);
    assert.match(await evaluate(`document.getElementById("error").textContent`), /Cannot reach local Verona/);
    assert.equal(await evaluate(`document.getElementById("play").disabled`), true);
    await cdp("Network.setBlockedURLs", { urls: [] });
    const recovery = await generate("Five very vivid flowers wave in the wind.");
    report.recovery = recovery;
    assert(recovery.frames > greeting.frames);
    await evaluate(`document.getElementById("seek").value="1.2";document.getElementById("seek").dispatchEvent(new Event("input"));`);
    await screenshot("05-recovered-fv");
  });
  await check("Empty input rejected without losing the usable clip", async () => {
    await evaluate(`document.getElementById("text").value=" ";document.getElementById("generate").click();`);
    assert.match(await evaluate(`document.getElementById("error").textContent`), /1-280/);
    assert.equal(await evaluate(`document.getElementById("play").disabled`), false);
  });
  await check("Narrow layout has no horizontal page overflow", async () => {
    await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await delay(100);
    const bounds = await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth})`);
    assert(bounds.scroll <= bounds.width + 1, JSON.stringify(bounds));
    await screenshot("06-mobile");
  });
  await check("Reload clears media and preserves only the capability URL", async () => {
    await evaluate(`document.getElementById("appearance").value="shaded";document.getElementById("edges").checked=false;
      document.getElementById("framing").value="head-neck";
      document.getElementById("framing").dispatchEvent(new Event("input"));
      document.getElementById("appearance").dispatchEvent(new Event("input"));`);
    await cdp("Page.reload");
    await waitFor(`document.getElementById("generate") && !document.getElementById("generate").disabled`);
    assert.equal(await evaluate(`document.getElementById("play").disabled`), true);
    assert.equal(await evaluate(`document.getElementById("frame").textContent`), "NEUTRAL");
    assert.equal(await evaluate(`document.getElementById("appearance").value`), "polygon");
    assert.equal(await evaluate(`document.getElementById("edges").checked`), true);
    assert.equal(await evaluate(`document.getElementById("framing").value`), "full");
  });
  assert.deepEqual(exceptions, []);
  assert.deepEqual(external, []);
  assert(networkFailures.length === 1 && networkFailures[0].blockedReason === "inspector", JSON.stringify(networkFailures));
  report.pageExceptions = exceptions;
  report.externalPageRequests = external;
  report.embeddedBrowserImages = embeddedImages;
  report.expectedInjectedNetworkFailures = networkFailures.length;
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack;
  try { await screenshot("failure"); } catch (captureError) { report.captureError = captureError.message; }
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(output, "browser-report.json"), JSON.stringify(report, null, 2) + "\n");
  try { await cdp("Browser.close"); } catch (error) { report.closeError = error.message; }
  ws.close();
}
console.log(JSON.stringify({ status: report.status, checks: report.checks, error: report.error }));

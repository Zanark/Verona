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
      const {jawCutHeight}=await import("/framing.mjs");
      const pixels=()=>{const p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);return p;};
      const draw=g.drawElements;let calls=[];
      g.drawElements=function(mode,count,...args){calls.push({mode,count});return draw.call(this,mode,count,...args);};
      const change=value=>{$("framing").value=value;$("framing").dispatchEvent(new Event("input"));};
      change("full");const before=pixels(),full=calls;calls=[];
      change("head-neck");const after=pixels(),cropped=calls;calls=[];
      const projected=Number($("zoom").value)*.91*c.height/2/meta.scale;
      const cutRow=c.height/2+(149-meta.center[1])*projected;
      let removed=0,aboveChanged=0,aboveMaxChannelDelta=0,belowColored=0;const aboveExamples=[],belowExamples=[];
      for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
        const i=(y*c.width+x)*4;
        const changed=before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2];
        if(changed)removed++;
        if(y>cutRow+2 && changed){
          aboveChanged++;
          aboveMaxChannelDelta=Math.max(aboveMaxChannelDelta,...[0,1,2].map(channel=>Math.abs(before[i+channel]-after[i+channel])));
          if(aboveExamples.length<8)aboveExamples.push({x,y,before:Array.from(before.slice(i,i+4)),after:Array.from(after.slice(i,i+4))});
        }
        const worldX=(x+.5-c.width/2)/projected+meta.center[0];
        const minimum=c.height/2+(jawCutHeight(worldX,0,1.7)-meta.center[1])*projected;
        if(y<minimum-2 && (after[i]!==4||after[i+1]!==6||after[i+2]!==10)){
          belowColored++;if(belowExamples.length<8)belowExamples.push({x,y,minimum,worldX,color:Array.from(after.slice(i,i+4))});
        }
      }
      change("full");const restored=pixels();let roundTrip=0;
      for(let i=0;i<before.length;i++)if(before[i]!==restored[i])roundTrip++;
      g.drawElements=draw;
      change("head-neck");
      return {removed,aboveChanged,aboveMaxChannelDelta,aboveExamples,belowColored,belowExamples,roundTrip,full,cropped,cutRow,error:g.getError(),
        description:$("geometry-details").textContent};
    })()`);
    report.framing=data;
    assert.equal(data.error,0);
    assert(data.removed>1000,JSON.stringify(data));
    assert(data.aboveChanged<=8 && data.aboveMaxChannelDelta<=2,JSON.stringify(data));
    assert.equal(data.belowColored,0,JSON.stringify(data));
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
    await evaluate(`document.getElementById("hair").checked=true;
      document.getElementById("hair").dispatchEvent(new Event("input"));document.getElementById("yaw").value=".55";
      document.getElementById("yaw").dispatchEvent(new Event("input"));`);
    await screenshot("01c-turned-hair");
    await evaluate(`document.getElementById("yaw").value="0";document.getElementById("yaw").dispatchEvent(new Event("input"));`);
    report.hairPixels = hairPixels;
  });
  const greeting = await generate("Hey, how are you?");
  report.greeting = greeting;
  await check("Live jawline depth changes real geometry without changing speech, leaking buffers or resetting per-view choices",async()=>{
    report.jawDepth=await evaluate(`(() => {
      const $=id=>document.getElementById(id),g=$("face").getContext("webgl2"),c=$("face"),a=$("audio");
      const source=a.src,time=a.currentTime,create=g.createBuffer,remove=g.deleteBuffer;let created=0,deleted=0;
      $("framing").value="head-neck";$("framing").dispatchEvent(new Event("input"));
      g.createBuffer=function(){created++;return create.call(this);};g.deleteBuffer=function(b){deleted++;return remove.call(this,b);};
      const levels=[];
      for(const depth of [0,3,6]){
        const start=performance.now();$("neck-depth").value=String(depth);$("neck-depth").dispatchEvent(new Event("input"));
        const buildAndDrawMs=performance.now()-start,p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);
        let visible=0;for(let i=0;i<p.length;i+=4)if(p[i]!==4||p[i+1]!==6||p[i+2]!==10)visible++;
        levels.push({depth,visible,buildAndDrawMs,description:$("geometry-details").textContent,error:g.getError()});
      }
      g.createBuffer=create;g.deleteBuffer=remove;
      $("presentation").value="facedot";$("presentation").dispatchEvent(new Event("input"));
      const dotDefault=$("neck-depth").value;$("neck-depth").value="3";$("neck-depth").dispatchEvent(new Event("input"));
      $("presentation").value="claire";$("presentation").dispatchEvent(new Event("input"));const restored=$("neck-depth").value;
      const sameSource=a.src===source,sameTime=a.currentTime===time;
      $("neck-depth").value="1.7";$("neck-depth").dispatchEvent(new Event("input"));
      $("presentation").value="facedot";$("presentation").dispatchEvent(new Event("input"));
      const dotRestored=$("neck-depth").value;$("neck-depth").value="1.7";$("neck-depth").dispatchEvent(new Event("input"));
      $("presentation").value="claire";$("presentation").dispatchEvent(new Event("input"));
      $("framing").value="full";$("framing").dispatchEvent(new Event("input"));
      return {levels,created,deleted,dotDefault,restored,dotRestored,sameSource,sameTime,hidden:$("neck-depth-control").hidden};
    })()`);
    const r=report.jawDepth;
    assert(r.levels.every(x=>x.error===0));
    assert(r.levels[0].visible<r.levels[1].visible && r.levels[1].visible<r.levels[2].visible,JSON.stringify(r));
    assert.equal(r.created,15);assert.equal(r.deleted,15);
    assert.equal(r.dotDefault,"1.7");assert.equal(r.restored,"6");assert.equal(r.dotRestored,"3");
    assert(r.sameSource && r.sameTime && r.hidden);
  });
  await check("Only original waves and doubled spiral curls render, crop and restore without retained GPU growth", async () => {
    const data=await evaluate(`(() => {
      const $=id=>document.getElementById(id),c=$("face"),g=c.getContext("webgl2"),a=$("audio");
      const change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new Event("input"));};
      const saved={appearance:$("appearance").value,edges:$("edges").checked};
      change("framing","full");$("edges").checked=false;change("appearance","shaded");
      const pixels=()=>{const p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);return p;};
      const baseline=pixels(),source=a.src,time=a.currentTime,create=g.createBuffer,remove=g.deleteBuffer,live=new Set();
      let created=0,deleted=0,peak=0;
      g.createBuffer=function(){const b=create.call(this);live.add(b);created++;peak=Math.max(peak,live.size);return b;};
      g.deleteBuffer=function(b){live.delete(b);deleted++;return remove.call(this,b);};
      const styles=Array.from($("hairstyle").options,o=>({id:o.value,name:o.textContent})),results=[],images=[];
      for(const yaw of [0,.8]){
        const gallery=document.createElement("canvas");gallery.width=600;gallery.height=300;const ctx=gallery.getContext("2d");
        ctx.fillStyle="#101821";ctx.fillRect(0,0,600,300);
        for(let i=0;i<styles.length;i++){
          const style=styles[i];change("hairstyle",style.id);change("yaw",String(yaw));
          const p=pixels();let hash=2166136261;for(let j=0;j<p.length;j++)hash=Math.imul(hash^p[j],16777619)>>>0;
          ctx.drawImage(c,i%4*300,Math.floor(i/4)*300,300,270);
          ctx.fillStyle="white";ctx.font="15px sans-serif";ctx.fillText(style.name,i%4*300+8,Math.floor(i/4)*300+290);
          change("framing","head-neck");change("neck-depth","0");change("neck-depth","6");
          results.push({id:style.id,yaw,pixelHash:hash,error:g.getError()});change("neck-depth","1.7");change("framing","full");
        }
        images.push(gallery.toDataURL("image/png"));
      }
      change("hairstyle","claire");change("yaw","0");const restored=pixels();let difference=0;
      for(let i=0;i<baseline.length;i++)if(baseline[i]!==restored[i])difference++;
      g.createBuffer=create;g.deleteBuffer=remove;
      const remaining=live.size;
      change("hairstyle","curls");change("presentation","facedot");
      const hidden=$("hairstyle").closest("label").hidden,disabled=$("hairstyle").disabled;change("presentation","claire");
      const retained=$("hairstyle").value;change("hairstyle","claire");
      $("edges").checked=saved.edges;change("appearance",saved.appearance);
      return {styles,results,created,deleted,peak,remaining,difference,hidden,disabled,retained,sameSource:a.src===source,sameTime:a.currentTime===time,images};
    })()`);
    const {images,...receipt}=data;report.hairstyles=receipt;
    for(let i=0;i<images.length;i++)await fs.writeFile(path.join(output,`hairstyles-${i?"turned":"front"}.png`),Buffer.from(images[i].split(",")[1],"base64"));
    assert.deepEqual(data.styles.map(s=>s.id),["claire","curls"]);assert(data.results.every(r=>r.error===0));
    for(const yaw of [0,.8])assert.equal(new Set(data.results.filter(r=>r.yaw===yaw).map(r=>r.pixelHash)).size,2);
    assert.equal(data.remaining,0);assert(data.peak<=14,JSON.stringify(receipt));assert.equal(data.difference,0);
    assert(!data.hidden && data.disabled && data.retained==="curls" && data.sameSource && data.sameTime);
  });
  await check("Presentation views preserve Claire, occlude dots, bound detail buffers and keep the same clip", async () => {
    await evaluate(`(() => {
      const $=id=>document.getElementById(id),c=$("face"),g=c.getContext("webgl2");
      window.presentationBaseline={pixels:new Uint8Array(c.width*c.height*4),source:$("audio").src,time:$("audio").currentTime};
      $("yaw").dispatchEvent(new Event("input"));
      g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,window.presentationBaseline.pixels);
    })()`);
    report.presentations = [];
    for (const id of ["facemesh","facedot","uniform"]) {
      const data = await evaluate(`(() => {
        const $=id=>document.getElementById(id),c=$("face"),g=c.getContext("webgl2");
        const draw=g.drawElements,arrays=g.drawArrays,mask=g.colorMask;let colored=true;const calls=[];
        g.colorMask=function(...args){colored=args.some(Boolean);return mask.apply(this,args);};
        g.drawElements=function(mode,count,...args){
          const program=g.getParameter(g.CURRENT_PROGRAM);
          calls.push({mode,count,colored,material:g.getUniform(program,g.getUniformLocation(program,"material")),
            pass:g.getUniform(program,g.getUniformLocation(program,"pass"))});
          return draw.call(this,mode,count,...args);
        };
        g.drawArrays=function(mode,first,count){calls.push({mode,count,colored});return arrays.call(this,mode,first,count);};
        $("presentation").value=${JSON.stringify(id)};$("presentation").dispatchEvent(new Event("input"));
        g.drawElements=draw;g.drawArrays=arrays;g.colorMask=mask;
        const p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);
        let visible=0,background=0,leftRed=0,rightRed=0;
        for(let i=0;i<p.length;i+=4){
          if(p[i+1]>45 && p[i+2]>45)visible++;if(p[i]===4&&p[i+1]===6&&p[i+2]===10)background++;
          if(p[i]>80 && p[i]>p[i+1]*2 && p[i]>p[i+2]*2){
            if((i/4)%c.width<c.width/2)leftRed++;else rightRed++;
          }
        }
        return {id:$("presentation").value,calls,visible,background,leftRed,rightRed,total:c.width*c.height,error:g.getError(),
          source:$("audio").src,time:$("audio").currentTime,description:$("geometry-details").textContent,
          framing:$("framing").value,framingDisabled:$("framing").disabled,
          materialHidden:$("appearance").closest("label").hidden};
      })()`);
      assert.equal(data.error,0,JSON.stringify(data));
      assert(data.visible>1000,JSON.stringify(data));
      assert(data.background>data.total*.35,JSON.stringify(data));
      assert.equal(data.source,await evaluate(`window.presentationBaseline.source`));
      assert.equal(data.time,await evaluate(`window.presentationBaseline.time`));
      assert(data.materialHidden);
      if (id==="facemesh") {
        assert(data.framingDisabled && data.framing==="front");
        assert(data.calls.filter(c=>c.colored).every(c=>c.mode===1 || (c.mode===4 && c.material===2 && c.pass===3)));
        assert.equal(data.calls.filter(c=>c.colored&&c.pass===3).length,1);
        assert(data.leftRed>20 && data.rightRed>20,JSON.stringify(data));
        assert(data.calls[0].count<30746*3);
      } else if (id==="facedot") {
        assert.equal(data.framing,"head-neck");
        assert(data.calls.filter(c=>c.colored).every(c=>c.mode===4));
        assert(data.calls.some(c=>!c.colored && c.mode===4));
      }
      if(id!=="facemesh")assert.equal(data.leftRed+data.rightRed,0);
      report.presentations.push(data);
      await screenshot(`02-view-${id}`);
      for (const axis of ["yaw","tilt","roll"]) {
        await evaluate(`document.getElementById("${axis}").value=".7";document.getElementById("${axis}").dispatchEvent(new Event("input"));`);
        assert.equal(await evaluate(`document.getElementById("face").getContext("webgl2").getError()`),0);
        await evaluate(`document.getElementById("${axis}").value="0";document.getElementById("${axis}").dispatchEvent(new Event("input"));`);
      }
      if(id==="facemesh"){
        data.mechanicalEyes=await evaluate(`(() => {
          const $=id=>document.getElementById(id),zoom=$("zoom").value;
          $("zoom").value="2";$("zoom").dispatchEvent(new Event("input"));
          const c=$("face"),g=c.getContext("webgl2"),p=new Uint8Array(c.width*c.height*4),eyes=[];
          g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);
          const metric=(x,y)=>{const i=(Math.round(y)*c.width+Math.round(x))*4;return p[i]-Math.max(p[i+1],p[i+2]);};
          for(let side=0;side<2;side++){
            let sx=0,sy=0,count=0,hotCorePixels=0,coreCoronaPixels=0;
            for(let y=0;y<c.height;y++)for(let x=Math.ceil(side*c.width/2);x<(side+1)*c.width/2;x++){
              const i=(y*c.width+x)*4;
              if(p[i]>154&&p[i+1]>28&&p[i+1]<p[i]*.94&&p[i+2]<p[i]*.85)count++;
              if(p[i]>245&&p[i+1]>190&&p[i+2]>150){sx+=x;sy+=y;hotCorePixels++;}
              if(p[i]>190&&p[i+1]<90&&p[i+2]<90)coreCoronaPixels++;
            }
            if(!count||!hotCorePixels)throw new Error("Missing bright mechanical iris core");
            const x=sx/hotCorePixels,y=sy/hotCorePixels,coreRadius=Math.sqrt(count/Math.PI),bands=[];
            for(let radius=Math.ceil(coreRadius*1.35);radius<coreRadius*6;radius++){
              let sum=0;
              for(let s=0;s<64;s++){
                const angle=(s%32/31-.5)*.36+(s<32?0:Math.PI);
                sum+=metric(x+radius*Math.cos(angle),y+radius*Math.sin(angle));
              }
              if(sum/64>101.5){
                if(!bands.length||radius>bands.at(-1).at(-1)+1)bands.push([]);
                bands.at(-1).push(radius);
              }
            }
            let spokes=0;
            if(bands.length===3){
              const radius=(bands[1].at(-1)+bands[2][0])/2,high=[];
              for(let a=0;a<144;a++)high.push(metric(x+radius*Math.cos(a*Math.PI/144),y+radius*Math.sin(a*Math.PI/144))>77);
              for(let a=1;a<high.length;a++)if(high[a]&&!high[a-1])spokes++;
            }
            let ringRedMaximum=0;
            if(bands.length===3){
              const radius=(bands[2][0]+bands[2].at(-1))/2;
              for(let s=0;s<64;s++){
                const angle=(s%32/31-.5)*.36+(s<32?0:Math.PI);
                const i=(Math.round(y+radius*Math.sin(angle))*c.width+Math.round(x+radius*Math.cos(angle)))*4;
                ringRedMaximum=Math.max(ringRedMaximum,p[i]);
              }
            }
            eyes.push({corePixels:count,hotCorePixels,coreCoronaPixels,ringRedMaximum,
              ringBands:bands,visibleUpperSpokes:spokes});
          }
          $("zoom").value=zoom;$("zoom").dispatchEvent(new Event("input"));return eyes;
        })()`);
        for(const eye of data.mechanicalEyes){
          assert(eye.corePixels>10,JSON.stringify(eye));
          assert(eye.hotCorePixels>2&&eye.coreCoronaPixels>10,JSON.stringify(eye));
          assert(eye.ringRedMaximum>=169&&eye.ringRedMaximum<=171,JSON.stringify(eye));
          assert.equal(eye.ringBands.length,3,JSON.stringify(eye));
          assert(eye.visibleUpperSpokes>=10&&eye.visibleUpperSpokes<=14,JSON.stringify(eye));
        }
        const rearRed=await evaluate(`(() => {
          const $=id=>document.getElementById(id);$("yaw").value="3.14";$("yaw").dispatchEvent(new Event("input"));
          const c=$("face"),g=c.getContext("webgl2"),p=new Uint8Array(c.width*c.height*4);
          g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);let red=0;
          for(let i=0;i<p.length;i+=4)if(p[i]>80&&p[i]>p[i+1]*2&&p[i]>p[i+2]*2)red++;
          $("yaw").value="0";$("yaw").dispatchEvent(new Event("input"));return red;
        })()`);
        assert.equal(rearRed,0,"Pupil emission must not shine through the back of the eyes");
        data.rearRed=rearRed;
      }
    }
    report.meshDetail = await evaluate(`(() => {
      const $=id=>document.getElementById(id),g=$("face").getContext("webgl2");
      $("presentation").value="facemesh";$("presentation").dispatchEvent(new Event("input"));
      const draw=g.drawElements,create=g.createBuffer,remove=g.deleteBuffer;let triangles=0,created=0,deleted=0;
      g.drawElements=function(mode,n,...args){if(mode===g.TRIANGLES && !triangles)triangles=n/3;return draw.call(this,mode,n,...args);};
      g.createBuffer=function(){created++;return create.call(this);};g.deleteBuffer=function(b){deleted++;return remove.call(this,b);};
      const levels=[];
      for(let detail=1;detail<=5;detail++){triangles=0;$("mesh-detail").value=String(detail);$("mesh-detail").dispatchEvent(new Event("input"));
        levels.push({detail,triangles,error:g.getError()});}
      g.drawElements=draw;g.createBuffer=create;g.deleteBuffer=remove;
      $("presentation").value="claire";$("presentation").dispatchEvent(new Event("input"));
      const c=$("face"),p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);
      let restoredDifference=0;for(let i=0;i<p.length;i++)if(p[i]!==window.presentationBaseline.pixels[i])restoredDifference++;
      delete window.presentationBaseline;
      return {levels,created,deleted,restoredDifference,claire:$("presentation").value,
        material:$("appearance").value,hair:$("hair").checked,edges:$("edges").checked,framing:$("framing").value};
    })()`);
    assert(report.meshDetail.levels[0].triangles<report.meshDetail.levels[4].triangles);
    assert(report.meshDetail.levels.every(d=>d.error===0));
    assert.equal(report.meshDetail.created,report.meshDetail.deleted);
    assert.equal(report.meshDetail.restoredDifference,0);
    assert.equal(report.meshDetail.claire,"claire");
    assert.equal(report.meshDetail.material,"polygon");
    assert.equal(report.meshDetail.hair,true);
    assert.equal(report.meshDetail.edges,true);
    assert.equal(report.meshDetail.framing,"full");
  });
  await check("Claire Colors off removes skin, eye, hair, edge and point hues and restores exact pixels", async () => {
    report.monochrome = await evaluate(`(() => {
      const $=id=>document.getElementById(id),c=$("face"),g=c.getContext("webgl2"),a=$("audio");
      const source=a.src,time=a.currentTime,set=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new Event("input"));};
      const toggle=(id,value)=>{$(id).checked=value;$(id).dispatchEvent(new Event("input"));};
      const pixels=()=>{const p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);return p;};
      const results=[],gallery=document.createElement("canvas");gallery.width=600;gallery.height=600;
      const context=gallery.getContext("2d");let sample=0;
      toggle("points",true);
      for(const style of ["claire","curls"])for(const material of ["polygon","shaded"]){
        set("hairstyle",style);set("appearance",material);toggle("colors",true);const before=pixels();
        toggle("colors",false);const gray=pixels();let tinted=0,visible=0,changed=0;
        context.drawImage(c,sample%2*300,Math.floor(sample/2)*300,300,270);
        context.fillStyle="white";context.font="15px sans-serif";context.fillText(style+" / "+material,sample%2*300+8,Math.floor(sample/2)*300+290);sample++;
        for(let i=0;i<gray.length;i+=4){
          const high=Math.max(gray[i],gray[i+1],gray[i+2]),low=Math.min(gray[i],gray[i+1],gray[i+2]);
          if(high>20){visible++;if(high-low>7)tinted++;}
          if(before[i]!==gray[i]||before[i+1]!==gray[i+1]||before[i+2]!==gray[i+2])changed++;
        }
        toggle("colors",true);const restored=pixels();let difference=0;
        for(let i=0;i<before.length;i++)if(before[i]!==restored[i])difference++;
        results.push({style,material,tinted,visible,changed,difference,error:g.getError()});
      }
      set("hairstyle","claire");set("appearance","polygon");toggle("points",false);
      return {results,sameSource:a.src===source,sameTime:a.currentTime===time,image:gallery.toDataURL("image/png")};
    })()`);
    await fs.writeFile(path.join(output,"claire-monochrome.png"),Buffer.from(report.monochrome.image.split(",")[1],"base64"));
    delete report.monochrome.image;
    assert(report.monochrome.sameSource && report.monochrome.sameTime);
    for(const result of report.monochrome.results){
      assert.equal(result.error,0);assert.equal(result.tinted,0,JSON.stringify(result));
      assert(result.visible>1000 && result.changed>1000);assert.equal(result.difference,0);
    }
  });
  await check("Every hairstyle matches mesh/dot/grid passes, defaults off, fits/crops and restores without GPU growth", async () => {
    const data=await evaluate(`(() => {
      const $=id=>document.getElementById(id),c=$("face"),g=c.getContext("webgl2"),a=$("audio");
      const source=a.src,time=a.currentTime,set=(id,value)=>{$(id).value=String(value);$(id).dispatchEvent(new Event("input"));};
      const toggle=value=>{$("hair").checked=value;$("hair").dispatchEvent(new Event("input"));};
      const pixels=(raw=false)=>{
        const p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);
        let hash=2166136261,visible=0,nonCyan=0,red=0;
        for(let i=0;i<p.length;i+=4){
          hash=Math.imul(hash^p[i],16777619)>>>0;hash=Math.imul(hash^p[i+1],16777619)>>>0;
          const pupil=p[i]>p[i+1] && p[i]>p[i+2];
          if(pupil&&p[i]>80)red++;
          if(p[i+1]>40){visible++;if((p[i]>p[i+1] || p[i+2]<p[i])&&!pupil)nonCyan++;}
        }return {hash,visible,nonCyan,red,...(raw?{pixels:p}:{})};
      };
      const create=g.createBuffer,remove=g.deleteBuffer,draw=g.drawElements,mask=g.colorMask,allocate=g.bufferData,update=g.bufferSubData;
      const live=new Set(),results=[],images=[],defaults=[],restorations=[],patterns=[];let peak=0,calls=[],colored=true,allocations=0,updates=0,hairOnly=false;
      g.createBuffer=function(){const b=create.call(this);live.add(b);peak=Math.max(peak,live.size);return b;};
      g.deleteBuffer=function(b){live.delete(b);return remove.call(this,b);};
      g.bufferData=function(...args){allocations++;return allocate.apply(this,args);};
      g.bufferSubData=function(...args){updates++;return update.apply(this,args);};
      g.colorMask=function(...args){colored=args.some(Boolean);return mask.apply(this,args);};
      g.drawElements=function(mode,count,...args){
        const program=g.getParameter(g.CURRENT_PROGRAM),material=g.getUniform(program,g.getUniformLocation(program,"material"));
        calls.push({mode,count,colored,material,pass:g.getUniform(program,g.getUniformLocation(program,"pass"))});
        if(!hairOnly||!colored||material===1)return draw.call(this,mode,count,...args);
      };
      const styles=Array.from($("hairstyle").options,o=>({id:o.value,name:o.textContent}));
      const fit=()=>{
        const program=g.getParameter(g.CURRENT_PROGRAM);
        return ["viewCenter","viewScale"].map(name=>{
          const value=g.getUniform(program,g.getUniformLocation(program,name));
          return typeof value==="number"?value:Array.from(value);
        });
      };
      for(const view of ["facemesh","facedot","uniform"]){
        set("presentation",view);defaults.push({view,on:$("hair").checked,disabled:$("hairstyle").disabled,hidden:$("hairstyle").closest("label").hidden});
        const off=pixels(true),offFit=fit();toggle(true);
        for(const yaw of [0,.8]){
          const gallery=document.createElement("canvas");gallery.width=600;gallery.height=300;const ctx=gallery.getContext("2d");
          ctx.fillStyle="#101821";ctx.fillRect(0,0,600,300);
          for(let i=0;i<styles.length;i++){
            const style=styles[i];set("hairstyle",style.id);set("yaw",yaw);calls=[];
            $("yaw").dispatchEvent(new Event("input"));
            const sample=pixels(),draws=calls.slice(),firstAllocations=allocations,firstUpdates=updates;
            $("yaw").dispatchEvent(new Event("input"));
            results.push({view,style:style.id,yaw,...sample,calls:draws,error:g.getError(),
              steadyAllocations:allocations-firstAllocations,normalUpdates:updates-firstUpdates});
            ctx.drawImage(c,i%4*300,Math.floor(i/4)*300,300,270);
            ctx.fillStyle="white";ctx.font="15px sans-serif";ctx.fillText(style.name,i%4*300+8,Math.floor(i/4)*300+290);
          }images.push({view,yaw,data:gallery.toDataURL("image/png")});
        }
        set("yaw",0);
        if(view!=="facemesh"){
          set("hairstyle","curls");hairOnly=true;
          for(const [density,gap] of [[1,0],[1,.8],[3,.8]]){
            set("pattern-density",density);set("pattern-gap",gap);patterns.push({view,density,gap,...pixels()});
          }hairOnly=false;
          set("pattern-density",1);set("pattern-gap",view==="facedot"?.6:0);
          set("neck-depth",0);set("neck-depth",6);set("neck-depth",1.7);
          set("framing","full");set("framing","head-neck");
        }
        set("presentation","claire");set("presentation",view);
        const retained=$("hair").checked;set("hairstyle","claire");toggle(false);
        const restored=pixels(true);let changed=0,maximumDifference=0;
        for(let i=0;i<off.pixels.length;i++)if(off.pixels[i]!==restored.pixels[i]){
          changed++;maximumDifference=Math.max(maximumDifference,Math.abs(off.pixels[i]-restored.pixels[i]));
        }
        restorations.push({view,retained,off:off.hash,restored:restored.hash,changed,maximumDifference,
          beforeVisible:off.visible,afterVisible:restored.visible,offFit,restoredFit:fit(),width:c.width,height:c.height});
      }
      set("presentation","claire");set("hairstyle","claire");
      g.createBuffer=create;g.deleteBuffer=remove;g.drawElements=draw;g.colorMask=mask;g.bufferData=allocate;g.bufferSubData=update;
      return {defaults,results,restorations,patterns,images,peak,remaining:live.size,sameSource:a.src===source,sameTime:a.currentTime===time};
    })()`);
    const {images,...receipt}=data;report.matchingHair=receipt;
    for(const image of images)await fs.writeFile(path.join(output,`matching-hair-${image.view}-${image.yaw?"turned":"front"}.png`),Buffer.from(image.data.split(",")[1],"base64"));
    assert(data.defaults.every(d=>!d.on && d.disabled && !d.hidden));
    assert(data.sameSource && data.sameTime);
    for(const result of data.results){
      assert.equal(result.error,0,JSON.stringify(result));assert(result.visible>1000);
      if(result.view==="facemesh")assert(result.nonCyan<result.red,JSON.stringify(result));
      else assert.equal(result.nonCyan,0);
      assert.equal(result.steadyAllocations,0);assert.equal(result.normalUpdates,0);
      const visible=result.calls.filter(c=>c.colored),depth=result.calls.filter(c=>!c.colored);
      assert.equal(visible.length,result.view==="facemesh"?4:3);assert.equal(depth.length,3);assert.equal(visible.at(-1).material,1);
      assert(visible.every(c=>c.mode===(result.view==="facemesh"&&c.pass!==3?1:4)));
      if(result.view==="facemesh")assert(result.red>20,JSON.stringify(result));else assert.equal(result.red,0);
      assert(depth.every(c=>c.mode===4));
      if(result.view==="facemesh")assert(visible.at(-1).count>=depth.at(-1).count);
    }
    for(const view of ["facemesh","facedot","uniform"])for(const yaw of [0,.8]){
      assert.equal(new Set(data.results.filter(r=>r.view===view&&r.yaw===yaw).map(r=>r.hash)).size,2);
    }
    for(const result of data.restorations){
      assert(result.retained);assert.deepEqual(result.offFit,result.restoredFit);
      assert.equal(result.beforeVisible,result.afterVisible);
      // Repeated identical-state wire draws locally vary by one RGB pixel, at most five channel levels.
      assert(result.changed<=(result.view==="facemesh"?3:0) && result.maximumDifference<=5,JSON.stringify(result));
    }
    for(const view of ["facedot","uniform"]){
      const samples=data.patterns.filter(p=>p.view===view);
      assert(samples[0].visible>samples[1].visible,JSON.stringify(samples));
      assert.notEqual(samples[1].hash,samples[2].hash);
    }
    assert(data.peak<=20 && data.remaining<=6,JSON.stringify({peak:data.peak,remaining:data.remaining}));
  });
  await check("Dot/cell density increases isolated patterns; gaps reduce coverage without geometry or speech allocation", async () => {
    report.patterns = await evaluate(`(() => {
      const $=id=>document.getElementById(id),c=$("face"),g=c.getContext("webgl2"),source=$("audio").src,time=$("audio").currentTime;
      const set=(id,value)=>{$(id).value=String(value);$(id).dispatchEvent(new Event("input"));};
      const create=g.createBuffer;let allocations=0;g.createBuffer=function(){allocations++;return create.call(this);};
      const read=()=>{
        const p=new Uint8Array(c.width*c.height*4),mask=new Uint8Array(c.width*c.height),queue=new Int32Array(mask.length);
        g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);let colored=0,components=0;
        for(let i=0;i<mask.length;i++)if(p[i*4+1]>40 && p[i*4+1]>p[i*4]*1.3){mask[i]=1;colored++;}
        for(let i=0;i<mask.length;i++)if(mask[i]){
          components++;let start=0,end=1;queue[0]=i;mask[i]=0;
          while(start<end){const n=queue[start++],x=n%c.width;
            for(const q of [x?n-1:-1,x+1<c.width?n+1:-1,n-c.width,n+c.width])
              if(q>=0&&q<mask.length&&mask[q]){mask[q]=0;queue[end++]=q;}}
        }
        return {colored,components,error:g.getError()};
      };
      const results=[];
      for(const view of ["facedot","uniform"]){
        set("presentation",view);const baselineAllocations=allocations;
        set("pattern-gap",.6);set("pattern-density",.5);const sparse=read();
        set("pattern-density",1.5);const dense=read();
        set("pattern-density",1);set("pattern-gap",0);const close=read();
        set("pattern-gap",.8);const spaced=read();
        results.push({view,sparse,dense,close,spaced,allocations:allocations-baselineAllocations});
      }
      set("presentation","facedot");const retained=[$("pattern-density").value,$("pattern-gap").value];
      set("pattern-density",1);set("pattern-gap",.6);
      set("presentation","uniform");set("pattern-density",1);set("pattern-gap",0);
      set("presentation","claire");g.createBuffer=create;
      return {results,retained,sourceUnchanged:$("audio").src===source,timeUnchanged:$("audio").currentTime===time,
        hidden:$("pattern-density-control").hidden && $("pattern-gap-control").hidden};
    })()`);
    for (const data of report.patterns.results) {
      assert(data.dense.components>data.sparse.components*1.5,JSON.stringify(data));
      assert(data.spaced.colored<data.close.colored,JSON.stringify(data));
      assert.equal(data.allocations,0);
      for(const key of ["sparse","dense","close","spaced"])assert.equal(data[key].error,0);
    }
    assert.deepEqual(report.patterns.retained,["1","0.8"]);
    assert(report.patterns.sourceUnchanged && report.patterns.timeUnchanged && report.patterns.hidden);
  });
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
  await check("Head tracking keeps irises centered, turns in both directions, preserves manual XYZ and settles when disabled", async () => {
    const before=await evaluate(`({source:document.getElementById("audio").src,time:document.getElementById("audio").currentTime})`);
    const manual=await evaluate(`(() => {const $=id=>document.getElementById(id);
      $("cursor-mode").value="head";$("cursor-mode").dispatchEvent(new Event("input"));
      $("tilt").value=".12";$("yaw").value=".2";$("roll").value="-.1";
      $("follow-eyes").checked=true;$("follow-eyes").dispatchEvent(new Event("input"));
      window.dispatchEvent(new MouseEvent("mousemove",{clientX:innerWidth+200,clientY:-200}));
      return ["tilt","yaw","roll"].map(id=>Number($(id).value));})()`);
    await delay(1100);
    const read=`(() => {const $=id=>document.getElementById(id);return {head:$("face").dataset.headAngles.split(",").map(Number),
      gaze:$("face").dataset.gaze.split(",").map(Number),manual:["tilt","yaw","roll"].map(id=>Number($(id).value)),
      source:$("audio").src,time:$("audio").currentTime,error:$("face").getContext("webgl2").getError()};})()`;
    const right=await evaluate(read);assert(right.head[0]<0 && right.head[1]>0);
    assert.deepEqual(right.gaze,[0,0]);assert.deepEqual(right.manual,manual);assert.equal(right.error,0);
    await evaluate(`window.dispatchEvent(new MouseEvent("mousemove",{clientX:-500,clientY:innerHeight+500}));`);
    await delay(1100);const left=await evaluate(read);assert(left.head[0]>0 && left.head[1]<0);assert.deepEqual(left.gaze,[0,0]);
    await evaluate(`document.documentElement.dispatchEvent(new MouseEvent("mouseleave"));`);
    await delay(1100);const lost=await evaluate(read);assert.deepEqual(lost.head,[0,0]);
    await evaluate(`document.getElementById("cursor-mode").value="eyes";document.getElementById("cursor-mode").dispatchEvent(new Event("input"));
      window.dispatchEvent(new MouseEvent("mousemove",{clientX:innerWidth+200,clientY:-200}));`);
    await delay(1100);const eyes=await evaluate(read);assert.deepEqual(eyes.head,[0,0]);assert(eyes.gaze.some(v=>Math.abs(v)>.01));
    await evaluate(`document.getElementById("cursor-mode").value="head";document.getElementById("cursor-mode").dispatchEvent(new Event("input"));`);
    await delay(900);
    await evaluate(`document.getElementById("follow-eyes").checked=false;document.getElementById("follow-eyes").dispatchEvent(new Event("input"));`);
    await delay(1100);const off=await evaluate(read);assert.deepEqual(off.head,[0,0]);assert.deepEqual(off.gaze,[0,0]);
    assert.equal(off.source,before.source);assert.equal(off.time,before.time);
    report.headTracking={right,left,lost,eyes,off};
    await evaluate(`document.getElementById("cursor-mode").value="eyes";document.getElementById("cursor-mode").dispatchEvent(new Event("input"));
      document.getElementById("reset-view").click();`);
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
    for (const {density,edges,view,framing,preset="claire",hair=true,style="claire",colors=true} of [
      {density:1,edges:true,view:"polygon"},{density:2,edges:true,view:"polygon"},
      {density:1,edges:false,view:"shaded"},{density:2,edges:false,view:"shaded"},
      {density:1,edges:true,view:"shaded"},{density:2,edges:true,view:"shaded"},
    ].flatMap(mode=>["full","head-neck"].map(framing=>({...mode,framing}))).concat(
      ["facemesh","facedot","uniform"].flatMap(preset=>[1,2].map(density=>({
        preset,density,edges:false,hair:false,view:"polygon",framing:preset==="facemesh"?"front":"head-neck"}))),
      ["facemesh","facedot","uniform"].flatMap(preset=>[1,2].map(density=>({
        preset,density,edges:false,hair:true,style:"curls",view:"polygon",framing:preset==="facemesh"?"front":"head-neck"}))),
      ["polygon","shaded"].map(view=>({view,density:2,edges:true,colors:false,framing:"head-neck"})))) {
      await evaluate(`document.getElementById("presentation").value=${JSON.stringify(preset)};
        document.getElementById("presentation").dispatchEvent(new Event("input"));
        document.getElementById("hair").checked=${hair};document.getElementById("hair").dispatchEvent(new Event("input"));
        document.getElementById("hairstyle").value=${JSON.stringify(style)};
        document.getElementById("hairstyle").dispatchEvent(new Event("input"));
        document.getElementById("colors").checked=${colors};
        ${preset==="facedot"||preset==="uniform"?`document.getElementById("pattern-density").value="${hair?3:1}";
          document.getElementById("pattern-density").dispatchEvent(new Event("input"));
          document.getElementById("pattern-gap").value="${hair?.8:preset==="facedot"?.6:0}";
          document.getElementById("pattern-gap").dispatchEvent(new Event("input"));`:""}
        document.getElementById("framing").value=${JSON.stringify(framing)};
        ${preset==="facemesh"?"":'document.getElementById("framing").dispatchEvent(new Event("input"));'}
        document.getElementById("appearance").value=${JSON.stringify(view)};
        document.getElementById("edges").checked=${edges};document.getElementById("edges").dispatchEvent(new Event("input"));`);
      await cdp("Emulation.setDeviceMetricsOverride", { width:1280,height:980,deviceScaleFactor:density,mobile:false });
      await delay(150);
    const timing = await evaluate(`new Promise(resolve=>{
      const intervals=[];let previous=0,start=0;
      const firstDraw=window.renderProbe.frames,firstUpdates=window.renderProbe.updates,firstAllocations=window.renderProbe.allocations;
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
            normalBufferAllocations:window.renderProbe.allocations-firstAllocations,
            normalBufferUpdates:window.renderProbe.updates-firstUpdates,
            playing:!document.getElementById("audio").paused});
        }
      }requestAnimationFrame(sample);
    })`);
    report.renderCadence.push({...timing,density,edges,view,framing,preset,hair,style,colors});
    }
    for (const timing of report.renderCadence) {
    assert.equal(timing.playing,true);
    assert.equal(timing.normalBufferAllocations,0);
    if(timing.preset==="claire")assert(timing.normalBufferUpdates>100);
    else assert.equal(timing.normalBufferUpdates,0);
    assert(timing.samples>300,JSON.stringify(timing));
    assert(timing.submittedDraws>=timing.samples,JSON.stringify(timing));
    if(timing.view==="shaded"){
      assert(timing.canvas.every((size,i)=>size<=Math.round(timing.cssCanvas[i]*1.5)),JSON.stringify(timing));
    }
    assert(timing.meanMs<17.55 && timing.p95Ms<20,JSON.stringify(timing));
    }
    await click("play");
    await evaluate(`document.getElementById("audio").loop=false;window.renderProbe.restore();delete window.renderProbe;
      for(const id of ["facemesh","facedot","uniform"]){
        document.getElementById("presentation").value=id;document.getElementById("presentation").dispatchEvent(new Event("input"));
        document.getElementById("hair").checked=false;document.getElementById("hair").dispatchEvent(new Event("input"));
      }
      document.getElementById("presentation").value="claire";
      document.getElementById("presentation").dispatchEvent(new Event("input"));
      document.getElementById("colors").checked=true;
      document.getElementById("hairstyle").value="claire";document.getElementById("hairstyle").dispatchEvent(new Event("input"));
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
    const angry=await generate("Hey, how are you?","angry");
    report.angry=angry;
    assert.equal(angry.expression,"angry");
    assert.equal(angry.speechCacheHit,true);
    assert.equal(angry.audioPcmSha256,happy.audioPcmSha256);
    assert.notEqual(angry.motionSha256,happy.motionSha256);
    assert.notEqual(angry.motionSha256,greeting.motionSha256);
    await evaluate(`document.getElementById("seek").value=".9";document.getElementById("seek").dispatchEvent(new Event("input"));`);
    await screenshot("04a-angry");
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
    await evaluate(`for(const [id,value] of Object.entries({hairstyle:"curls","cursor-mode":"head",presentation:"facedot",
      "pattern-density":"2","pattern-gap":".8",zoom:"1.5"})){
      document.getElementById(id).value=value;document.getElementById(id).dispatchEvent(new Event("input"));}`);
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
    assert.equal(await evaluate(`document.getElementById("presentation").value`), "claire");
    assert.equal(await evaluate(`document.getElementById("hairstyle").value`), "claire");
    assert.equal(await evaluate(`document.getElementById("colors").checked`), true);
    assert.equal(await evaluate(`document.getElementById("hair").checked`), true);
    assert.equal(await evaluate(`document.getElementById("cursor-mode").value`), "eyes");
    assert.equal(await evaluate(`document.getElementById("zoom").value`), "1");
    await evaluate(`document.getElementById("presentation").value="facedot";document.getElementById("presentation").dispatchEvent(new Event("input"));`);
    assert.equal(await evaluate(`document.getElementById("hair").checked`), false);
    assert.equal(await evaluate(`document.getElementById("hairstyle").disabled`), true);
    assert.deepEqual(await evaluate(`["pattern-density","pattern-gap"].map(id=>document.getElementById(id).value)`),["1","0.6"]);
    await evaluate(`document.getElementById("presentation").value="claire";document.getElementById("presentation").dispatchEvent(new Event("input"));`);
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

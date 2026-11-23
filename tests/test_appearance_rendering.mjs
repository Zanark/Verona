// Isolated synthetic WebGL qualification. No Python engine, TTS, assets or user browser profile.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import {spawn,execFileSync} from "node:child_process";
import {setTimeout as delay} from "node:timers/promises";

const root=path.resolve("verona","web");
const output=path.resolve(".local","qualification",`appearance-${Date.now()}`);
const profile=path.join(output,"edge-profile");
await fs.mkdir(profile,{recursive:true});
const pixelBaseline=process.argv.find(arg=>arg.startsWith("--pixel-baseline="))?.slice(17);
const baselineRef=process.argv.find(arg=>arg.startsWith("--baseline="))?.slice(11)||pixelBaseline;
const realMesh=process.argv.find(arg=>arg.startsWith("--real-mesh="))?.slice(12);
const nativeMesh=process.argv.find(arg=>arg.startsWith("--native-mesh="))?.slice(14);
const baseline=baselineRef?Object.fromEntries(["app.js","mpfb.js","mpfb-renderer.mjs"].map(name=>
  [name,execFileSync("git",["show",`${baselineRef}:verona/web/${name}`],{encoding:"utf8"})])):null;
// Retained-view comparisons do not restore the retired module's dead import.
if(baseline)baseline["app.js"]=baseline["app.js"].replace(/^import .* from "\/robot\.mjs";\r?\n/m,"");
let meta={center:[0,146,0],scale:12,quantization:10000,identity:"Synthetic fixture"};
const positions=[],triangles=[],edges=[];
const columns=49,rows=85;
for(let y=0;y<rows;y++) for(let x=0;x<columns;x++){
  positions.push(x/4-6,136+y/4,3.8);
  const a=y*columns+x;
  if(x+1<columns)edges.push(a,a+1);
  if(y+1<rows)edges.push(a,a+columns);
  if(x+1<columns&&y+1<rows)triangles.push(a,a+1,a+columns+1,a,a+columns+1,a+columns);
}
let native={rest:positions,polygons:[],eyeCenters:[[-2.9485,147.5517,2.2364],[3.1021,147.4944,2.283]],
  eyeRadii:[[1.3,1.3,1.3],[1.3,1.3,1.3]]};
for(let i=0;i<triangles.length;i+=3){
  const face=triangles.slice(i,i+3);
  const x=face.reduce((sum,id)=>sum+positions[id*3],0)/3;
  const y=face.reduce((sum,id)=>sum+positions[id*3+1],0)/3;
  if(!native.eyeCenters.some(center=>Math.hypot((x-center[0])/1.5,(y-center[1])/1.3)<1))
    native.polygons.push(face);
}
if(nativeMesh)native=JSON.parse(await fs.readFile(nativeMesh,"utf8"));
const chunks=[];
let length=0;
const append=array=>{
  while(length%4){chunks.push(Buffer.alloc(1));length++;}
  const offset=length,buffer=Buffer.from(array.buffer,array.byteOffset,array.byteLength);
  chunks.push(buffer);length+=buffer.length;return offset;
};
const quantize=values=>Int16Array.from(values,(v,i)=>Math.round((v-meta.center[i%3])/meta.scale*meta.quantization));
append(quantize(positions));meta.vertices=positions.length/3;
meta.edgeOffset=append(Uint32Array.from(edges));meta.edges=edges.length/2;
meta.triangleOffset=append(Uint32Array.from(triangles));meta.triangles=triangles.length/3;
const rectangle=(x0,x1,y0,y1,z)=>[x0,y0,z,x1,y0,z,x1,y1,z,x0,y1,z];
const hair=rectangle(-6,6,154,157,4.2);
const eyes=[...rectangle(-3.9,-2,146.7,148.4,3.9),...rectangle(2.1,4,146.7,148.4,3.9)];
meta.hair={vertices:4,positionOffset:append(quantize(hair)),
  edgeOffset:append(Uint32Array.from([0,1,1,2,2,3,3,0])),edges:4,
  triangleOffset:append(Uint32Array.from([0,1,2,0,2,3])),triangles:2};
meta.eyes={vertices:8,positionOffset:append(quantize(eyes)),
  triangleOffset:append(Uint32Array.from([0,1,2,0,2,3,4,5,6,4,6,7])),triangles:4};
meta.bytes=length;
let binary=Buffer.concat(chunks);
if(realMesh){
  meta=JSON.parse(await fs.readFile(path.join(realMesh,"mesh.json"),"utf8"));
  binary=await fs.readFile(path.join(realMesh,"mesh.bin"));
}
let nativeMode=false,markMode=false,retiredMode=false,retiredMeshRequests=0;
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,"http://127.0.0.1");
    if(url.pathname==="/favicon.ico"){res.writeHead(204).end();return;}
    if(url.pathname==="/api/session"){
      res.setHeader("Content-Type","application/json");
      res.end(JSON.stringify({mesh:meta,voices:[{name:"Fixture",culture:"en-US"}],defaultVoice:"Fixture",
        limits:{characters:280},appearance:{model:retiredMode?"robot":markMode?"mark":nativeMode?"mpfb":"claire",session:"fixture",colors:{}}}));
      return;
    }
    if(url.pathname==="/api/mesh"){
      if(retiredMode)retiredMeshRequests++;
      res.setHeader("Content-Type",nativeMode?"application/json":"application/octet-stream");
      res.end(nativeMode?JSON.stringify(native):binary);return;
    }
    let name=url.pathname.slice(1)||"index.html";
    if(name==="retired"){retiredMode=true;nativeMode=false;name="index.html";}
    if(name==="mark"){markMode=true;nativeMode=false;name="index.html";}
    if(name==="native"){nativeMode=true;name="mpfb.html";}
    if(name==="legacy-native"){nativeMode=true;name="mpfb.html";}
    if(name==="legacy"){nativeMode=false;name="index.html";}
    if(!/^[a-z-]+\.(?:mjs|js|html|css)$/.test(name))throw new Error("Not a fixture route.");
    let data=name.startsWith("legacy-")&&baseline
      ?Buffer.from(baseline[name.slice(7)].replace('from "/mpfb-renderer.mjs"','from "/legacy-mpfb-renderer.mjs"'))
      :await fs.readFile(path.join(root,name));
    if(url.pathname==="/legacy")data=Buffer.from(data.toString().replace('src="/app.js"','src="/legacy-app.js"'));
    if(name==="mpfb.html")data=Buffer.from(data.toString().replace('src="/app.js"','src="/mpfb.js"')
      .replace('href="/style.css"','href="/mpfb.css"'));
    if(url.pathname==="/legacy-native")data=Buffer.from(data.toString().replace('src="/mpfb.js"','src="/legacy-mpfb.js"'));
    if(name==="app.js")data=Buffer.from(data.toString()+"\nwindow.rendererFixture=renderer;\n");
    res.setHeader("Content-Type",name.endsWith(".css")?"text/css":name.endsWith(".html")?"text/html":"text/javascript");
    res.end(data);
  }catch(error){res.writeHead(500).end(error.message);}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const edge=spawn("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",[
  "--headless=new","--no-first-run","--no-default-browser-check","--remote-debugging-port=0",
  "--use-angle=swiftshader","--enable-unsafe-swiftshader",`--user-data-dir=${profile}`,"about:blank"
],{stdio:["ignore","ignore","pipe"]});
let browserLog="";edge.stderr.on("data",data=>browserLog+=data);
let ws;
const pending=new Map(),errors=[],report={fixture:"Synthetic geometry, software WebGL; no human/identity acceptance",views:[]};
if(realMesh)report.fixture=`Actual ${meta.identity} mesh, synthetic motion and legacy MPFB fixture, software WebGL; no human/identity acceptance`;
let sequence=0;
function cdp(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression){
  const result=await cdp("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression){
  for(let i=0;i<200;i++){
    if(await evaluate(expression))return;
    await delay(50);
  }
  throw new Error(`Fixture timed out: ${expression}; ${await evaluate('document.getElementById("error")?.textContent')}`);
}
  async function disableBlinking(){
    await evaluate(`(()=>{
      const b=document.getElementById("natural-blink");
      if(b){b.checked=false;b.dispatchEvent(new Event("input"));}
    })()`);
  }
  async function qualifyBlink(label, nativeView=false){
    const result=await evaluate(`(()=>{
      const native=${nativeView},label=${JSON.stringify(label)};
      const ids=native?["wire","surface"]:["face"];
      veronaAppearance.apply({mesh:"#00FFFF",eyes:"#FF0000",hair:"#000000",lips:"#00FFFF",eyebrows:"#00FFFF"});
      const before=resourceProbe(),images=[],pixels=[];
      for(const amount of [0,.5,1,0]){
        if(native)mpfbPlayer.renderAt(null,0,amount);else rendererFixture.draw(0,amount);
        images.push(ids.map(id=>document.getElementById(id).toDataURL("image/png")));
        pixels.push(ids.map(id=>{
          const c=document.getElementById(id),g=c.getContext("webgl2"),p=new Uint8Array(c.width*c.height*4);
          g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);return p;
        }));
      }
      const difference=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)
        if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n;};
      const red=p=>{let n=0;for(let i=0;i<p.length;i+=4)if(p[i]-Math.max(p[i+1],p[i+2])>30)n++;return n;};
      return {label,images,before,after:resourceProbe(),
        closing:ids.map((_,i)=>difference(pixels[0][i],pixels[1][i])),
        closed:ids.map((_,i)=>difference(pixels[0][i],pixels[2][i])),
        reopened:ids.map((_,i)=>difference(pixels[0][i],pixels[3][i])),
        opticalPixels:pixels.map(row=>row.map(red)),
        gl:ids.map(id=>document.getElementById(id).getContext("webgl2").getError())};
    })()`);
    for(let stage=0;stage<4;stage++)for(let view=0;view<result.images[stage].length;view++)
      await fs.writeFile(path.join(output,`${label}-${view}-${stage}.png`),
        Buffer.from(result.images[stage][view].split(",")[1],"base64"));
    delete result.images;
    assert(result.closing.every(n=>n>0),`${label}: half closure must visibly move the lids.`);
    assert(result.closed.every(n=>n>0),`${label}: closure must be visible.`);
    assert(result.reopened.every(n=>n===0),`${label}: open state must restore exactly.`);
    assert(result.opticalPixels[0].every(n=>n>0),`${label}: original eyes must be visible.`);
    assert(result.opticalPixels[2].every(n=>n===0),`${label}: closed lids cannot retain glowing optics.`);
    assert.equal(result.before.bytes,result.after.bytes);
    assert.deepEqual(result.gl,result.gl.map(()=>0));
    if(!nativeView)assert.equal(result.before.uploads,result.after.uploads,"A procedural blink cannot upload geometry.");
    return result;
  }
  async function qualifyCadence(nativeView=false){
    const result=await evaluate(`(async()=>{
      const input=document.getElementById("natural-blink"),id=${nativeView}?"wire":"face";
      const samples=[],before=resourceProbe();
      input.checked=true;input.dispatchEvent(new Event("input"));
      const start=performance.now();let began=false,ended=false;
      while(performance.now()-start<8500){
        await new Promise(requestAnimationFrame);
        const amount=Number(document.getElementById(id).dataset.blink);
        if(amount>0)began=true;
        samples.push(amount);
        if(began&&amount===0){ended=true;break;}
      }
      input.checked=false;input.dispatchEvent(new Event("input"));
      const stopped=resourceProbe();
      await new Promise(resolve=>setTimeout(resolve,450));
      return {began,ended,maximum:Math.max(...samples),samples:samples.length,
        before,stopped,after:resourceProbe(),error:document.getElementById("error").textContent};
    })()`);
    assert(result.began&&result.ended,`Natural blink must close/reopen without speech: ${JSON.stringify(result)}`);
    assert(result.maximum>0&&result.maximum<=1,"Live cadence must produce a bounded visible blink; deterministic frames verify full closure.");
    assert.equal(result.after.draws,result.stopped.draws,"Disabled blinking must leave no idle RAF.");
    assert.equal(result.before.bytes,result.after.bytes);
    if(!nativeView)assert.equal(result.before.uploads,result.after.uploads);
    return result;
  }
try{
  let endpoint;
  for(let i=0;i<200;i++){
    endpoint=browserLog.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
    if(endpoint)break;await delay(50);
  }
  assert(endpoint,"Owned headless Edge did not expose DevTools.");
  const pages=await(await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/list`)).json();
  ws=new WebSocket(pages.find(page=>page.type==="page").webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true});});
  ws.addEventListener("message",event=>{
    const data=JSON.parse(event.data);
    if(data.id){
      const request=pending.get(data.id);pending.delete(data.id);
      data.error?request?.reject(new Error(data.error.message)):request?.resolve(data.result);
    }else if(data.method==="Runtime.exceptionThrown")errors.push(data.params.exceptionDetails.text);
  });
  await cdp("Runtime.enable");await cdp("Page.enable");
  await cdp("Page.addScriptToEvaluateOnNewDocument",{source:`(()=>{
    const sizes=new Map(),bound=new Map();
    let draws=0,uploads=0;
    const p=WebGL2RenderingContext.prototype;
    for(const name of ["bindBuffer","bufferData","deleteBuffer","bufferSubData","drawElements","drawArrays"]){
      const original=p[name];
      p[name]=function(...args){
        if(name==="bindBuffer")bound.set(args[0],args[1]);
        if(name==="bufferData")sizes.set(bound.get(args[0]),typeof args[1]==="number"?args[1]:args[1].byteLength);
        if(name==="deleteBuffer")sizes.delete(args[0]);
        if(name==="bufferSubData")uploads++;
        if(name.startsWith("draw"))draws++;
        return original.apply(this,args);
      };
    }
    window.resourceProbe=()=>({buffers:sizes.size,bytes:[...sizes.values()].reduce((a,b)=>a+b,0),draws,uploads});
  })();`});
  await cdp("Emulation.setDeviceMetricsOverride",{width:1200,height:1000,deviceScaleFactor:1,mobile:false});
  const sweep=()=>evaluate(`(()=>{
    const cases=[];
    for(let cycle=0;cycle<3;cycle++)for(const view of ["claire","facemesh","facedot","uniform"])
      for(const visible of [false,true]){
        const start=performance.now(),p=document.getElementById("presentation"),h=document.getElementById("hair");
        p.value=view;p.dispatchEvent(new Event("input"));
        h.checked=visible;h.dispatchEvent(new Event("input"));
        cases.push({cycle,view,hair:visible,...resourceProbe(),milliseconds:performance.now()-start});
      }
    return cases;
  })()`);
  const legacyHashes={};
  if(baseline){
    await cdp("Page.navigate",{url:`${origin}/legacy#${"a".repeat(43)}`});
    await waitFor('document.getElementById("generate") && !document.getElementById("generate").disabled');
    await disableBlinking();
    report.resourceBaseline=await sweep();
    for(const view of ["claire","facemesh","facedot","uniform"]){
      await evaluate(`(()=>{
        const p=document.getElementById("presentation");p.value=${JSON.stringify(view)};p.dispatchEvent(new Event("input"));
        const h=document.getElementById("hair");h.checked=true;h.dispatchEvent(new Event("input"));
      })()`);
      // Capture immediately after a synchronous draw; production canvas intentionally has no preserved backbuffer.
      legacyHashes[view]=await evaluate(`(async()=>{
        document.getElementById("yaw").dispatchEvent(new Event("input"));
        const c=document.getElementById("face"),g=c.getContext("webgl2"),p=new Uint8Array(c.width*c.height*4);
        g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);
        return [...new Uint8Array(await crypto.subtle.digest("SHA-256",p))].map(n=>n.toString(16).padStart(2,"0")).join("");
      })()`);
    }
  }
  await cdp("Page.navigate",{url:`${origin}/#${"a".repeat(43)}`});
  await waitFor('window.veronaAppearance && !document.getElementById("generate").disabled');
  await disableBlinking();
  report.resources=await sweep();
  for(const sample of report.resources){
    const first=report.resources.find(value=>value.view===sample.view&&value.hair===sample.hair);
    assert.equal(sample.bytes,first.bytes,"Switching views must not accumulate GPU geometry.");
  }
  if(baseline)for(const sample of report.resources.filter(value=>value.cycle===2&&!value.hair)){
    const old=report.resourceBaseline.find(value=>value.cycle===2&&value.view===sample.view&&!value.hair);
    if(pixelBaseline)assert(sample.bytes<=old.bytes,`${sample.view}: GPU geometry allocation regressed.`);
    else assert(sample.bytes<old.bytes*.8,`${sample.view}: inactive geometry was not released.`);
  }
  await delay(100);
  const idle=await evaluate("resourceProbe()");
  await delay(300);
  report.idle=await evaluate("resourceProbe()");
  assert.equal(report.idle.draws,idle.draws,"Idle face must not run a continuous render loop.");
  await evaluate(`window.pixelFixture={
    change:(id,value)=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event("input"));},
    pixels:(id="face")=>{const c=document.getElementById(id),g=c.getContext("webgl2"),p=new Uint8Array(c.width*c.height*4);
      g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);return p;},
    difference:(a,b)=>{let count=0;for(let i=0;i<a.length;i+=4)
      if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])count++;return count;}
  };`);
  assert.equal(await evaluate("document.title"),"Verona | fixture | claire");
  for(const view of ["claire","facemesh","facedot","uniform"]){
    const result=await evaluate(`(()=>{
      const f=pixelFixture,a=veronaAppearance,keys=["mesh","eyes","hair","lips","eyebrows"];
      f.change("presentation",${JSON.stringify(view)});
      const h=document.getElementById("hair");h.checked=true;h.dispatchEvent(new Event("input"));
      a.apply(Object.fromEntries(keys.map(k=>[k,null])));
      const original=f.pixels(),changes={};
      const g=document.getElementById("face").getContext("webgl2");
      const allocate=g.bufferData,update=g.bufferSubData;let allocations=0,updates=0;
      g.bufferData=function(...v){allocations++;return allocate.apply(this,v);};
      g.bufferSubData=function(...v){updates++;return update.apply(this,v);};
      try{
        for(const key of keys){
          a.apply({[key]:"#00FF00"});changes[key]=f.difference(original,f.pixels());a.apply({[key]:null});
        }
        const before=a.read();let rejected=false;
        try{a.apply({mesh:"#FF0000",hair:"bad"});}catch{rejected=true;}
        return {view:${JSON.stringify(view)},changes,allocations,updates,rejected,
          atomic:JSON.stringify(before)===JSON.stringify(a.read()),
          reset:f.difference(original,f.pixels()),gl:g.getError()};
      }finally{g.bufferData=allocate;g.bufferSubData=update;}
    })()`);
    for(const [key,changed]of Object.entries(result.changes))assert(changed>0,`${view}/${key}: ${JSON.stringify(result)}`);
    assert.equal(result.allocations,0);assert.equal(result.updates,0);
    assert(result.rejected&&result.atomic);assert.equal(result.reset,0);assert.equal(result.gl,0);
    report.views.push(result);
    if(baseline){
      const current=await evaluate(`(async()=>{
        veronaAppearance.apply({});
        const c=document.getElementById("face"),g=c.getContext("webgl2"),p=new Uint8Array(c.width*c.height*4);
        g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);
        return [...new Uint8Array(await crypto.subtle.digest("SHA-256",p))].map(n=>n.toString(16).padStart(2,"0")).join("");
      })()`);
      assert.equal(current,legacyHashes[view],`${view}: original default pixels changed.`);
    }
  }
  if(baseline)report.legacyDefaultPixels={reference:baselineRef,sha256:legacyHashes};
  report.gui=await evaluate(`(()=>{
    const f=pixelFixture,a=veronaAppearance;
    let events=0;
    window.addEventListener("verona-appearance",()=>events++);
    f.change("hair-hex","#a3f");
    const custom=a.read();
    f.change("hair-hex","invalid");
    const invalid=document.getElementById("hair-hex").validationMessage;
    const unchanged=a.read().hair===custom.hair;
    f.change("lips-color","#ff5500");
    const stillInvalid=document.getElementById("hair-hex").validationMessage;
    document.getElementById("reset-face-colors").click();
    return {custom,invalid:!!invalid,unchanged,stillInvalid:!!stillInvalid,events,reset:a.read()};
  })()`);
  assert.equal(report.gui.custom.hair,"#AA33FF");
  assert(report.gui.invalid&&report.gui.unchanged&&report.gui.stillInvalid);
  assert.equal(report.gui.events,3);
  assert(Object.values(report.gui.reset).every(value=>value===null));
  report.resourceLifecycle=await evaluate(`(()=>{
    const f=pixelFixture,r=rendererFixture,errors=[];
    f.change("presentation","facemesh");
    const h=document.getElementById("hair");h.checked=false;h.dispatchEvent(new Event("input"));
    const before=resourceProbe();
    const motion=new Int16Array(r.meta.vertices*3*3);
    for(let frame=0;frame<3;frame++)motion.set(r.neutralData,frame*r.neutralData.length);
    r.setClip(motion.buffer,{frames:3,vertices:r.meta.vertices,quantization:r.meta.quantization,fps:30});
    r.draw(.05);
    const unlitSlots=r.normalSlots.length;
    const unlitCpuMotion=r.motionData!==null;
    f.change("presentation","claire");r.draw(.05);
    const litSlots=r.normalSlots.length;
    const restoredMotion=r.motionData.every((value,index)=>value===motion[index]);
    f.change("presentation","facemesh");r.draw(.05);
    const returnedSlots=r.normalSlots.length;
    const returnedCpuMotion=r.motionData!==null;
    r.clearClip();
    const cleared=resourceProbe();
    for(let cycle=0;cycle<2;cycle++){
      for(const view of ["claire","facedot","uniform","facemesh"]){
        f.change("presentation",view);
        for(const visible of [true,false]){
          h.checked=visible;h.dispatchEvent(new Event("input"));
          for(const style of ["curly-fade","swept-quiff","curls","claire"]){
            f.change("hairstyle",style);
            if(view!=="facemesh")for(const framing of ["head-neck","full"]){
              f.change("framing",framing);
              if(framing==="head-neck")for(const depth of [0,6,1.7])f.change("neck-depth",String(depth));
            }
            const error=r.gl.getError();if(error)errors.push(error);
          }
        }
      }
    }
    return {before,cleared,after:resourceProbe(),unlitSlots,litSlots,returnedSlots,
      unlitCpuMotion,restoredMotion,returnedCpuMotion,errors};
  })()`);
  assert.equal(report.resourceLifecycle.unlitSlots,0);
  assert.equal(report.resourceLifecycle.litSlots,2);
  assert.equal(report.resourceLifecycle.returnedSlots,0);
  assert.equal(report.resourceLifecycle.unlitCpuMotion,false);
  assert.equal(report.resourceLifecycle.restoredMotion,true);
  assert.equal(report.resourceLifecycle.returnedCpuMotion,false);
  assert.equal(report.resourceLifecycle.before.bytes,report.resourceLifecycle.cleared.bytes);
  assert.equal(report.resourceLifecycle.before.bytes,report.resourceLifecycle.after.bytes);
  assert.deepEqual(report.resourceLifecycle.errors,[]);
  report.cheekiness=[];
  for(const view of ["claire","facemesh","facedot","uniform"]){
    const result=await evaluate(`(()=>{
      const f=pixelFixture,r=rendererFixture;
      f.change("presentation",${JSON.stringify(view)});
      const toggle=document.getElementById("sideways-cheekiness");
      const enable=value=>{toggle.checked=value;toggle.dispatchEvent(new Event("input"));};
      const motion=new Int16Array(r.meta.vertices*3*2);
      motion.set(r.neutralData);motion.set(r.neutralData,r.neutralData.length);
      r.setClip(motion.buffer,{frames:2,vertices:r.meta.vertices,
        quantization:r.meta.quantization,fps:30,expression:"cheekiness",expressionStrength:.6});
      enable(false);r.draw(0);
      const original=f.pixels(),before=resourceProbe();
      f.change("cheekiness-pull","1");enable(true);
      const full=f.pixels(),changed=f.difference(original,full);
      f.change("cheekiness-pull","0");
      const zero=f.difference(original,f.pixels());
      f.change("cheekiness-pull","0.5");
      const half=f.pixels();
      enable(false);
      const disabled=f.difference(original,f.pixels());
      f.change("cheekiness-pull","1");enable(true);
      const restored=f.difference(full,f.pixels()),after=resourceProbe();
      r.clearClip();
      return {view:${JSON.stringify(view)},changed,zero,disabled,restored,
        halfChanged:f.difference(original,half),halfDistinct:f.difference(full,half),
        before,after,gl:r.gl.getError()};
    })()`);
    assert(result.changed>0&&result.halfChanged>0&&result.halfDistinct>0,
      `${view}: native-calibrated cheekiness must visibly respond to strength: ${JSON.stringify(result)}`);
    assert.equal(result.zero,0);assert.equal(result.disabled,0);assert.equal(result.restored,0);
    assert.equal(result.before.bytes,result.after.bytes);
    assert.equal(result.before.uploads,result.after.uploads);
    assert.equal(result.gl,0);
    report.cheekiness.push(result);
  }
  report.blinks=[];
  for(const view of ["claire","facemesh","facedot","uniform"]){
    await evaluate(`pixelFixture.change("presentation",${JSON.stringify(view)})`);
    report.blinks.push(await qualifyBlink(view));
  }
  await evaluate('pixelFixture.change("presentation","facemesh")');
  report.blinkCadence=await qualifyCadence();
  await cdp("Page.navigate",{url:`${origin}/native#fixture`});
  await waitFor('window.mpfbPlayer?.ready');
  await disableBlinking();
  assert.equal(await evaluate("document.title"),"Verona | fixture | mpfb");
  report.native=await evaluate(`(()=>{
    const ids=["wire","surface"],keys=["mesh","eyes","hair","lips","eyebrows"],a=veronaAppearance;
    const pixels=id=>{const c=document.getElementById(id),g=c.getContext("webgl2"),p=new Uint8Array(c.width*c.height*4);
      g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);return p;};
    const difference=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n;};
    const before=ids.map(pixels),changes={};
    for(const key of keys){
      a.apply({[key]:"#00FF00"});changes[key]=ids.map((id,i)=>difference(before[i],pixels(id)));a.apply({[key]:null});
    }
    const uploads=ids.map(id=>{
      const gl=document.getElementById(id).getContext("webgl2"),original=gl.bufferSubData;
      let count=0;gl.bufferSubData=function(...args){count++;return original.apply(this,args);};
      return {gl,original,count:()=>count};
    });
    window.mpfbPlayer.renderAt();
    const uploadCounts=uploads.map(item=>{item.gl.bufferSubData=item.original;return item.count();});
    return {changes,uploadCounts,reset:ids.map((id,i)=>difference(before[i],pixels(id))),
      note:document.getElementById("appearance-note").textContent};
  })()`);
  for(const [key,counts]of Object.entries(report.native.changes))
    assert(counts.every(n=>n>0),`native/${key}: ${JSON.stringify(counts)}`);
  assert.deepEqual(report.native.reset,[0,0]);assert.match(report.native.note,/no hair/);
  assert.deepEqual(report.native.uploadCounts,[1,2],"Unlit MPFB must not upload unused normals.");
  report.blinks.push(await qualifyBlink("native",true));
  report.nativeBlinkCadence=await qualifyCadence(true);
  await evaluate('veronaAppearance.apply({mesh:null,eyes:null,hair:null,lips:null,eyebrows:null})');
  if(baseline){
    const hashNative=()=>evaluate(`(async()=>{
      window.mpfbPlayer.renderAt();
      return Promise.all(["wire","surface"].map(async id=>{
        const c=document.getElementById(id),g=c.getContext("webgl2"),p=new Uint8Array(c.width*c.height*4);
        g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);
        return [...new Uint8Array(await crypto.subtle.digest("SHA-256",p))].map(n=>n.toString(16).padStart(2,"0")).join("");
      }));
    })()`);
    const current=await hashNative();
    await cdp("Page.navigate",{url:`${origin}/legacy-native#fixture`});
    await waitFor('window.mpfbPlayer?.ready');
    await disableBlinking();
    const legacy=await hashNative();
    assert.deepEqual(current,legacy,"Native original default pixels changed.");
    report.legacyDefaultPixels.nativeSha256=legacy;
  }
  await cdp("Page.navigate",{url:`${origin}/mark#${"a".repeat(43)}`});
  await waitFor('window.rendererFixture && !document.getElementById("generate").disabled');
  await disableBlinking();
  report.markHairstyles=await evaluate(`(()=>{
    const r=rendererFixture,$=id=>document.getElementById(id);
    const change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new Event("input"));};
    const initial={style:r.hairStyle,visible:Object.values(r.hairVisible).every(Boolean)};
    const cases=[];
    for(let cycle=0;cycle<3;cycle++)for(const view of ["claire","facemesh","facedot","uniform"]){
      change("presentation",view);
      for(const style of ["curly-fade","swept-quiff"]){
        change("hairstyle",style);r.draw(0);
        const data=r.hairData;
        $("hair").checked=false;$("hair").dispatchEvent(new Event("input"));
        const released=["positions","normals","triangles","edges","meshEdges"].every(key=>!r.hair[key]);
        $("hair").checked=true;$("hair").dispatchEvent(new Event("input"));r.draw(0);
        cases.push({cycle,view,style,selected:r.hairStyle,released,restored:r.hairData===data,
          bytes:resourceProbe().bytes,normals:r.normalSlots.length,error:r.gl.getError()});
      }
    }
    return {initial,cases};
  })()`);
  assert.equal(report.markHairstyles.initial.style,"curly-fade");
  assert(report.markHairstyles.initial.visible);
  for(const sample of report.markHairstyles.cases){
    assert.equal(sample.selected,sample.style);
    assert(sample.released&&sample.restored);
    assert.equal(sample.error,0);
    if(sample.view!=="claire")assert.equal(sample.normals,0);
    const first=report.markHairstyles.cases.find(item=>item.view===sample.view&&item.style===sample.style);
    assert.equal(sample.bytes,first.bytes,"Mark hairstyle changes must not accumulate GPU resources.");
  }
  await cdp("Page.navigate",{url:`${origin}/retired#${"a".repeat(43)}`});
  await waitFor('document.getElementById("error") && !document.getElementById("error").hidden && document.getElementById("error").textContent.includes("retired by its owner")');
  assert.equal(retiredMeshRequests,0,"A retired host must fail before loading a substitute mesh.");
  report.retiredHostRejectedBeforeMesh=true;
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify(report));
}finally{
  await fs.writeFile(path.join(output,"report.json"),JSON.stringify({...report,errors},null,2));
  if(ws?.readyState===WebSocket.OPEN){
    await cdp("Browser.close").catch(()=>{});ws.close();
  }
  if(edge.exitCode===null){
    const exited=new Promise(resolve=>edge.once("exit",resolve));
    edge.kill();await exited;
  }
  await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
  await new Promise(resolve=>server.close(resolve));
}

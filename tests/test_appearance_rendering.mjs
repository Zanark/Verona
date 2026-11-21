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
const baselineRef=process.argv.find(arg=>arg.startsWith("--baseline="))?.slice(11);
const baseline=baselineRef?Object.fromEntries(["app.js","mpfb.js","mpfb-renderer.mjs"].map(name=>
  [name,execFileSync("git",["show",`${baselineRef}:verona/web/${name}`],{encoding:"utf8"})])):null;
// Retained-view comparisons do not restore the retired module's dead import.
if(baseline)baseline["app.js"]=baseline["app.js"].replace(/^import .* from "\/robot\.mjs";\r?\n/m,"");
const meta={center:[0,146,0],scale:12,quantization:10000,identity:"Synthetic fixture"};
const positions=[],triangles=[],edges=[];
const columns=49,rows=85;
for(let y=0;y<rows;y++) for(let x=0;x<columns;x++){
  positions.push(x/4-6,136+y/4,3.8);
  const a=y*columns+x;
  if(x+1<columns)edges.push(a,a+1);
  if(y+1<rows)edges.push(a,a+columns);
  if(x+1<columns&&y+1<rows)triangles.push(a,a+1,a+columns+1,a,a+columns+1,a+columns);
}
const native={rest:positions,polygons:[],eyeCenters:[[-2.9485,147.5517,2.2364],[3.1021,147.4944,2.283]],
  eyeRadii:[[1.3,1.3,1.3],[1.3,1.3,1.3]]};
for(let i=0;i<triangles.length;i+=3){
  const face=triangles.slice(i,i+3);
  const x=face.reduce((sum,id)=>sum+positions[id*3],0)/3;
  const y=face.reduce((sum,id)=>sum+positions[id*3+1],0)/3;
  if(!native.eyeCenters.some(center=>Math.hypot((x-center[0])/1.5,(y-center[1])/1.3)<1))
    native.polygons.push(face);
}
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
const binary=Buffer.concat(chunks);
let nativeMode=false,retiredMode=false,retiredMeshRequests=0;
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,"http://127.0.0.1");
    if(url.pathname==="/favicon.ico"){res.writeHead(204).end();return;}
    if(url.pathname==="/api/session"){
      res.setHeader("Content-Type","application/json");
      res.end(JSON.stringify({mesh:meta,voices:[{name:"Fixture",culture:"en-US"}],defaultVoice:"Fixture",
        limits:{characters:280},appearance:{model:retiredMode?"robot":nativeMode?"mpfb":"claire",session:"fixture",colors:{}}}));
      return;
    }
    if(url.pathname==="/api/mesh"){
      if(retiredMode)retiredMeshRequests++;
      res.setHeader("Content-Type",nativeMode?"application/json":"application/octet-stream");
      res.end(nativeMode?JSON.stringify(native):binary);return;
    }
    let name=url.pathname.slice(1)||"index.html";
    if(name==="retired"){retiredMode=true;nativeMode=false;name="index.html";}
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
  await cdp("Emulation.setDeviceMetricsOverride",{width:1200,height:1000,deviceScaleFactor:1,mobile:false});
  const legacyHashes={};
  if(baseline){
    await cdp("Page.navigate",{url:`${origin}/legacy#${"a".repeat(43)}`});
    await waitFor('document.getElementById("generate") && !document.getElementById("generate").disabled');
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
  await cdp("Page.navigate",{url:`${origin}/native#fixture`});
  await waitFor('window.mpfbPlayer?.ready');
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
    return {changes,reset:ids.map((id,i)=>difference(before[i],pixels(id))),
      note:document.getElementById("appearance-note").textContent};
  })()`);
  for(const [key,counts]of Object.entries(report.native.changes))
    assert(counts.every(n=>n>0),`native/${key}: ${JSON.stringify(counts)}`);
  assert.deepEqual(report.native.reset,[0,0]);assert.match(report.native.note,/no hair/);
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
    const legacy=await hashNative();
    assert.deepEqual(current,legacy,"Native original default pixels changed.");
    report.legacyDefaultPixels.nativeSha256=legacy;
  }
  await cdp("Page.navigate",{url:`${origin}/retired#${"a".repeat(43)}`});
  await waitFor('!document.getElementById("error").hidden && document.getElementById("error").textContent.includes("retired by its owner")');
  assert.equal(retiredMeshRequests,0,"A retired host must fail before loading a substitute mesh.");
  report.retiredHostRejectedBeforeMesh=true;
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify(report));
}finally{
  await fs.writeFile(path.join(output,"report.json"),JSON.stringify({...report,errors},null,2));
  if(ws?.readyState===WebSocket.OPEN){
    await cdp("Browser.close").catch(()=>{});ws.close();
  }
  if(edge.exitCode===null)edge.kill();
  await new Promise(resolve=>server.close(resolve));
}

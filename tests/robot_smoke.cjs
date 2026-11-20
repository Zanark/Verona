const { app } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const output = process.argv.find(a=>a.startsWith("--probe-output=")).slice(15);
const pause = ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.once("browser-window-created",(_event,window)=>{
  window.show=()=>{};
  window.webContents.once("did-finish-load",()=>run(window).catch(async error=>{
    await fs.writeFile(output+".error.json",JSON.stringify({status:"failed",error:error.stack}));
    app.exit(1);
  }));
});
require(path.join(__dirname,"..","desktop","main.cjs"));

async function run(window) {
  const ev=code=>window.webContents.executeJavaScript(code,true);
  const wait=async(code,ms=45000)=>{
    const until=Date.now()+ms;
    while(!await ev(code)){
      const error=await ev('document.getElementById("error")?.hidden === false ? document.getElementById("error").textContent : ""');
      assert(!error,error);
      assert(Date.now()<until,"Renderer workflow timed out");await pause(50);
    }
  };
  await wait('document.getElementById("generate") && !document.getElementById("generate").disabled');
  const prefs=window.webContents.getLastWebPreferences();
  assert(prefs.sandbox&&!prefs.nodeIntegration&&!window.isVisible());
  await ev(`(async()=>{
    document.getElementById("audio").muted=true;document.getElementById("follow-eyes").checked=false;
    await window.veronaDesktop.command("follow",false);await window.veronaDesktop.command("pin",false);
    await window.veronaDesktop.command("overlay");
  })()`);
  window.setContentSize(800,800); await pause(100);
  await ev(`(()=>{
    const $=id=>document.getElementById(id);
    for(const [id,value] of [["presentation","facemesh"],["zoom",2]]){
      $(id).value=String(value);$(id).dispatchEvent(new Event("input"));
    }
  })()`);
  const regression=await fs.readFile(path.join(__dirname,"browser_smoke.mjs"),"utf8");
  const marker="data.mechanicalEyes=await evaluate(\u0060",start=regression.indexOf(marker);
  const end=regression.indexOf("\u0060);",start+marker.length);
  assert(start>=0&&end>start);
  const redEyes=await ev(regression.slice(start+marker.length,end));
  const redMaximum=await ev(`(()=>{
    document.getElementById("zoom").dispatchEvent(new Event("input"));
    const c=document.getElementById("face"),g=c.getContext("webgl2"),p=new Uint8Array(c.width*c.height*4);
    g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);let max=0;
    for(let i=0;i<p.length;i+=4)if(p[i]>p[i+1]*2&&p[i]>p[i+2]*2)max=Math.max(max,p[i]);
    return max;
  })()`);
  await fs.writeFile(output,JSON.stringify({status:"measured",redEyes,redMaximum},null,2));
  for(const eye of redEyes){
    assert(eye.corePixels>10&&eye.hotCorePixels>2&&eye.coreCoronaPixels>10,JSON.stringify(eye));
    assert(eye.ringRedMaximum>=169&&eye.ringRedMaximum<=171,"Outer red rings retain 70% RGB at 95% emission");
    assert.equal(eye.ringBands.length,3);assert(eye.visibleUpperSpokes>=10&&eye.visibleUpperSpokes<=14,JSON.stringify(eye));
  }
  assert(redMaximum>=235&&redMaximum<=255,"Only the new FaceMesh center corona exceeds the dimmed rings");
  const glowMarker="data.eyeGlowVariants=await evaluate(\u0060",glowStart=regression.indexOf(glowMarker);
  const glowEnd=regression.indexOf("\u0060);",glowStart+glowMarker.length);
  assert(glowStart>=0&&glowEnd>glowStart);
  const eyeGlowVariants=await ev(regression.slice(glowStart+glowMarker.length,glowEnd));
  assert.equal(eyeGlowVariants.created,0);assert(eyeGlowVariants.restored);
  for(const v of eyeGlowVariants.variants){
    assert(v.hot>4&&v.hot===eyeGlowVariants.baselineHot);
    assert(v.centerUnchanged);assert.equal(v.error,0);
    for(const eye of v.eyes){
      assert((v.mode==="1"?eye.spoke:eye.outer)>220,JSON.stringify(v));
      assert((v.mode==="1"?eye.outer:eye.spoke)<20,JSON.stringify(v));
    }
  }
  await ev(`(()=>{
    const $=id=>document.getElementById(id);
    for(const [id,value] of [["presentation","claire"],["zoom",1]]){
      $(id).value=String(value);$(id).dispatchEvent(new Event("input"));
    }
  })()`);
  const setup=await ev(`(()=>{
    const $=id=>document.getElementById(id),c=$("face"),g=c.getContext("webgl2");
    window.robotTest={set:(id,v)=>{$(id).value=String(v);$(id).dispatchEvent(new Event("input"));},
      read:()=>{const p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);return p;},
      created:0,deleted:0,draws:0,normalUploads:0};
    const t=window.robotTest,create=g.createBuffer,remove=g.deleteBuffer,draw=g.drawArrays,upload=g.bufferSubData;
    g.createBuffer=function(){t.created++;return create.call(this);};
    g.deleteBuffer=function(b){t.deleted++;return remove.call(this,b);};
    g.drawArrays=function(...args){t.draws++;return draw.apply(this,args);};
    g.bufferSubData=function(...args){t.normalUploads++;return upload.apply(this,args);};
    t.claire=t.read();t.set("presentation","robot");
    const p=t.read();let clear=0,blue=0,silver=0,core=0;
    for(let i=0;i<p.length;i+=4){
      if(!p[i+3])clear++;
      if(p[i+2]>p[i]*1.6&&p[i+2]>p[i+1]*1.25&&p[i+2]>30)blue++;
      if(p[i]>70&&Math.abs(p[i+2]-p[i])<65)silver++;
      if(p[i+1]>180&&p[i+2]>220&&p[i]>85&&p[i]<190)core++;
    }
    t.robot=p;t.initialCreated=t.created;
    return {clear,blue,silver,core,created:t.created,draws:t.draws,error:g.getError(),
      robot:$("presentation").value,framing:$("framing").value,framingDisabled:$("framing").disabled,
      hairHidden:$("hair").closest("label").hidden,hairDisabled:$("hair").disabled,
      description:$("geometry-details").textContent,pose:c.dataset.robotPose};
  })()`);
  await fs.writeFile(output,JSON.stringify({status:"measured",setup,redEyes,redMaximum},null,2));
  assert.equal(setup.error,0); assert(setup.clear>10000&&setup.blue>3000&&setup.silver>500&&setup.core>5,JSON.stringify(setup));
  assert(setup.framingDisabled&&setup.hairHidden&&setup.hairDisabled&&setup.framing==="robot");
  const turning=await ev(`(()=>{
    const t=window.robotTest,$=id=>document.getElementById(id),g=$("face").getContext("webgl2"),start=t.created;
    for(let i=0;i<30;i++){t.set("yaw",Math.sin(i)*1.1);t.set("tilt",Math.cos(i)*.45);t.set("roll",Math.sin(i)*.3);}
    for(const id of ["tilt","yaw","roll"])t.set(id,0);
    const tool=document.getElementById("overlay-toolbar").getBoundingClientRect();
    return {newBuffers:t.created-start,error:g.getError(),toolTop:tool.top,toolLeft:tool.left};
  })()`);
  assert.equal(turning.error,0); assert.equal(turning.newBuffers,0); assert(turning.toolTop>=0);
  await ev(`(()=>{
    const $=id=>document.getElementById(id);$("follow-eyes").checked=true;$("follow-eyes").dispatchEvent(new Event("input"));
  })()`);
  window.webContents.send("verona:cursor",{x:735,y:125}); await pause(150);
  const eyesMode=await ev(`(()=>{
    window.robotTest.set("yaw",0);const c=document.getElementById("face");
    return {gaze:c.dataset.gaze.split(",").map(Number),head:c.dataset.headAngles.split(",").map(Number)};
  })()`);
  await ev('window.robotTest.set("cursor-mode","head")'); await pause(150);
  const headMode=await ev(`(()=>{
    window.robotTest.set("yaw",0);const c=document.getElementById("face");
    return {gaze:c.dataset.gaze.split(",").map(Number),head:c.dataset.headAngles.split(",").map(Number)};
  })()`);
  assert(eyesMode.gaze.some(x=>Math.abs(x)>.01)&&eyesMode.head.every(x=>x===0));
  assert(headMode.head.some(x=>Math.abs(x)>.01)&&headMode.gaze.every(x=>x===0));
  await ev(`(()=>{
    const $=id=>document.getElementById(id);$("follow-eyes").checked=false;$("follow-eyes").dispatchEvent(new Event("input"));
    window.robotTest.set("cursor-mode","eyes");
  })()`);
  await ev('document.getElementById("text").value="Hello, Verona.";document.getElementById("generate").click();');
  await wait('!document.getElementById("generate").disabled && !document.getElementById("play").disabled',100000);
  const motion=await ev(`(async()=>{
    const t=window.robotTest,$=id=>document.getElementById(id),a=$("audio"),poses=[],pixelHashes=[],start=t.created,uploads=t.normalUploads;
    const source=a.src,speechBuffers=t.created-t.initialCreated;
    t.speechBuffers=speechBuffers;
    for(let i=0;i<25;i++){
      a.currentTime=a.duration*i/26;await new Promise(r=>a.addEventListener("seeked",r,{once:true}));
      poses.push($("face").dataset.robotPose);
      const pixels=t.read();let hash=2166136261;
      for(let j=0;j<pixels.length;j+=16)hash=Math.imul(hash^pixels[j],16777619);
      pixelHashes.push(hash>>>0);
    }
    const seekNewBuffers=t.created-start,seekNormalUploads=t.normalUploads-uploads;
    const robotTime=a.currentTime;
    t.set("presentation","claire");const current=t.read();
    const deleted=t.deleted;t.set("presentation","robot");
    t.set("presentation","claire");const restored=t.read();
    let restorationDelta=0;
    for(let i=0;i<current.length;i++)if(current[i]!==restored[i])restorationDelta++;
    t.set("presentation","robot");
    return {poses,pixelHashes,sourcePreserved:source===a.src,timePreserved:robotTime===a.currentTime,
      restorationDelta,speechBuffers,seekNewBuffers,seekNormalUploads,deleted,error:$("face").getContext("webgl2").getError()};
  })()`);
  assert.equal(motion.error,0); assert(motion.sourcePreserved&&motion.timePreserved);
  assert.equal(motion.restorationDelta,0,"Claire pixels must restore at the same speech pose");
  assert.equal(motion.seekNewBuffers,0);
  assert.equal(motion.seekNormalUploads,0);
  assert(new Set(motion.poses).size>5,JSON.stringify(motion));
  assert(new Set(motion.pixelHashes).size>5,"Robot speech must change rendered pixels, not only diagnostic values");
  assert(motion.poses.some(p=>Number(p.split(",")[0])>.01),"Speech never opens robot jaw");
  await ev('document.getElementById("restart").click();document.getElementById("play").click();');
  await wait('!document.getElementById("audio").paused',5000); await pause(180);
  const playback=await ev(`(()=>{
    const $=id=>document.getElementById(id),a=$("audio"),time=a.currentTime;
    $("play").click();return {time,paused:a.paused,source:a.src};
  })()`);
  assert(playback.time>0&&playback.paused);
  const overlay=await ev(`(async()=>{
    const $=id=>document.getElementById(id),a=$("audio"),before=a.currentTime,source=a.src;
    await window.veronaDesktop.command("controls");await window.veronaDesktop.command("overlay");
    $("zoom").dispatchEvent(new Event("input"));
    const c=$("face"),g=c.getContext("webgl2"),p=window.robotTest.read();let boundary=0,clear=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
      const a=p[(y*c.width+x)*4+3];if(!a)clear++;
      if((x===0||y===0||x===c.width-1||y===c.height-1)&&a)boundary++;
    }
    return {sourcePreserved:source===a.src,timePreserved:before===a.currentTime,
      width:c.width,height:c.height,clear,boundary,error:g.getError(),
      collapsed:$("overlay-toggle").getAttribute("aria-expanded")==="false"};
  })()`);
  assert(overlay.sourcePreserved&&overlay.timePreserved&&overlay.collapsed);
  assert(overlay.clear>10000&&overlay.boundary===0&&overlay.error===0,JSON.stringify(overlay));
  const restoration=await ev(`(async()=>{
    const t=window.robotTest,$=id=>document.getElementById(id),a=$("audio");
    $("restart").click();const paused=a.paused&&a.currentTime===0,poses=$("face").dataset.robotPose;
    for(let i=0;i<4;i++){t.set("presentation","claire");t.set("presentation","robot");}
    t.set("presentation","claire");
    return {paused,created:t.created,deleted:t.deleted,error:$("face").getContext("webgl2").getError(),
      restoredHair:!$("hair").disabled&&!$("hair").closest("label").hidden,poses,speechBuffers:t.speechBuffers};
  })()`);
  assert(restoration.paused&&restoration.restoredHair);
  assert.equal(restoration.created-restoration.deleted,restoration.speechBuffers,"Only the unchanged speech buffer may remain");
  assert.equal(restoration.error,0);
  const previousViews=await ev(`(()=>{
    const $=id=>document.getElementById(id),g=$("face").getContext("webgl2"),source=$("audio").src,time=$("audio").currentTime,result=[];
    for(const id of ["facemesh","facedot","uniform","claire"]){
      window.robotTest.set("presentation",id);const p=window.robotTest.read();let visible=0;
      for(let i=3;i<p.length;i+=4)if(p[i])visible++;
      result.push({id,visible,error:g.getError(),sourcePreserved:source===$("audio").src,timePreserved:time===$("audio").currentTime});
    }
    return result;
  })()`);
  assert(previousViews.every(v=>v.visible>500&&v.error===0&&v.sourcePreserved&&v.timePreserved));
  assert(!window.isVisible()&&!window.isAlwaysOnTop());
  await fs.writeFile(output,JSON.stringify({status:"passed",setup,turning,eyesMode,headMode,motion,playback:{time:playback.time,paused:playback.paused},
    overlay,restoration,previousViews,redEyes,redMaximum,eyeGlowVariants,
    noImagesCaptured:true,hiddenSandboxedWindow:true},null,2));
  app.quit();
}

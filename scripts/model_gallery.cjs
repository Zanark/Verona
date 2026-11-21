const {app, BrowserWindow} = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const output = process.argv.find(arg => arg.startsWith("--output=")).slice(9);
const profile = process.argv.find(arg => arg.startsWith("--user-data-dir=")).slice(16);
app.setPath("userData", profile);
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("disable-component-update");
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const deadline = setTimeout(() => app.exit(1), 290000);
app.whenReady().then(async () => {
  const window = new BrowserWindow({show:false, width:980, height:1000, useContentSize:true,
    webPreferences:{sandbox:true, contextIsolation:true, nodeIntegration:false,
      backgroundThrottling:false, offscreen:true}});
  window.webContents.on("paint", () => {});
  const origin = new URL(process.env.VERONA_LOCAL_URL).origin, errors = [], external = [];
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const allowed = details.url.startsWith(origin + "/") || details.url.startsWith(`blob:${origin}/`);
    if (!allowed) external.push(details.url.split("#")[0]);
    callback({cancel:!allowed});
  });
  window.webContents.on("console-message", (_event, level, message) => {
    if (level >= 3) errors.push(message);
  });
  const ev = code => window.webContents.executeJavaScript(code, true);
  await window.loadURL(process.env.VERONA_LOCAL_URL);
  for (let i=0; !await ev("Boolean(window.galleryRenderer)"); i++) {
    assert(i < 400, "The isolated production renderer failed to become ready.");
    await pause(25);
  }
  const catalog = await ev(`(async()=>{
    const request=async name=>{const response=await fetch("/gallery/"+name,{
      headers:{"X-Verona-Token":location.hash.slice(1)}});if(!response.ok)throw Error("Gallery fixture unavailable.");return response;};
    window.galleryRequest=request;
    const catalog=await(await request("clips.json")).json();
    const $=id=>document.getElementById(id);
    const blink=$("natural-blink");blink.checked=false;blink.dispatchEvent(new Event("input"));
    if($("follow-eyes")){$("follow-eyes").checked=false;$("follow-eyes").dispatchEvent(new Event("input"));}
    window.galleryCatalog=catalog;
    return catalog;
  })()`);
  const views = ["Surface", "FaceMesh", "FaceDot", "UniformPolygons"];
  const captures = [];
  await fs.mkdir(path.join(output, "frames"));
  for (let emotion=0; emotion<catalog.clips.length; emotion++) {
    const info = catalog.clips[emotion];
    const result = await ev(`(async()=>{
      const $=id=>document.getElementById(id),info=galleryCatalog.clips[${emotion}];
      const fps=galleryCatalog.previewFps;
      const bytes=await(await galleryRequest(info.filename)).arrayBuffer();
      galleryRenderer.setClip(bytes,info.metadata);
      const count=Math.ceil(info.metadata.duration*fps);
      if(count<2||count>40)throw Error("Synthetic gallery clip exceeds the bounded 40-frame composite.");
      const labels={neutral:"Neutral",happy:"Joy / Happy",sad:"Sadness",surprised:"Amazement",
        angry:"Anger",cheekiness:"Cheekiness",disgust:"Disgust",fear:"Fear",grief:"Grief",
        outofbreath:"Out of breath",pain:"Pain"};
      const names={claire:"ORIGINAL CLAIRE",mpfb:"NATIVE MPFB",mark:"ORIGINAL MARK",
        "reference-structure":"STRUCTURAL-REFERENCE CLAIRE",
        "reference-shell":"HISTORICAL SUBTLE-REFERENCE CLAIRE","male-sharp":"MALE-SHARPJAWLINE"};
      const canvases=Array.from({length:count},()=>{
        const c=document.createElement("canvas");c.width=960;c.height=1080;
        const g=c.getContext("2d");g.fillStyle="#081018";g.fillRect(0,0,960,1080);
        g.textAlign="center";g.textBaseline="middle";
        g.fillStyle="#6ef5db";g.font='600 28px "Segoe UI"';
        g.fillText(names[galleryCatalog.model],480,30);
        g.fillStyle="#edf5f5";g.font='600 23px "Segoe UI"';
        g.fillText(labels[info.name]+"  |  Hey, how are you?",480,67);
        g.fillStyle="#b7cacc";g.font='17px "Segoe UI"';
        g.fillText("One speech clip. Four views. Same timestamps.",480,1055);
        return c;
      });
      const set=(id,value)=>{const input=$(id);if(!input)throw Error("Missing capture control: "+id);
        if(input.type==="checkbox")input.checked=value;else input.value=String(value);
        input.dispatchEvent(new Event("input"));};
      const viewIds=["claire","facemesh","facedot","uniform"];
      const viewNames=["Surface","FaceMesh","FaceDot","UniformPolygons"];
      const {createBlinkClock}=await import("/blinking.mjs");
      for(let view=0;view<viewIds.length;view++){
        let canvas;
          set("presentation",viewIds[view]);set("framing",viewIds[view]==="facemesh"?"front":"head-neck");
          set("hair",view===0);set("tilt",0);set("yaw",0);set("roll",0);set("zoom",.9);
          if(view===0)set("appearance",${emotion}%2?"polygon":"shaded");
          if(view===1){set("mesh-detail",5);set("eye-glow",1);}
          if(view===2){set("pattern-density",.75);set("pattern-gap",.2);}
          canvas=$("face");canvas.style.cssText="position:fixed;inset:0;width:440px;height:440px";
        let now=0,fire;const clock=createBlinkClock(()=>{},{
          now:()=>now,random:()=>0,schedule:callback=>{fire=callback;return 1;},cancel:()=>{}});
        clock.setActive(true);let begun=false;
        for(let i=0;i<count;i++){
          const time=i*info.metadata.duration/count;
          if(time>=1&&!begun){now=1000;fire();begun=true;}
          now=time*1000;const blink=clock.sample().amount;
          galleryRenderer.draw(time,blink);
          const gl=canvas.getContext("webgl2");gl.finish();
          if(gl.getError()!==0)throw Error("Gallery WebGL draw failed.");
          const ctx=canvases[i].getContext("2d");
          const x=20+(view%2)*480,y=112+Math.floor(view/2)*484;
          ctx.drawImage(canvas,x,y,440,440);
          ctx.fillStyle="#b7cacc";ctx.font='600 19px "Segoe UI"';
          const caption=viewNames[view]+(view===0?(${emotion}%2?" | transparent polygons":" | color + makeup"):"");
          ctx.fillText(caption,x+220,y-18);
        }
        clock.setActive(false);
      }
      window.galleryComposites=canvases;
      return {count,duration:info.metadata.duration,name:info.name};
    })()`);
    const images = [];
    for (let i=0; i<result.count; i++) {
      const png = await ev(`galleryComposites[${i}].toDataURL("image/png").split(",")[1]`);
      const filename = `frames/${info.name}-${String(i).padStart(3,"0")}.png`;
      await fs.writeFile(path.join(output, filename), Buffer.from(png, "base64"));
      images.push(filename);
    }
    await ev("galleryComposites.forEach(c=>{c.width=c.height=1;});galleryComposites=[];");
    captures.push({name:result.name,duration:result.duration,images});
  }
  assert.equal(errors.length, 0, errors.join("\n"));
  assert.equal(external.length, 0, JSON.stringify(external));
  assert(!window.isVisible());
  await fs.writeFile(path.join(output,"capture.json"),JSON.stringify({
    model:catalog.model,clips:captures,views,previewFps:catalog.previewFps,
    sourceFps:30,dimensions:[960,1080],hidden:true,sandbox:true,
    errors,external,speechPlayback:false,
    limits:"Offline sampled production draws; fixed synthetic greeting, not runtime FPS or listening acceptance.",
  },null,2));
  clearTimeout(deadline);
  app.quit();
}).catch(async error => {
  await fs.writeFile(path.join(output,"capture-error.txt"),error.stack);
  clearTimeout(deadline);
  app.exit(1);
});

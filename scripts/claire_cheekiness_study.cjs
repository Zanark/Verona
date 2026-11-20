const {app, BrowserWindow} = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const output = process.argv.find(a => a.startsWith("--output=")).slice(9);
const profile = process.argv.find(a => a.startsWith("--user-data-dir=")).slice(16);
app.setPath("userData", profile);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const deadline = setTimeout(() => app.exit(1), 110000);

app.whenReady().then(async () => {
  const window = new BrowserWindow({show:false, width:640, height:640, useContentSize:true,
    webPreferences:{sandbox:true, contextIsolation:true, nodeIntegration:false,
      backgroundThrottling:false, offscreen:true}});
  window.webContents.setFrameRate(60);
  window.webContents.on("paint", () => {});
  const errors = [], external = [];
  window.webContents.on("console-message", (_event, level, message) => {
    if (level >= 3) errors.push(message);
  });
  const origin = new URL(process.env.VERONA_LOCAL_URL).origin;
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const allowed = details.url.startsWith(origin + "/")
      || /^(data:|blob:|about:)/.test(details.url);
    if (!allowed) external.push(details.url.split("#")[0]);
    callback({cancel:!allowed});
  });
  const ev = code => window.webContents.executeJavaScript(code, true);
  await window.loadURL(process.env.VERONA_LOCAL_URL);
  for (let i=0; !await ev("Boolean(window.cheekinessStudy && window.studyRenderer)"); i++) {
    assert(i < 200, "The isolated renderer did not become ready.");
    await pause(25);
  }
  assert(!window.isVisible());
  const preferences = window.webContents.getLastWebPreferences();
  assert(preferences.sandbox && preferences.contextIsolation && !preferences.nodeIntegration);
  const result = await ev(`(() => {
    const $=id=>document.getElementById(id), r=studyRenderer, data=cheekinessStudy;
    document.documentElement.classList.add("overlay");
    $("face").style.cssText="position:fixed;inset:0;width:640px;height:640px";
    $("follow-eyes").checked=false;
    const set=(id,value)=>{$(id).value=String(value);$(id).dispatchEvent(new Event("input"));};
    set("presentation","facemesh");set("mesh-detail",5);
    $("hair").checked=false;$("hair").dispatchEvent(new Event("input"));
    set("tilt",0);set("yaw",0);set("roll",0);set("zoom",.85);set("eye-glow",1);
    const decode=value=>Uint8Array.from(atob(value), c=>c.charCodeAt(0)).buffer;
    const frames=[decode(data.current),decode(data.candidate)];
    const canvas=document.createElement("canvas");canvas.width=1280;canvas.height=736;
    document.body.append(canvas);canvas.style.display="none";
    const ctx=canvas.getContext("2d");
    window.drawCheekiness=time=>{
      const started=performance.now();
      ctx.fillStyle="#081018";ctx.fillRect(0,0,1280,736);
      ctx.textAlign="center";ctx.textBaseline="middle";
      for(let side=0;side<2;side++){
        r.setClip(frames[side],data.metadata);r.draw(time);r.gl.finish();
        ctx.drawImage($("face"),side*640,38,640,640);
        ctx.fillStyle=side?"#ffc071":"#57e7db";ctx.font='600 23px "Segoe UI"';
        ctx.fillText(side?"PROPOSED SIDEWAYS LIP PULL":"CURRENT CLAIRE CHEEKINESS",side*640+320,22);
      }
      ctx.fillStyle="#bad4d4";ctx.font='18px "Segoe UI"';
      ctx.fillText("Same 4x source | strength 0.60 | hair off | "+time.toFixed(2)+" s",640,712);
      if(r.gl.getError()!==0)throw Error("Comparison WebGL error.");
      return performance.now()-started;
    };
    drawCheekiness(.8);
    const png=canvas.toDataURL("image/png").split(",")[1];
    const detail=document.createElement("canvas");detail.width=1280;detail.height=300;
    const crop=detail.getContext("2d");
    crop.fillStyle="#081018";crop.fillRect(0,0,1280,300);
    for(let side=0;side<2;side++){
      crop.drawImage(canvas,side*640+140,365,360,150,side*640,0,640,267);
      crop.textAlign="center";crop.fillStyle=side?"#ffc071":"#57e7db";
      crop.font='18px "Segoe UI"';crop.fillText(side?"PROPOSED":"CURRENT",side*640+320,292);
    }
    const mouth=detail.toDataURL("image/png").split(",")[1];
    window.cheekinessFrame=time=>{
      const completedGpuDrawMs=drawCheekiness(time);
      return {png:canvas.toDataURL("image/png").split(",")[1],completedGpuDrawMs};
    };
    return {png,mouth,sourceFrames:data.metadata.frames,duration:data.metadata.duration,
      sourceFps:data.metadata.fps,fit:r.fit,
      limits:"Offline sampled comparison, not live performance or human accuracy acceptance."};
  })()`);
  const {png, mouth, ...receipt} = result;
  await fs.mkdir(path.join(output,"frames"));
  const frames=[], timings=[];
  const fps=12, count=Math.ceil(receipt.duration*fps);
  for(let i=0;i<count;i++){
    const time=Math.min(i/fps,receipt.duration-.001);
    const frame=await ev(`cheekinessFrame(${time})`);
    const filename=`frames/frame-${String(i).padStart(3,"0")}.png`;
    await fs.writeFile(path.join(output,filename),Buffer.from(frame.png,"base64"));
    frames.push({time,filename});timings.push(frame.completedGpuDrawMs);
  }
  timings.sort((a,b)=>a-b);
  assert.equal(errors.length, 0, errors.join("\n"));
  assert.equal(external.length, 0, JSON.stringify(external));
  await fs.writeFile(path.join(output,"comparison.png"),Buffer.from(png,"base64"));
  await fs.writeFile(path.join(output,"mouth-detail.png"),Buffer.from(mouth,"base64"));
  await fs.writeFile(path.join(output,"capture.json"),JSON.stringify({
    ...receipt,frames,previewFps:fps,completedGpuDrawMedianMs:timings[Math.floor(timings.length/2)],
    errors,external,hidden:true,sandbox:true,sameCameraAndTopology:true,
  },null,2));
  clearTimeout(deadline);
  app.quit();
}).catch(async error => {
  await fs.writeFile(path.join(output,"capture-error.txt"),error.stack);
  clearTimeout(deadline);
  app.exit(1);
});

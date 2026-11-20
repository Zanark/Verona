const {app,BrowserWindow}=require("electron");
const assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path");
const {fileURLToPath}=require("node:url");
const argument=prefix=>process.argv.find(value=>value.startsWith(prefix)).slice(prefix.length);
const output=path.resolve(argument("--output=")),profile=path.resolve(argument("--user-data-dir="));
app.setPath("userData",profile);app.setPath("sessionData",profile);
const deadline=setTimeout(()=>app.exit(1),180000);
async function reviewReport(){
  const window=new BrowserWindow({show:false,width:1280,height:900,useContentSize:true,
    webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});
  window.webContents.on("paint",()=>{});
  const external=[];
  window.webContents.session.webRequest.onBeforeRequest((details,callback)=>{
    const allowed=/^(data:|about:)/.test(details.url)||(details.url.startsWith("file:")
      &&fileURLToPath(details.url).startsWith(output+path.sep));
    if(!allowed)external.push(details.url);
    callback({cancel:!allowed});
  });
  const ev=code=>window.webContents.executeJavaScript(code,true);
  await window.loadFile(path.join(output,"review.html"));
  const media=await ev(`(async()=>{
    await document.fonts.ready;
    await Promise.all([...document.images].map(image=>image.decode()));
    return {images:[...document.images].map(image=>({src:image.getAttribute("src"),width:image.naturalWidth,height:image.naturalHeight})),
      audioPaused:document.querySelector("audio").paused,
      autoplay:document.querySelector("audio").autoplay,
      missingErrorHidden:document.getElementById("media-error").hidden};
  })()`);
  assert.equal(media.images.length,12);
  assert(media.images.every(image=>image.width===960&&image.height===552));
  assert(media.audioPaused&&!media.autoplay&&media.missingErrorHidden);
  const layouts=[];
  for(const [width,height] of [[1280,900],[390,844]]){
    window.setContentSize(width,height);
    await ev("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
    const layout=await ev(`(()=>{
      const bounds=[...document.images].map(image=>image.getBoundingClientRect());
      return {width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,
        imagesInside:bounds.every(rect=>rect.left>=0&&rect.right<=innerWidth)};
    })()`);
    assert(layout.overflow<=1&&layout.imagesInside,JSON.stringify(layout));
    const image=await window.webContents.capturePage();
    assert(!image.isEmpty());
    await fs.writeFile(path.join(output,`reader-${width}.png`),image.toPNG());
    layouts.push(layout);
  }
  const visibleFailure=await ev(`(async()=>{
    const image=document.images[0];
    image.src="missing-report-image.gif";
    await new Promise(resolve=>image.addEventListener("error",resolve,{once:true}));
    const error=document.getElementById("media-error");
    return !error.hidden&&error.getBoundingClientRect().height>0&&error.textContent.includes("missing-report-image.gif");
  })()`);
  assert(visibleFailure);assert.equal(external.length,0);
  const receipt={media,layouts,visibleMissingImageFailure:visibleFailure,external,
    hiddenSandboxedWindow:!window.isVisible()&&window.webContents.getLastWebPreferences().sandbox};
  await fs.writeFile(path.join(output,"reader.json"),JSON.stringify(receipt,null,2));
  window.destroy();clearTimeout(deadline);app.quit();
}
app.whenReady().then(async()=>{
  if(process.argv.includes("--review"))return reviewReport();
  const receipt=JSON.parse(await fs.readFile(path.join(output,"receipt.json"),"utf8"));
  const model=JSON.parse(await fs.readFile(path.join(output,"model.json"),"utf8"));
  const renderer=(await fs.readFile(path.join(__dirname,"..","verona","web","mpfb-renderer.mjs"),"utf8"))
    .replace("export function","function");
  const window=new BrowserWindow({show:false,width:960,height:552,useContentSize:true,
    webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});
  const errors=[];
  window.webContents.on("console-message",(_event,level,message)=>{if(level>=3)errors.push(message);});
  window.webContents.session.webRequest.onBeforeRequest((details,callback)=>{
    callback({cancel:!details.url.startsWith("data:")&&!details.url.startsWith("about:")});
  });
  const ev=code=>window.webContents.executeJavaScript(code,true);
  await window.loadURL("data:text/html,"+encodeURIComponent('<html><body style="margin:0"><canvas id="shaded" width="480" height="480"></canvas><canvas id="wire" width="480" height="480"></canvas></body></html>'));
  await ev(`(()=>{
    ${renderer}
    const model=${JSON.stringify(model)},rest=Float32Array.from(model.rest);
    const shaded=document.getElementById("shaded"),wire=document.getElementById("wire");
    const draws=[createStudyRenderer(shaded,model,true),createStudyRenderer(wire,model,false)];
    draws.forEach(draw=>draw.setColors({eyes:"#AAB9C4"}));
    const canvas=document.createElement("canvas");canvas.width=960;canvas.height=552;
    const ctx=canvas.getContext("2d");
    window.setMotion=encoded=>{
      const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
      window.motion=new Float32Array(bytes.buffer);
    };
    window.renderMark=(frame,yaw,label)=>{
      const pose=window.motion.subarray(frame*rest.length,(frame+1)*rest.length);
      if(pose.length!==rest.length)throw Error("Missing actual Mark pose.");
      ctx.fillStyle="#081018";ctx.fillRect(0,0,960,552);
      ctx.font='600 19px "Segoe UI"';ctx.textAlign="center";ctx.fillStyle="#91e2cc";
      ctx.fillText(label,480,26);
      draws[0](pose,yaw);draws[1](pose,yaw);
      ctx.drawImage(shaded,0,36);ctx.drawImage(wire,480,36);
      ctx.fillStyle="#a9bacb";ctx.font='14px "Segoe UI"';
      ctx.fillText("ACTUAL MARK | GRAY SURFACE",240,540);
      ctx.fillText("SAME POSE | TRIANGLE WIRE",720,540);
      const pixels=ctx.getImageData(0,0,960,552).data;
      let light=0,cyan=0;
      for(let y=36;y<516;y++)for(let x=0;x<960;x++){
        const i=(y*960+x)*4;
        if(x<480&&pixels[i]>75&&pixels[i+1]>75&&pixels[i+2]>75)light++;
        if(x>=480&&pixels[i]<115&&pixels[i+1]>160&&pixels[i+2]>150)cyan++;
      }
      if(light<5000||cyan<1000)throw Error("Encoded canvas lacks actual shaded/wire geometry: "+light+"/"+cyan);
      return canvas.toDataURL("image/png").split(",")[1];
    };
  })()`);
  const clips=[{name:"turntable",label:"MARK REST SHAPE | NO SPEECH",filename:"rest.bin",frames:1,duration:4},
    ...receipt.clips];
  const capture={clips:[],width:960,height:552,scope:"Actual pinned Mark geometry and CPU motion, deterministic canvas PNGs; not live cadence or human acceptance."};
  for(const clip of clips){
    const bytes=await fs.readFile(path.join(output,clip.filename));
    assert.equal(bytes.length,clip.frames*receipt.displayVertices*3*4);
    await ev(`setMotion(${JSON.stringify(bytes.toString("base64"))})`);
    const directory=path.join(output,"frames",clip.name);await fs.mkdir(directory,{recursive:true});
    const count=Math.max(2,Math.round(clip.duration*12)),images=[],samples=[];
    for(let i=0;i<count;i++){
      const time=i*clip.duration/count,frame=Math.min(clip.frames-1,Math.floor(time*30));
      const yaw=clip.name==="turntable"?65*Math.sin(i/count*2*Math.PI):0;
      const label=clip.name==="turntable"?clip.label:clip.label.toUpperCase()+" | NATIVE 1x | "+time.toFixed(2)+" s";
      const png=await ev(`renderMark(${frame},${yaw},${JSON.stringify(label)})`);
      const filename=`frames/${clip.name}/${String(i).padStart(3,"0")}.png`;
      await fs.writeFile(path.join(output,filename),Buffer.from(png,"base64"));
      images.push(filename);samples.push({time,sourceFrame:frame,yaw});
    }
    capture.clips.push({name:clip.name,duration:clip.duration,images,samples});
  }
  assert.equal(errors.length,0,errors.join("\n"));
  const preferences=window.webContents.getLastWebPreferences();
  assert(preferences.sandbox&&preferences.contextIsolation&&!preferences.nodeIntegration&&!window.isVisible());
  capture.hiddenSandboxedWindow=true;capture.errors=errors;
  await fs.writeFile(path.join(output,"capture.json"),JSON.stringify(capture,null,2));
  window.destroy();clearTimeout(deadline);app.quit();
}).catch(async error=>{
  const stage=process.argv.includes("--review")?"reader":"capture";
  await fs.writeFile(path.join(output,stage+"-error.json"),JSON.stringify({error:error.stack}));
  clearTimeout(deadline);app.exit(1);
});

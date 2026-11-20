const {app, BrowserWindow, nativeImage} = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const argument = prefix => process.argv.find(value=>value.startsWith(prefix)).slice(prefix.length);
const output=path.resolve(argument("--qualification-output="));
app.setPath("userData",path.resolve(argument("--user-data-dir=")));
app.setPath("sessionData",path.resolve(argument("--user-data-dir=")));
const report={checks:[],scope:"Actual player markup/styles and MPFB WebGL renderer in an owned offscreen Electron; layout/alpha fixtures, not speech or human acceptance."};
app.whenReady().then(async()=>{
  await fs.mkdir(output,{recursive:true});
  const web=path.join(__dirname,"..","verona","web");
  const window=new BrowserWindow({show:false,width:1280,height:1000,transparent:true,
    backgroundColor:"#00000000",webPreferences:{
    offscreen:true,sandbox:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
  const evaluate=code=>window.webContents.executeJavaScript(code,true);
  async function capture(name,native=false,mesh=false){
    await evaluate(`new Promise(resolve=>{
      let frames=0;
      function paint(){window.layoutRender?.();if(++frames<3)requestAnimationFrame(paint);else resolve();}
      requestAnimationFrame(paint);
    })`);
    const areas=native?await evaluate(`[document.querySelector(".session-menu summary"),
      ...(document.querySelector(".session-menu").open?[document.querySelector(".session-menu>div")]:[])]
      .map(element=>{const r=element.getBoundingClientRect();return {x:r.x+4,y:r.y+4};})`):[];
    const png=await new Promise((resolve,reject)=>{
      let lastPNG,lastObservation;
      const painted=(_event,_dirty,image)=>{
        const size=image.getSize(),expected=window.getContentSize();
        if(image.isEmpty()||size.width!==expected[0]||size.height!==expected[1]){
          window.webContents.invalidate();return;
        }
        const encoded=image.toPNG();
        if(!encoded.length){setImmediate(()=>window.webContents.invalidate());return;}
        const bitmap=nativeImage.createFromBuffer(encoded).toBitmap();
        lastPNG=encoded;lastObservation={name,corner:[...bitmap.subarray(0,4)]};
        let ready=native?bitmap[3]===0:
          bitmap[0]===24&&bitmap[1]===17&&bitmap[2]===12&&bitmap[3]===255;
        if(native)ready=ready&&areas.every(point=>bitmap[(Math.floor(point.y)*size.width+Math.floor(point.x))*4+3]>0);
        if(mesh){
          let cyan=0;
          for(let i=0;i<bitmap.length;i+=4)if(bitmap[i+1]>180&&bitmap[i]>150&&bitmap[i+2]<110)cyan++;
          lastObservation.cyan=cyan;
          ready=ready&&cyan>1000;
        }
        if(!ready){setImmediate(()=>window.webContents.invalidate());return;}
        window.webContents.removeListener("paint",painted);
        clearTimeout(timeout);resolve(encoded);
      };
      const timeout=setTimeout(async()=>{
        window.webContents.removeListener("paint",painted);
        report.lastRejectedCapture=lastObservation;
        if(lastPNG)await fs.writeFile(path.join(output,"rejected-"+name),lastPNG);
        reject(new Error("Owned offscreen player did not paint the expected content."));
      },5000);
      window.webContents.on("paint",painted);window.webContents.invalidate();
    });
    await fs.writeFile(path.join(output,name),png);
  }
  const model=JSON.parse(await fs.readFile(path.join(__dirname,"..",".local","qualification","mpfb-head-04","authored","head.json"),"utf8"));
  const renderer=(await fs.readFile(path.join(web,"mpfb-renderer.mjs"),"utf8")).replace("export function","function");
  const sessionSource=(await fs.readFile(path.join(web,"session-controls.mjs"),"utf8")).replace("export function","function");
  for(const name of ["index","mpfb"]){
    const [html,css]=await Promise.all([
      fs.readFile(path.join(web,`${name}.html`),"utf8"),
      fs.readFile(path.join(web,name==="index"?"style.css":"mpfb.css"),"utf8")]);
    const page=html.replace(/<link[^>]*stylesheet[^>]*>/,`<style>${css}</style>`)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,"");
    await window.loadURL("data:text/html,"+encodeURIComponent(page));
    if(name==="mpfb")await evaluate(`(()=>{
      ${renderer}
      const model=${JSON.stringify(model)},rest=Float32Array.from(model.rest);
      const draws=[createStudyRenderer(document.getElementById("wire"),model,false),
        createStudyRenderer(document.getElementById("surface"),model,true)];
      window.layoutRender=()=>draws.forEach(draw=>draw(rest,0));window.layoutRender();
    })()`);
    for(const width of [1280,640,360]){
      window.setContentSize(width,1000);
      await evaluate(`${width===1280?"":'document.querySelectorAll("details").forEach(element=>element.open=true);'}window.scrollTo(0,0)`);
      assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,`${name} ${width}px`);
      await capture(`${name}-${width}.png`,false,name==="mpfb"&&width===1280);
      if(name==="mpfb"&&width!==1280){
        await evaluate(`document.querySelector(".views").scrollIntoView({block:"start"})`);
        await capture(`${name}-${width}-model.png`,false,true);
      }
    }
    report.checks.push(`${name}: default 1280px and expanded 640/360px settings fit without horizontal overflow.`);
    if(name==="mpfb"){
      const shared=await fs.readFile(path.join(web,"session-controls.css"),"utf8");
      window.setContentSize(480,600);
      await window.loadURL("data:text/html,"+encodeURIComponent(page
        .replace('<html lang="en">','<html lang="en" class="desktop overlay">')
        .replace("</head>",`<style>${shared}</style></head>`)));
      const native=await evaluate(`(()=>{
        ${renderer}\n${sessionSource}
        attachSessionControls({command:async(_,value)=>({pinned:value}),agentControls:async()=>{}},error=>{throw error;});
        const canvas=document.getElementById("wire"),model=${JSON.stringify(model)};
        const draw=createStudyRenderer(canvas,model,false,false,true),rest=Float32Array.from(model.rest);
        window.layoutRender=()=>draw(rest,0);window.layoutRender();
        const gl=canvas.getContext("webgl2"),pixels=new Uint8Array(canvas.width*canvas.height*4);
        gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let transparent=0,opaque=0;
        for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)transparent++;if(pixels[i]===255)opaque++;}
        return {alpha:gl.getContextAttributes().alpha,transparent,opaque,
          corners:[pixels[3],pixels[canvas.width*4-1],pixels[pixels.length-1],pixels[pixels.length-canvas.width*4+3]],
          overflow:document.documentElement.scrollWidth>innerWidth,
          hiddenSpeech:document.getElementById("text").getClientRects().length===0,
          hiddenPin:document.getElementById("pin-overlay").getClientRects().length===0};
      })()`);
      assert.equal(native.alpha,true);assert(native.transparent>10000&&native.opaque>1000);
      assert.deepEqual(native.corners,[0,0,0,0]);assert.equal(native.overflow,false);
      assert.equal(native.hiddenSpeech,true);assert.equal(native.hiddenPin,true);
      await capture("mpfb-native-collapsed.png",true);
      await evaluate(`document.querySelector(".session-menu").open=true`);
      await capture("mpfb-native-expanded.png",true);
      assert.equal(await evaluate(`document.getElementById("pin-overlay").getClientRects().length>0`),true);
      await evaluate(`document.getElementById("error").textContent="Synthetic explicit failure; restart this head."`);
      assert.equal(await evaluate(`document.getElementById("error").getClientRects().length>0`),true);
      report.native=native;
      report.checks.push("MPFB native layout hides workspace chrome, retains its collapsed pin/name and visible failure recovery; actual WebGL has transparent corners and opaque head pixels.");
    }
  }
  window.destroy();
  await fs.writeFile(path.join(output,"player-layout-report.json"),JSON.stringify(report,null,2));
  app.quit();
}).catch(async error=>{
  report.error=error.stack;
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,"player-layout-report.json"),JSON.stringify(report,null,2));
  app.exit(1);
});

import assert from "node:assert/strict";

export async function checkFaceColors({ evaluate, check, generate, waitFor, click, cdp, screenshot, report }) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false });
  await check("Default colors preserve the existing renderer and controls cover every presentation", async () => {
    assert.equal(await evaluate(`document.getElementById("mesh-colors-control").hidden`), false);
    const data = await evaluate(`(() => {
      const $=id=>document.getElementById(id);
      window.colorCheck={
        change:(id,value)=>{$(id).value=value;$(id).dispatchEvent(new Event("input"));},
        pixels:()=>{const c=$("face"),g=c.getContext("webgl2"),p=new Uint8Array(c.width*c.height*4);
          g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);return p;},
        counts:()=>{const p=colorCheck.pixels();let red=0,green=0,blue=0,white=0;
          for(let i=0;i<p.length;i+=4){if(p[i]>p[i+1]+40&&p[i]>p[i+2]+40)red++;
            if(p[i+1]>p[i]+40&&p[i+1]>p[i+2]+40)green++;
            if(p[i+2]>p[i]+40&&p[i+2]>p[i+1]+40)blue++;
            if(Math.min(p[i],p[i+1],p[i+2])>150&&Math.max(p[i],p[i+1],p[i+2])-Math.min(p[i],p[i+1],p[i+2])<15)white++;}
          return {red,green,blue,white};},
        difference:(a,b)=>{let changed=0,maximum=0;for(let i=0;i<a.length;i+=4){
          const d=Math.max(...[0,1,2].map(n=>Math.abs(a[i+n]-b[i+n])));
          if(d){changed++;maximum=Math.max(maximum,d);}}return {changed,maximum};}
      };
      colorCheck.change("presentation","facemesh");
      const g=$("face").getContext("webgl2"),program=g.getParameter(g.CURRENT_PROGRAM);
      return {hidden:$("mesh-colors-control").hidden,disabled:$("mesh-colors-control").disabled,
        mesh:Array.from(g.getUniform(program,g.getUniformLocation(program,"color"))),
        custom:g.getUniform(program,g.getUniformLocation(program,"customEyeColor")),
        controls:["mesh-color","eyes-color"].map(id=>$(id).type),gl:g.getError()};
    })()`);
    assert.equal(data.hidden, false); assert.equal(data.disabled, false);
    assert.equal(data.custom, false); assert.equal(data.gl, 0);
    data.mesh.forEach((v, i) => assert(Math.abs(v - [.30, .91, .86][i]) < 1e-6));
    assert.deepEqual(data.controls, ["color", "color"]);
  });
  await check("Hex and picker independently change actual mesh and optical pixels in every glow mode", async () => {
    const data = await evaluate(`(() => {
      const $=id=>document.getElementById(id),c=colorCheck;c.change("mesh-hex","#0f0");
      c.change("eyes-color","#0000ff");
      const variants=[];
      for(const glow of ["0","1","2"]){c.change("eye-glow",glow);variants.push({glow,...c.counts()});}
      return {variants,meshPicker:$("mesh-color").value,eyeHex:$("eyes-hex").value,
        invalid:$("face-colors-error").hidden};
    })()`);
    assert.equal(data.meshPicker, "#00ff00"); assert.equal(data.eyeHex, "#0000FF"); assert(data.invalid);
    for (const variant of data.variants) {
      assert(variant.green > 1000 && variant.blue > 20 && variant.red === 0, JSON.stringify(variant));
    }
    report.colorPixels = data;
    await evaluate(`colorCheck.change("eye-glow","1");document.getElementById("mesh-colors-control").scrollIntoView({block:"nearest"});`);
    await screenshot("colors-green-mesh-blue-eyes");
  });
  await check("Invalid hex stays visible and preserves the last valid image, then picker input recovers", async () => {
    const data = await evaluate(`(() => {
      const $=id=>document.getElementById(id),c=colorCheck,before=c.pixels();
      c.change("mesh-hex","#zzzzzz");
      const invalid={visible:!$("face-colors-error").hidden,aria:$("mesh-hex").getAttribute("aria-invalid"),
        valid:$("mesh-hex").checkValidity(),difference:c.difference(before,c.pixels())};
      c.change("eyes-hex","bad!");
      c.change("mesh-color","#8844ff");
      const otherStillInvalid=!$("face-colors-error").hidden;
      c.change("eyes-color","#00ffff");
      return {invalid,otherStillInvalid,recovered:$("face-colors-error").hidden,
        hex:$("mesh-hex").value,eyes:$("eyes-hex").value};
    })()`);
    assert.equal(data.invalid.visible, true); assert.equal(data.invalid.aria, "true");
    assert.equal(data.invalid.valid, false); assert.deepEqual(data.invalid.difference, { changed: 0, maximum: 0 });
    assert(data.otherStillInvalid && data.recovered);
    assert.equal(data.hex, "#8844FF"); assert.equal(data.eyes, "#00FFFF");
  });
  await check("Black, white and matching hair remain usable; mesh and eyes color every presentation", async () => {
    report.viewIsolation = await evaluate(`(() => {
      const $=id=>document.getElementById(id),c=colorCheck,result=[];
      c.change("mesh-color","#00ff00");
      c.change("eyes-color","#000000");const black=c.counts();
      c.change("eyes-color","#ffffff");const white=c.counts();
      for(const view of ["claire","facedot","uniform","robot"]){
        c.change("presentation",view);const before=c.pixels();
        c.change("mesh-color","#ff00ff");c.change("eyes-color","#00ff00");
        result.push({view,hidden:$("mesh-colors-control").hidden,difference:c.difference(before,c.pixels())});
        c.change("mesh-color","#8844ff");c.change("eyes-color","#ffffff");
      }
      c.change("presentation","facemesh");$("hair").checked=true;$("hair").dispatchEvent(new Event("input"));
      c.change("mesh-color","#00ff00");const hair=c.counts();
      $("hair").checked=false;$("hair").dispatchEvent(new Event("input"));
      return {black,white,result,hair,retained:[$("mesh-color").value,$("eyes-color").value]};
    })()`);
    assert.equal(report.viewIsolation.black.blue, 0);
    assert.equal(report.viewIsolation.black.white, 0);
    assert(report.viewIsolation.white.white > 20);
    for (const view of report.viewIsolation.result) {
      assert.equal(view.hidden, false);
      assert(view.difference.changed > 0, view.view);
    }
    assert(report.viewIsolation.hair.green > 1000);
    assert.deepEqual(report.viewIsolation.retained, ["#00ff00", "#ffffff"]);
  });
  await check("Live color edits do not regenerate, upload geometry, compile shaders or disturb playback", async () => {
    await generate("Colors change without new speech.");
    await evaluate(`document.getElementById("audio").muted=true;`);
    await click("play");
    await waitFor(`!document.getElementById("audio").paused`);
    report.liveCost = await evaluate(`(() => {
      const $=id=>document.getElementById(id),a=$("audio"),g=$("face").getContext("webgl2");
      const original={},calls={},durations=[],source=a.src,time=a.currentTime,fetch=window.fetch;
      let requests=0,seeks=0,pauses=0;
      const onSeek=()=>seeks++,onPause=()=>pauses++;
      a.addEventListener("seeking",onSeek);a.addEventListener("pause",onPause);
      for(const name of ["createBuffer","bufferData","bufferSubData","compileShader","linkProgram","clear"]){
        original[name]=g[name];calls[name]=0;g[name]=function(...args){calls[name]++;return original[name].apply(this,args);};
      }
      window.fetch=(...args)=>{requests++;return fetch(...args);};
      try{
        for(let i=0;i<20;i++){const start=performance.now();
          colorCheck.change(i%2?"eyes-color":"mesh-color","#"+((i%2?0xff8800:0x2288ff)+i*256).toString(16));
          g.finish();durations.push(performance.now()-start);}
        return {calls,requests,seeks,pauses,sourceUnchanged:a.src===source,timeBefore:time,timeAfter:a.currentTime,
          playing:!a.paused,durationsMs:durations,gl:g.getError()};
      }finally{
        window.fetch=fetch;for(const name of Object.keys(original))g[name]=original[name];
        a.removeEventListener("seeking",onSeek);a.removeEventListener("pause",onPause);
      }
    })()`);
    const data = report.liveCost;
    assert.equal(data.calls.clear, 20, "View switches must not accumulate color listeners or redundant redraws.");
    assert(Object.entries(data.calls).every(([name, count]) => name === "clear" || count === 0));
    assert.equal(data.requests, 0); assert.equal(data.seeks, 0); assert.equal(data.pauses, 0);
    assert(data.sourceUnchanged && data.playing && data.timeAfter >= data.timeBefore);
    assert.equal(data.gl, 0);
    await waitFor(`document.getElementById("audio").ended`, 10000);
  });
  await check("Reset and reload restore original defaults and responsive controls remain usable", async () => {
    await click("restart");
    await evaluate(`colorCheck.change("eye-glow","0");colorCheck.change("mesh-hex","wrong");`);
    await click("reset-face-colors");
    const data = await evaluate(`(() => {
      const $=id=>document.getElementById(id),g=$("face").getContext("webgl2"),program=g.getParameter(g.CURRENT_PROGRAM);
      return {values:[$("mesh-hex").value,$("eyes-hex").value],error:$("face-colors-error").hidden,
        custom:g.getUniform(program,g.getUniformLocation(program,"customEyeColor"))};
    })()`);
    assert.deepEqual(data, { values: ["#4DE8DB", "#FF0406"], error: true, custom: false });
    await screenshot("colors-controls-default");
    await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true);
    await evaluate(`document.getElementById("mesh-colors-control").scrollIntoView({block:"center"});`);
    await screenshot("colors-controls-mobile");
    await evaluate(`colorCheck.change("mesh-color","#ff8800");`);
    await cdp("Page.reload");
    await waitFor(`document.getElementById("generate") && !document.getElementById("generate").disabled`);
    assert.deepEqual(await evaluate(`["presentation","mesh-hex","eyes-hex"].map(id=>document.getElementById(id).value)`),
      ["claire", "#4DE8DB", "#FF0406"]);
    assert.equal(await evaluate(`document.getElementById("mesh-colors-control").hidden`), false);
  });
}

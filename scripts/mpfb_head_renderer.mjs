try {
  const model=JSON.parse(document.querySelector("#model").textContent);
  if(model.rest.length/3>=65536) throw new Error("Study renderer requires bounded Uint16 indices.");
  const draw=[createStudyRenderer(document.querySelector("#wire"),model,false),
    createStudyRenderer(document.querySelector("#surface"),model,true)];
  const pose=document.querySelector("#pose"),unit=document.querySelector("#unit");
  for(const name of Object.keys(FACE_POSES)) pose.add(new Option(name,name));
  for(const [name,delta] of Object.entries(model.basis)) {
    const option=new Option(name,name);
    if(!delta.some(value=>value!==0)) {
      option.disabled=true;option.textContent=`${name} (no exported geometry)`;
    }
    unit.add(option);
  }
  const render=(name="neutral",strength=1,yaw=0)=>{
    const weights=name.startsWith("unit:")?{[name.slice(5)]:1}:FACE_POSES[name];
    if(!weights) throw new Error("Unknown study pose.");
    const positions=blendFaceUnits(model,weights,strength);
    draw.forEach(fn=>fn(positions,yaw));
    document.querySelector("#caption").textContent=
      `${name} | native strength ${strength.toFixed(2)} | yaw ${yaw.toFixed(0)} deg | NO SPEECH RETARGETING`;
    return {vertices:positions.length/3,finite:positions.every(Number.isFinite)};
  };
  window.mpfbPreview={render,poses:Object.keys(FACE_POSES),faceunits:Object.keys(model.basis),ready:true};
  let frame=0, animationFrame=0;
  const update=()=>{
    const active=document.querySelector("#animate").checked;
    const name=unit.value?`unit:${unit.value}`:pose.value;
    const strength=Number(document.querySelector("#strength").value)*(active?.5-.5*Math.cos(frame/20):1);
    const yaw=Number(document.querySelector("#yaw").value)+(active?Math.sin(frame/45)*25:0);
    render(name,strength,yaw);frame++;
    if(active) animationFrame=requestAnimationFrame(update);
  };
  document.querySelectorAll("input:not(#animate),select").forEach(control=>control.addEventListener("input",()=>{
    document.querySelector("#animate").checked=false;
    cancelAnimationFrame(animationFrame);
    update();
  }));
  document.querySelector("#animate").addEventListener("change",()=>{
    cancelAnimationFrame(animationFrame);update();
  });
  document.querySelectorAll("canvas").forEach(canvas=>canvas.addEventListener("webglcontextlost",event=>{
    event.preventDefault();document.querySelector("#animate").checked=false;
    document.querySelector("#error").textContent="WebGL context lost. Reload the page to restart this isolated study.";
  }));
  render();
} catch(error) {
  document.querySelector("#error").textContent=error.stack;
  window.mpfbPreview={ready:false,error:error.message};
}

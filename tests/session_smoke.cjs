const {app, BrowserWindow} = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const output = process.argv.find(arg=>arg.startsWith("--qualification-output=")).slice(23);
const report = {checks:[],models:[],audio:"Volume zero; no independent listening acceptance."};
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
let window;
async function save() {await fs.writeFile(path.join(output,"session-report.json"),JSON.stringify(report,null,2));}
app.whenReady().then(async()=>{
  window=new BrowserWindow({show:false,webPreferences:{
    sandbox:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
  await window.loadURL(process.env.VERONA_LOCAL_URL);
  const evaluate=code=>window.webContents.executeJavaScript(code,true);
  const command=payload=>evaluate(`fetch("/api/agent",{method:"POST",
    headers:{"Content-Type":"application/json","X-Verona-Token":location.hash.slice(1)},
    body:${JSON.stringify(JSON.stringify(payload))}}).then(async response=>{
      const value=await response.json();if(!response.ok)throw new Error(value.error);return value;})`);
  async function wait(fn,label,seconds=75) {
    const until=Date.now()+seconds*1000;
    while(Date.now()<until){const result=await fn();if(result)return result;await pause(100);}
    try {report.timeoutInventory=await command({action:"list"});}
    catch(error){report.timeoutInventoryError=String(error);}
    throw new Error("Timed out: "+label);
  }
  const list=async()=> (await command({action:"list"})).sessions;
  const inspect=async name=>command({action:"inspect",session:name});
  const closed=async name=>!(await list()).some(item=>item.session===name);
  async function refresh() {await evaluate(`document.getElementById("refresh").click()`);await pause(150);}
  async function create(model,name,colors) {
    await evaluate(`document.getElementById("new").click();
      document.getElementById("name").value=${JSON.stringify(name)};
      document.getElementById("model").value=${JSON.stringify(model)};
      for(const [key,value] of Object.entries(${JSON.stringify(colors)})){
        const input=document.getElementById(key+"-hex");input.value=value;
        input.dispatchEvent(new Event("input",{bubbles:true}));}
      document.getElementById("create").requestSubmit();`);
    const started=Date.now();
    const state=await wait(async()=>{
      const value=await inspect(name);
      if((value?.state==="failed"&&value.error)||value?.state==="unavailable")throw new Error(JSON.stringify(value));
      return value?.ready && value.controls?.length && value;
    },model+" native ready");
    const volume=state.controls.find(control=>control.id==="volume");
    assert(volume && !volume.disabled,model+" has centrally configurable volume");
    const blink=state.controls.find(control=>control.id==="natural-blink");
    assert(blink && !blink.disabled && typeof blink.value==="boolean",
      model+" publishes its initialized natural-blink control");
    for (const value of [false,true]) {
      await command({action:"settings",session:name,settings:{"natural-blink":value}});
      assert.equal((await inspect(name)).controls.find(control=>control.id==="natural-blink").value,value,
        model+" confirms central blink preference changes");
    }
    await command({action:"settings",session:name,settings:{volume:"0"}});
    report.models.push({model,session:name,readySeconds:(Date.now()-started)/1000,
      appearance:state.appearance,controlCount:state.controls.length,naturalBlinkRoundTrip:true});
    await refresh();
    return state;
  }
  await wait(()=>evaluate(`document.getElementById("model").options.length===5`),"five model choices",15);
  assert.equal(await evaluate("typeof require"),"undefined");
  report.checks.push("One sandboxed GUI presents all five variants without separate launchers.");
  const first=await create("claire","qual-claire",{hair:"#113355",lips:"#AA2255",eyebrows:"#CCBB77"});
  const second=await create("mpfb","qual-mpfb",{hair:"#664422",lips:"#11AA77",eyebrows:"#8833DD"});
  await wait(()=>evaluate(`[...document.querySelectorAll("#controls label")].some(
    label=>label.querySelector("span").textContent==="volume")`),"selected native controls");
  await evaluate(`(() => {const label=[...document.querySelectorAll("#controls label")].find(
      label=>label.querySelector("span").textContent==="volume");
    const input=label.querySelector("input");input.focus();input.value="0.25";
    input.dispatchEvent(new Event("change",{bubbles:true}));})()`);
  await wait(async()=>(await inspect("qual-mpfb")).controls.find(control=>control.id==="volume")?.value==="0.25",
    "focused central volume input reaches native head",10);
  await command({action:"settings",session:"qual-mpfb",settings:{volume:"0"}});
  await evaluate(`const hair=document.getElementById("hair-hex");hair.value="#665544";
    hair.dispatchEvent(new Event("input",{bubbles:true}));
    document.getElementById("save-colors").click();`);
  await wait(async()=>(await inspect("qual-mpfb")).appearance.colors.hair==="#665544",
    "GUI color Apply reaches selected native head",10);
  assert.equal((await inspect("qual-claire")).appearance.colors.hair,"#113355");
  report.checks.push("Focused central native controls and GUI color Apply change only the selected real head.");
  assert.notDeepEqual(first.appearance.colors,second.appearance.colors);
  await command({action:"configure",session:"qual-claire",colors:{hair:"#123456",lips:"#F01040",eyebrows:"#AF8020"}});
  assert.equal((await inspect("qual-mpfb")).appearance.colors.lips,"#11AA77");
  report.checks.push("Two real warm heads coexist; confirmed feature colors remain isolated.");
  for(const name of ["qual-claire","qual-mpfb"]) {
    await command({action:"say",session:name,text:"A quiet local qualification sentence for this independent head.",
      voice:null,expression:"happy",intensity:.6,gain:4,mode:"face"});
  }
  const speaking=await wait(async()=>{
    const rows=await list();
    return rows.filter(row=>row.session.startsWith("qual-")&&row.state==="playing").length===2 && rows;
  },"both native audio clocks playing");
  assert.notEqual(speaking[0].id,speaking[1].id);
  await command({action:"cancel",session:"qual-claire",id:speaking.find(row=>row.session==="qual-claire").id});
  await wait(async()=>(await inspect("qual-claire")).state==="cancelled","first head cancellation",15);
  await wait(async()=>(await inspect("qual-mpfb")).state==="completed","other head completes",30);
  const after=await inspect("qual-claire");
  assert(after.ready && after.controls.every(control=>control.id!=="voice"||!control.disabled));
  report.checks.push("Simultaneous native speech; stopping one head preserves the other audio clock/completion.");
  await refresh();
  await evaluate(`document.getElementById("sentence").value="A second silent qualification.";
    document.getElementById("voice-only").checked=true;
    document.getElementById("speech").requestSubmit();`);
  await wait(async()=>{
    const value=await inspect("qual-mpfb");
    if(value.state==="failed")throw new Error(value.error);
    return value.mode==="voice"&&value.state==="completed";
  },"central GUI voice-only speech",35);
  report.checks.push("GUI speech uses selected native voice/settings and clears accepted text.");
  assert.equal(await evaluate(`document.getElementById("sentence").value`),"");
  await fs.writeFile(path.join(output,"unified-manager.png"),(await window.webContents.capturePage()).toPNG());
  for(const name of ["qual-claire","qual-mpfb"]){
    await command({action:"close",session:name});
    await wait(()=>closed(name),name+" close",20);
  }
  for(const model of ["reference-structure","reference-shell","male-sharp"]) {
    const name="qual-"+model;
    await create(model,name,{hair:"#245566",lips:"#CA3377",eyebrows:"#A06020"});
    await command({action:"say",session:name,text:"Local head check.",voice:null,
      expression:"happy",intensity:.5,gain:4,mode:"face"});
    await wait(async()=>{
      const value=await inspect(name);
      if(value.state==="failed")throw new Error(JSON.stringify(value));
      return value.state==="completed";
    },model+" speech completion",35);
    await command({action:"close",session:name});
    await wait(()=>closed(name),model+" close",20);
  }
  report.checks.push("Every selectable variant initialized its real native renderer and completed actual muted speech.");
  report.checks.push("All five real models publish natural blinking and confirm manager opt-out/opt-in.");
  await save();
  window.destroy();app.quit();
}).catch(async error=>{
  report.error=error.stack;
  await save();console.error(error.stack);app.exit(1);
});

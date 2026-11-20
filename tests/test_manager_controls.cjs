const {app, BrowserWindow} = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const argument = prefix => process.argv.find(value=>value.startsWith(prefix)).slice(prefix.length);
const output=path.resolve(argument("--qualification-output="));
app.setPath("userData",path.resolve(argument("--user-data-dir=")));
app.setPath("sessionData",path.resolve(argument("--user-data-dir=")));
const report={checks:[],scope:"Real manager DOM/source with deterministic API fixtures; not real-head or human acceptance."};
app.whenReady().then(async()=>{
  await fs.mkdir(output,{recursive:true});
  const web=path.join(__dirname,"..","verona","web");
  const [html,css,source]=await Promise.all(["manager.html","manager.css","manager.js"]
    .map(name=>fs.readFile(path.join(web,name),"utf8")));
  const window=new BrowserWindow({show:false,width:1280,height:1000,webPreferences:{
    sandbox:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
  await window.loadURL("data:text/html,"+encodeURIComponent(html
    .replace('<link rel="stylesheet" href="/manager.css">',`<style>${css}</style>`)
    .replace('<script type="module" src="/manager.js"></script>',"")));
  const evaluate=code=>window.webContents.executeJavaScript(code,true);
  await evaluate(`(async()=>{
    const control=(id,type,value,disabled=false,options=[])=>({
      id,label:id,type,value,disabled,options,min:type==="range"?"0":"",max:type==="range"?"1":"",step:"0.1"});
    const fixtureModels={claire:"Original Claire",mpfb:"Native MPFB"};
    const fixtureHeads=["qual-a","qual-b"].map((session,index)=>({
      session,ready:true,state:"idle",appearance:{model:index?"mpfb":"claire",colors:{}},
      controls:[control("voice","select-one","Hazel",false,[{label:"Hazel",value:"Hazel"}]),
        control("presentation","select-one","facemesh",false,[
          {label:"FaceMesh",value:"facemesh"},{label:"Polygon",value:"polygon"}]),
        control("framing","select-one","face",true,[{label:"Face only",value:"face"}]),
        control("volume","range","0.8")]}));
    const fixtureCalls=[];
    const transport={offline:false,hold:null,release:null,reject:null};
    window.fetch=async(_,options)=>{
      const payload=JSON.parse(options.body);fixtureCalls.push(payload);
      if(transport.offline)throw new Error("Fixture manager connection lost.");
      if(transport.reject===payload.action){transport.reject=null;throw new Error("Fixture rejected action.");}
      const held=transport.hold===payload.action;
      const blocked=held?new Promise(resolve=>{transport.release=resolve;transport.hold=null;}):null;
      if(blocked&&payload.action!=="list")await blocked;
      let value;
      if(payload.action==="list")value={models:fixtureModels,sessions:fixtureHeads.map(({controls,...head})=>head)};
      else if(payload.action==="inspect")value=fixtureHeads.find(head=>head.session===payload.session);
      else if(payload.action==="settings"){
        const head=fixtureHeads.find(head=>head.session===payload.session);
        for(const [id,value] of Object.entries(payload.settings)){
          const spec=head.controls.find(control=>control.id===id);
          if(!head.ready||!spec||spec.disabled)throw new Error("Fixture rejected unavailable setting.");
          spec.value=value;
          if(id==="presentation")head.controls.find(control=>control.id==="framing").disabled=value==="facemesh";
        }
        value=head;
      }else if(payload.action==="configure"){
        const head=fixtureHeads.find(head=>head.session===payload.session);
        head.appearance.colors=payload.colors;value=head;
      }else if(payload.action==="say"){
        const head=fixtureHeads.find(head=>head.session===payload.session);
        head.id="1".repeat(32);head.state="generating";value=head;
      }else if(payload.action==="create"){
        value={session:payload.session,ready:true,state:"idle",
          appearance:{model:payload.model,colors:payload.colors},controls:[]};
        fixtureHeads.push(value);
      }else throw new Error("Unexpected fixture request: "+payload.action);
      const snapshot=JSON.parse(JSON.stringify(value));
      if(blocked&&payload.action==="list")await blocked;
      return {ok:true,json:async()=>snapshot};
    };
    ${source}
    window.managerTest={choose,refresh,heads:fixtureHeads,calls:fixtureCalls,transport,stop:()=>clearInterval(timer)};
  })()`);
  const rows=id=>evaluate(`Array.from(document.querySelectorAll("#${id}>label")).map(label=>({
    label:label.querySelector("span").textContent,value:label.querySelector("input,select").value,
    disabled:label.querySelector("input,select").disabled,readonly:label.querySelector("input,select").readOnly||false,
    hint:label.querySelector("small")?.textContent||""}))`);
  async function waitFor(code,label){
    const until=Date.now()+5000;
    while(Date.now()<until){if(await evaluate(code))return;await new Promise(resolve=>setTimeout(resolve,20));}
    throw new Error("Timed out: "+label);
  }
  await evaluate(`managerTest.choose("qual-a");managerTest.refresh()`);
  assert.deepEqual((await rows("controls")).map(row=>row.label),["voice","presentation","volume"]);
  const readonly=await rows("readonly-controls");
  assert.deepEqual(readonly.map(row=>row.label),["Session name","Head variant","framing"]);
  assert.equal(readonly[0].value,"qual-a");assert.equal(readonly[1].value,"Original Claire");
  assert(readonly.slice(0,2).every(row=>row.readonly&&row.hint.startsWith("Set at creation.")));
  assert(readonly[2].disabled&&readonly[2].hint.startsWith("Currently unavailable"));
  assert.equal(await evaluate(`document.querySelector("#error").textContent`),"");
  report.checks.push("Two sections separate enabled controls, immutable name/model and explicitly temporary unavailable controls.");
  await evaluate(`const volume=[...document.querySelectorAll("#controls label")].find(label=>
    label.querySelector("span").textContent==="volume").querySelector("input");
    volume.focus();managerTest.heads[0].ready=false;managerTest.refresh()`);
  assert.equal((await rows("controls")).length,0);
  assert.equal(await evaluate(`document.getElementById("no-editable").hidden`),false);
  assert((await rows("readonly-controls")).slice(2).every(row=>row.disabled));
  await evaluate(`managerTest.heads[0].ready=true;managerTest.refresh()`);
  assert.equal((await rows("controls")).length,3);
  report.checks.push("Readiness changes regroup controls even with an input focused; ready state restores editable controls.");
  for(const [mode,editableCount] of [["polygon",4],["facemesh",3]]){
    await evaluate(`{const input=[...document.querySelectorAll("#controls label")].find(label=>
      label.querySelector("span").textContent==="presentation").querySelector("select");
      input.value=${JSON.stringify(mode)};input.dispatchEvent(new Event("change",{bubbles:true}));}`);
    await waitFor(`document.querySelectorAll("#controls>label").length===${editableCount}`,"mode regrouping");
    assert.equal((await rows("readonly-controls")).length,6-editableCount);
  }
  assert.deepEqual(await evaluate(`managerTest.calls.filter(call=>call.action==="settings").map(
    call=>({session:call.session,settings:call.settings}))`),[
      {session:"qual-a",settings:{presentation:"polygon"}},
      {session:"qual-a",settings:{presentation:"facemesh"}}]);
  report.checks.push("Actual change events forward one selected-head setting; disabled controls move out/in without duplication.");
  await evaluate(`document.querySelector("#controls input").focus();
    managerTest.choose("qual-b");managerTest.refresh()`);
  assert.equal((await rows("readonly-controls"))[0].value,"qual-b");
  assert.equal((await rows("readonly-controls"))[1].value,"Native MPFB");
  assert.equal(await evaluate(`document.getElementById("controls").dataset.session`),"qual-b");
  assert.equal(await evaluate(`document.getElementById("error").textContent`),"");
  await evaluate("managerTest.stop()");
  await evaluate(`managerTest.choose("qual-a");
    const sessionButton=document.querySelector('[data-session="qual-a"]');
    sessionButton.focus();window.focusedSessionButton=sessionButton;managerTest.refresh()`);
  assert.equal(await evaluate(`document.activeElement===focusedSessionButton&&
    document.querySelector('[data-session="qual-a"]')===focusedSessionButton`),true);
  report.checks.push("Polling preserves the actual keyed session button and its keyboard focus.");
  await evaluate(`document.getElementById("sentence").value="A draft";
    document.getElementById("voice-only").checked=true;
    document.getElementById("mesh-hex").value="invalid";
    document.getElementById("mesh-hex").dispatchEvent(new Event("input"));
    managerTest.choose("qual-b");document.getElementById("sentence").value="B draft";
    managerTest.choose("qual-a");managerTest.refresh()`);
  assert.deepEqual(await evaluate(`({text:document.getElementById("sentence").value,
    voice:document.getElementById("voice-only").checked,color:document.getElementById("mesh-hex").value})`),
    {text:"A draft",voice:true,color:"invalid"});
  await evaluate(`managerTest.transport.hold="say";document.getElementById("speech").requestSubmit();
    document.getElementById("speech").requestSubmit();
    document.getElementById("sentence").value="New text during request";managerTest.choose("qual-b");
    managerTest.transport.release()`);
  await waitFor(`!document.getElementById("speak").disabled`,"speech acknowledgement on another head");
  assert.equal(await evaluate(`document.getElementById("sentence").value`),"B draft");
  await evaluate(`managerTest.choose("qual-a")`);
  assert.equal(await evaluate(`document.getElementById("sentence").value`),"New text during request");
  assert.equal(await evaluate(`managerTest.calls.filter(call=>call.action==="say").length`),1);
  report.checks.push("Per-head text, voice-only and invalid color drafts survive polling/selection; a pending speech acknowledgement cannot erase newer or another head's text; duplicate submission is gated.");
  await evaluate(`(async()=>{managerTest.heads[0].state="idle";await managerTest.refresh();
    document.getElementById("mesh-hex").value="#00FF88";
    document.getElementById("mesh-hex").dispatchEvent(new Event("input"));
    managerTest.transport.hold="list";window.oldPoll=managerTest.refresh();})()`);
  await waitFor(`typeof managerTest.transport.release==="function"`,"old inventory request");
  await evaluate(`document.getElementById("save-colors").click()`);
  await waitFor(`!document.getElementById("save-colors").disabled`,"confirmed appearance");
  await evaluate(`(async()=>{managerTest.transport.release();await window.oldPoll;})()`);
  assert.equal(await evaluate(`document.getElementById("mesh-hex").value`),"#00FF88");
  assert.equal(await evaluate(`document.getElementById("color-state").textContent`),"Confirmed appearance");
  await evaluate(`managerTest.transport.reject="configure";
    document.getElementById("mesh-hex").value="#F08020";
    document.getElementById("mesh-hex").dispatchEvent(new Event("input"));
    document.getElementById("save-colors").click()`);
  await waitFor(`document.getElementById("error").textContent.includes("Fixture rejected")`,"visible action failure");
  assert.equal(await evaluate(`document.getElementById("color-state").textContent`),"Unapplied changes");
  report.checks.push("An obsolete in-flight inventory cannot overwrite newly confirmed colors; a failed action remains explicit and keeps the unapplied draft.");
  await evaluate(`(async()=>{managerTest.transport.offline=true;await managerTest.refresh();})()`);
  assert.equal(await evaluate(`document.getElementById("connection").dataset.state`),"stale");
  assert.equal(await evaluate(`document.getElementById("speak").disabled`),true);
  assert.equal(await evaluate(`document.getElementById("readonly-controls").textContent.includes("refresh the manager connection")`),true);
  assert.equal(await evaluate(`document.getElementById("mesh-hex").value`),"#F08020");
  await evaluate(`(async()=>{managerTest.transport.offline=false;await managerTest.refresh();})()`);
  assert.equal(await evaluate(`document.getElementById("connection").dataset.state`),"online");
  assert.equal(await evaluate(`document.getElementById("speak").disabled`),false);
  await evaluate(`managerTest.choose(null);document.getElementById("name").value="qual-new";
    managerTest.transport.hold="create";document.getElementById("create").requestSubmit();
    document.getElementById("create").requestSubmit()`);
  assert.equal(await evaluate(`document.getElementById("create-head").disabled`),true);
  await evaluate(`managerTest.transport.release()`);
  await waitFor(`document.getElementById("heading").textContent==="qual-new"`,"new selected head");
  assert.equal(await evaluate(`managerTest.calls.filter(call=>call.action==="create").length`),1);
  report.checks.push("Stale connections disable mutations, preserve drafts and recover explicitly; duplicate head creation is gated while pending.");
  await evaluate(`(async()=>{managerTest.choose("qual-a");
    document.getElementById("sentence").value="Retired head draft";
    document.getElementById("voice-only").checked=true;
    document.getElementById("mesh-hex").value="#ABCDEF";
    document.getElementById("mesh-hex").dispatchEvent(new Event("input"));
    managerTest.choose("qual-b");
    const index=managerTest.heads.findIndex(head=>head.session==="qual-a");
    const removed=managerTest.heads.splice(index,1)[0];await managerTest.refresh();
    managerTest.heads.push(removed);await managerTest.refresh();managerTest.choose("qual-a");
  })()`);
  assert.deepEqual(await evaluate(`({text:document.getElementById("sentence").value,
    voice:document.getElementById("voice-only").checked,color:document.getElementById("mesh-hex").value})`),
    {text:"",voice:false,color:"#00FF88"});
  report.checks.push("An authoritative inventory removes an unselected retired head's draft; reusing its name cannot inherit old speech, voice-only or unapplied colors.");
  await evaluate(`(async()=>{managerTest.choose("qual-b");await managerTest.refresh();window.scrollTo(0,0);})()`);
  await fs.writeFile(path.join(output,"manager-workspace.png"),(await window.webContents.capturePage()).toPNG());
  await evaluate(`document.getElementById("selected").scrollIntoView()`);
  await fs.writeFile(path.join(output,"manager-controls.png"),(await window.webContents.capturePage()).toPNG());
  report.checks.push("Selecting another head replaces focused controls and immutable identity, even with an identical runtime schema.");
  window.setContentSize(560,920);
  assert.equal(await evaluate(`[...document.querySelectorAll(".control-section")].every(
    section=>section.scrollWidth<=section.clientWidth)`),true);
  report.checks.push("Both control sections fit the narrow responsive layout without internal horizontal overflow.");
  for(const width of [560,360]){
    window.setContentSize(width,920);
    await evaluate("window.scrollTo(0,0)");
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
    await fs.writeFile(path.join(output,`manager-${width}.png`),(await window.webContents.capturePage()).toPNG());
  }
  await evaluate(`(async()=>{managerTest.heads.splice(0);await managerTest.refresh();})()`);
  assert.equal(await evaluate(`document.getElementById("empty-sessions").textContent`),"No heads yet. Create your first session.");
  await evaluate(`(async()=>{managerTest.transport.offline=true;await managerTest.refresh();})()`);
  assert.equal(await evaluate(`document.getElementById("empty-sessions").textContent`),"Session inventory unavailable. Refresh to retry.");
  report.checks.push("360/560px workspaces do not overflow; successful empty inventory is visibly distinct from unavailable inventory.");
  window.destroy();
  await fs.writeFile(path.join(output,"controls-report.json"),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));app.quit();
}).catch(async error=>{
  report.error=error.stack;
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,"controls-report.json"),JSON.stringify(report,null,2));
  console.error(error.stack);app.exit(1);
});

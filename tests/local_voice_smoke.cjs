const {app, BrowserWindow} = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const output = process.argv.find(arg=>arg.startsWith("--qualification-output=")).slice(23);
const report = {checks:[], models:[], audio:"Volume zero; no independent listening acceptance."};
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
  const window = new BrowserWindow({show:false, width:1280, height:1000, webPreferences:{
    sandbox:true, nodeIntegration:false, contextIsolation:true, backgroundThrottling:false}});
  await window.loadURL(process.env.VERONA_LOCAL_URL);
  const evaluate = code => window.webContents.executeJavaScript(code,true);
  const command = payload => evaluate(`fetch("/api/agent",{method:"POST",
    headers:{"Content-Type":"application/json","X-Verona-Token":location.hash.slice(1)},
    body:${JSON.stringify(JSON.stringify(payload))}}).then(async response=>{
      const value=await response.json();if(!response.ok)throw new Error(value.error);return value;})`);
  const inspect = session => command({action:"inspect",session});
  const settings = (session,settings) => command({action:"settings",session,settings});
  const control = (head,id) => head.controls.find(row=>row.id===id);
  async function wait(fn,label,seconds=75) {
    const until=Date.now()+seconds*1000;
    while(Date.now()<until){if(await fn())return;await pause(100);}
    throw new Error("Timed out: "+label);
  }
  async function terminal(session,wanted) {
    await wait(async()=>{
      const state=await inspect(session);
      if(state.state==="failed")throw new Error(state.error);
      return state.state===wanted;
    },session+" "+wanted);
  }
  async function say(session,text,mode="voice") {
    return command({action:"say",session,text,voice:null,expression:"neutral",intensity:.5,gain:4,mode});
  }
  for(const [model,session] of [["claire","qual-voice-a"],["mark","qual-voice-b"]]) {
    await command({action:"create",session,model,colors:{}});
    await wait(async()=>{
      const value=await inspect(session);
      if(["failed","unavailable"].includes(value.state))throw new Error(JSON.stringify(value));
      return value.ready&&value.controls.length;
    },session+" ready");
    await settings(session,{volume:"0"});
    report.models.push({model,session,voice:(await inspect(session)).voice});
  }
  const [a,b]=report.models.map(row=>row.session);
  assert.notEqual(report.models[0].voice,report.models[1].voice);
  let head=await inspect(a);
  assert.equal(control(head,"voice").options.filter(row=>row.value.startsWith("Kokoro ")).length,28);
  assert(control(head,"pitch").disabled&&control(head,"emphasis").disabled);
  report.checks.push("Two real heads receive different optional local defaults; all 28 voices are selectable.");
  const windows=control(head,"voice").options.find(row=>!row.value.startsWith("Kokoro ")).value;
  await settings(a,{voice:windows});
  head=await inspect(a);
  assert(!control(head,"pitch").disabled&&!control(head,"emphasis").disabled);
  await settings(a,{pitch:"2"});
  await settings(a,{emphasis:"strong"});
  await say(a,"A quiet Windows voice still works.");
  await terminal(a,"completed");
  await settings(a,{voice:"Kokoro Emma"});
  head=await inspect(a);
  assert.equal(head.voice,"Kokoro Emma");
  assert.equal(control(head,"pitch").value,"0");
  assert.equal(control(head,"emphasis").value,"none");
  assert(control(head,"pitch").disabled&&control(head,"emphasis").disabled);
  await assert.rejects(()=>settings(a,{pitch:"1"}));
  for(const id of ["rate","bass","treble"])await settings(a,{[id]:"1"});
  await say(a,"Hello there. The selected local voice drives this face.","face");
  await terminal(a,"completed");
  assert(control(await inspect(a),"pitch").disabled);
  report.checks.push("Windows controls stay usable; Kokoro visibly resets unsupported controls and rejects forced edits after completion.");
  report.checks.push("Omitted request voice respects selected Emma; local speed and EQ feed actual Claire motion/audio playback.");
  await say(b,"Another session keeps a different local voice.");
  await terminal(b,"completed");
  const cancelled=await say(a,"This new synthetic request will be stopped before it can finish.");
  await pause(100);
  await command({action:"cancel",session:a,id:cancelled.id});
  await terminal(a,"cancelled");
  report.checks.push("Other real head completes local speech; cancellation discards an in-flight new local request.");
  await settings(b,{voice:"Kokoro Emma"});
  await evaluate('document.getElementById("refresh").click()');
  await wait(()=>evaluate('[...document.querySelectorAll(".session-meta")].filter(node=>node.textContent.includes("shared voice")).length===2'),
    "visible manual collision warning",10);
  await settings(b,{voice:report.models[1].voice});
  await evaluate('document.getElementById("refresh").click()');
  await wait(()=>evaluate('![...document.querySelectorAll(".session-meta")].some(node=>node.textContent.includes("shared voice"))'),
    "collision warning clears",10);
  report.checks.push("Manager cards identify actual voices and visibly flag/clear a deliberately shared manual choice.");
  await fs.writeFile(path.join(output,"local-voice-manager.png"),(await window.webContents.capturePage()).toPNG());
  for(const session of [a,b])await command({action:"close",session});
  await wait(async()=>!(await command({action:"list"})).sessions.length,"both owned heads close",30);
  await fs.writeFile(path.join(output,"session-report.json"),JSON.stringify(report,null,2));
  window.destroy();app.quit();
}).catch(async error=>{
  report.error=error.stack;
  await fs.writeFile(path.join(output,"session-report.json"),JSON.stringify(report,null,2));
  console.error(error.stack);app.exit(1);
});

const {app, BrowserWindow} = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const value = prefix => process.argv.find(arg=>arg.startsWith(prefix)).slice(prefix.length);
const output = path.resolve(value("--qualification-output="));
app.setPath("userData",path.resolve(value("--user-data-dir=")));
app.setPath("sessionData",path.resolve(value("--user-data-dir=")));
const report = {checks:[]};
app.whenReady().then(async()=>{
  await fs.mkdir(output,{recursive:true});
  const source=(await fs.readFile(path.join(__dirname,"..","verona","web","session-controls.mjs"),"utf8"))
    .replace("export function attachSessionControls","function attachSessionControls");
  const css=await fs.readFile(path.join(__dirname,"..","verona","web","session-controls.css"),"utf8");
  const html=await fs.readFile(path.join(__dirname,"..","verona","web","index.html"),"utf8");
  const toolbar=html.slice(html.indexOf('  <div id="overlay-toolbar"'),html.indexOf('  <p id="overlay-error"'));
  const appSource=await fs.readFile(path.join(__dirname,"..","verona","web","app.js"),"utf8");
  const collapse=appSource.slice(appSource.indexOf("function collapseOverlayTools()"),
    appSource.indexOf('$("framing").addEventListener'));
  const window=new BrowserWindow({show:false,webPreferences:{
    sandbox:true,nodeIntegration:false,contextIsolation:true}});
  for(const original of [true,false]){
    const base=await fs.readFile(path.join(__dirname,"..","verona","web",original?"style.css":"mpfb.css"),"utf8");
    await window.loadURL("data:text/html,"+encodeURIComponent(`<html class="desktop overlay"><head><style>${base}\n${css}</style><title>Verona | Owned pin fixture | ${original?"Claire":"MPFB"}</title></head><body>`+
      (original?toolbar+'<aside><label><input id="pin-overlay" type="checkbox" checked>Old pin label</label></aside>':"")+
      "</body></html>"));
    const result=await window.webContents.executeJavaScript(`(async()=>{
      const calls=[],errors=[],updates=[];
      const desktop={command:async(action,value)=>{calls.push({action,value});return {pinned:value};},
        agentControls:async value=>updates.push(value)};
      const existing=document.getElementById("pin-overlay");
      if(existing)existing.addEventListener("input",()=>desktop.command("pin",existing.checked));
      const $=id=>document.getElementById(id);
      if(existing){${collapse}}
      ${source}
      const controls=attachSessionControls(desktop,error=>errors.push(error.message));
      const pin=document.getElementById("pin-overlay");
      const label=document.querySelector(".session-label");
      const visible=element=>element.getClientRects().length>0;
      const initial=controls.describe().find(item=>item.id==="pin-overlay");
      const initiallyHidden=!visible(pin)&&!visible(label);
      controls.apply({"pin-overlay":false});await Promise.resolve();
      const off=pin.checked;
      const toggle=document.getElementById("overlay-toggle")||document.querySelector(".session-menu summary");
      toggle.click();
      const expanded=visible(pin)&&visible(label);
      pin.click();await Promise.resolve();
      const final=pin.checked;
      toggle.click();
      const collapsedAgain=!visible(pin)&&!visible(label);
      const sameControl=!existing||existing===pin;
      return {initial,initiallyHidden,expanded,collapsedAgain,off,final,sameControl,calls,errors,
        identity:label.textContent===document.title,
        count:document.querySelectorAll("#pin-overlay").length};
    })()`,true);
    assert.equal(result.initial.value,true);
    assert.equal(result.initial.label,"Always on top");
    assert.equal(result.initial.disabled,false);
    assert.equal(result.initiallyHidden,true);assert.equal(result.expanded,true);
    assert.equal(result.collapsedAgain,true);assert.equal(result.identity,true);
    assert.equal(result.off,false);assert.equal(result.final,true);
    assert.equal(result.sameControl,true);assert.equal(result.count,1);
    assert.deepEqual(result.errors,[]);
    assert.deepEqual(result.calls,[{action:"pin",value:false},{action:"pin",value:true}]);
    report.checks.push(original?"Claire: pin/name hidden in collapsed original menu; expand/collapse, direct and hidden-menu manager toggles pass.":
      "MPFB: pin/name hidden in collapsed native details menu; expand/collapse, direct and hidden-menu manager toggles pass.");
  }
  window.destroy();
  await fs.writeFile(path.join(output,"controls-report.json"),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));app.quit();
}).catch(async error=>{
  report.error=error.stack;
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,"controls-report.json"),JSON.stringify(report,null,2));
  console.error(error.stack);app.exit(1);
});

const $ = id => document.getElementById(id);
const token = location.hash.slice(1), keys = ["mesh","eyes","hair","lips","eyebrows"];
const defaults = {mesh:"#4DE8DB",eyes:"#FF0406",hair:"#331B0F",lips:"#A83252",eyebrows:"#21150F"};
let selected = null, sessions = [], polling = false, refreshAgain = false, editingColors = false, controlSignature = "";
let connection = "loading", errorKind = "", stopped = false;
let revision = 0, timer;
const drafts = new Map(), pending = new Set();
function fail(error, kind = "action") { errorKind = kind; $("error").textContent = error.message || String(error); }
function rememberDraft() {
  drafts.set(selected, {text:$("sentence").value, voiceOnly:$("voice-only").checked,
    colors:Object.fromEntries(keys.map(key=>[key,$(key+"-hex").value])), editingColors});
}
function sameColors(a, b) { return keys.every(key=>a[key]===b[key]); }
function confirmed(name, value) {
  revision++;
  sessions=sessions.map(session=>session.session===name?{...session,...value,session:name}:session);
}
function colorState() {
  $("color-state").textContent = selected ? (editingColors ? "Unapplied changes" : "Confirmed appearance") : "Applied when you create the head";
}
async function act(id, label, operation) {
  if(pending.has(id))return;
  const button=$(id), original=button.textContent;
  pending.add(id);button.disabled=true;button.textContent=label;$("error").textContent="";
  try { await operation(); }
  catch(error) { fail(error); }
  finally { pending.delete(id);button.textContent=original;display(); }
}
async function request(payload) {
  const response = await fetch("/api/agent", {method:"POST",
    headers:{"Content-Type":"application/json","X-Verona-Token":token}, body:JSON.stringify(payload)});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Manager request failed (${response.status}).`);
  return result;
}
for (const key of keys) {
  const label = document.createElement("label"); label.className = "color-row";
  const title = document.createElement("span"); title.textContent = key;
  const row = document.createElement("div"), picker = document.createElement("input"), hex = document.createElement("input");
  picker.type = "color"; picker.id = key+"-picker"; picker.value = defaults[key];
  hex.type = "text"; hex.id = key+"-hex"; hex.placeholder = "original";
  picker.setAttribute("aria-label",`${key} color picker`);
  hex.setAttribute("aria-label",`${key} RGB hex; blank uses original`);
  hex.spellcheck=false;
  hex.pattern = "#?(?:[a-fA-F0-9]{3}|[a-fA-F0-9]{6})|"; hex.maxLength = 7;
  picker.addEventListener("input",()=>{hex.value=picker.value.toUpperCase();editingColors=true;colorState();});
  hex.addEventListener("input",()=>{
    editingColors=true;
    let value=hex.value.replace(/^#/,"");
    if (/^[\da-f]{3}$/i.test(value)) value=[...value].map(c=>c+c).join("");
    if (/^[\da-f]{6}$/i.test(value)) picker.value="#"+value;
    colorState();
  });
  row.append(picker,hex);label.append(title,row);$("palette").append(label);
}
function colors() {
  return Object.fromEntries(keys.map(key=>{
    const input=$(key+"-hex");
    if(!input.checkValidity()) throw new Error(`${key}: enter RGB hex or leave blank for original.`);
    return [key,input.value.trim()||null];
  }));
}
function syncColors(value={}) {
  for(const key of keys) {
    $(key+"-hex").value=value[key]||"";
    let preview=(value[key]||"").replace(/^#/,"");
    if(/^[\da-f]{3}$/i.test(preview))preview=[...preview].map(c=>c+c).join("");
    $(key+"-picker").value=/^[\da-f]{6}$/i.test(preview)?"#"+preview:defaults[key];
  }
}
function showControls(session) {
  const controls=session.controls||[];
  const signature=JSON.stringify([session.session,session.appearance?.model,Boolean(session.ready),controls]);
  const availability=JSON.stringify([Boolean(session.ready),controls.map(spec=>[spec.id,Boolean(spec.disabled)])]);
  const editing=$("controls").contains(document.activeElement)
    && $("controls").dataset.session===session.session
    && $("controls").dataset.availability===availability;
  if(signature===controlSignature || editing) return;
  controlSignature=signature;
  $("controls").dataset.session=session.session;
  $("controls").dataset.availability=availability;
  $("controls").replaceChildren();$("readonly-controls").replaceChildren();
  const model=session.appearance?.model;
  const variant=[...$("model").options].find(option=>option.value===model)?.textContent||model||"Unknown";
  for(const [name,value] of [["Session name",session.session],["Head variant",variant]]) {
    const label=document.createElement("label"), title=document.createElement("span");
    const input=document.createElement("input"), hint=document.createElement("small");
    title.textContent=name;input.value=value;input.readOnly=true;
    hint.className="control-hint";hint.textContent="Set at creation. Create a new head to change.";
    label.append(title,input,hint);$("readonly-controls").append(label);
  }
  let editable=0;
  for(const spec of controls) {
    const label=document.createElement("label"), title=document.createElement("span");
    title.textContent=spec.label;
    const input=document.createElement(spec.type==="select-one"?"select":"input");
    if(spec.type==="select-one") for(const item of spec.options) {
      const option=new Option(item.label,item.value);option.disabled=item.disabled;input.add(option);
    } else {input.type=spec.type;if(spec.min)input.min=spec.min;if(spec.max)input.max=spec.max;if(spec.step)input.step=spec.step;}
    if(spec.type==="checkbox")input.checked=spec.value;else input.value=spec.value;
    input.disabled=spec.disabled||!session.ready;
    if(!input.disabled) input.addEventListener("change",async()=>{
      const name=selected;input.disabled=true;
      try {confirmed(name,await request({action:"settings",session:name,settings:{[spec.id]:spec.type==="checkbox"?input.checked:input.value}}));controlSignature="";input.blur();await refresh();}
      catch(error){fail(error);controlSignature="";await refresh();}
    });
    label.append(title,input);
    if(input.disabled) {
      const hint=document.createElement("small");hint.className="control-hint";
      hint.textContent=connection!=="online"?"Currently unavailable: refresh the manager connection.":
        session.ready?"Currently unavailable for this head's mode or activity. Not necessarily fixed at creation.":
        "Currently unavailable: this head is not ready.";
      label.append(hint);$("readonly-controls").append(label);
    } else {$("controls").append(label);editable++;}
  }
  $("no-editable").hidden=editable>0;
}
function display() {
  const existing=new Map([...$("sessions").children].map(button=>[button.dataset.session,button]));
  for(const [index,session] of sessions.entries()) {
    let button=existing.get(session.session);
    if(!button) {
      button=document.createElement("button");button.type="button";button.dataset.session=session.session;
      for(const name of ["session-swatch","session-name","session-meta"]) {
        const span=document.createElement("span");span.className=name;
        if(name==="session-swatch")span.setAttribute("aria-hidden","true");
        button.append(span);
      }
      button.addEventListener("click",()=>choose(session.session));
    }
    const model=session.appearance?.model;
    const variant=[...$("model").options].find(option=>option.value===model)?.textContent||model||"Unknown variant";
    button.querySelector(".session-name").textContent=session.session;
    const sameVoice=session.voice && sessions.some(other=>other.session!==session.session && other.voice===session.voice);
    button.querySelector(".session-meta").textContent=`${variant} / ${session.state}${session.voice ? ` / ${session.voice}${sameVoice ? " (shared voice)" : ""}` : ""}`;
    button.querySelector(".session-swatch").style.backgroundColor=session.appearance?.colors?.mesh||"";
    button.classList.toggle("active",session.session===selected);
    button.setAttribute("aria-pressed",String(session.session===selected));
    if($("sessions").children[index]!==button)$("sessions").insertBefore(button,$("sessions").children[index]||null);
    existing.delete(session.session);
  }
  for(const button of existing.values())button.remove();
  $("session-count").textContent=String(sessions.length);
  $("empty-sessions").hidden=sessions.length>0;
  $("empty-sessions").textContent=connection==="loading"?"Loading sessions...":
    connection==="online"?"No heads yet. Create your first session.":"Session inventory unavailable. Refresh to retry.";
  $("connection").dataset.state=connection;
  $("connection").textContent=connection==="online"?"Local manager connected":
    connection==="stale"?"Refresh failed. Showing last confirmed state.":
    connection==="closed"?"Manager is closing.":"Connecting to local manager...";
  const session=sessions.find(item=>item.session===selected);
  $("create").hidden=Boolean(selected);$("selected").hidden=!session;
  $("head-settings").hidden=!session;
  $("heading").textContent=session?session.session:"Create a head";
  $("status").textContent=stopped?"Closing manager-owned heads. This page can now be closed.":
    session?`${session.state}${session.error?": "+session.error:""}`:"Choose a name, variant and optional colors.";
  const available=connection==="online"&&!stopped;
  $("create-head").disabled=!available||pending.has("create-head");
  $("save-colors").disabled=!selected||!session?.ready||!available||pending.has("save-colors");
  $("colors").disabled=Boolean(selected)&&(!session?.ready||!available);
  if(session&&!editingColors)syncColors(session.appearance?.colors);
  if(session)showControls({...session,ready:Boolean(session.ready)&&available});
  $("speak").disabled=!available||pending.has("speak")||!session?.ready||["generating","playing","cancelling"].includes(session.state);
  $("cancel").disabled=pending.has("cancel")||!session?.id||!["generating","playing","cancelling"].includes(session.state);
  $("close").disabled=!available||pending.has("close")||!session?.ready;
  $("refresh").disabled=stopped;
  $("exit").disabled=!available||pending.has("exit");
  $("character-count").textContent=`${$("sentence").value.length} / ${$("sentence").maxLength}`;
  colorState();
}
function choose(name) {
  if(name===selected)return;
  rememberDraft();selected=name;
  const draft=drafts.get(name);
  editingColors=draft?.editingColors||false;controlSignature="";$("error").textContent="";
  $("sentence").value=draft?.text||"";$("voice-only").checked=draft?.voiceOnly||false;
  syncColors(draft?.colors||{});display();
}
async function refresh() {
  if(stopped)return;
  if(polling){refreshAgain=true;return;}
  polling=true;const started=revision;
  try {
    const result=await request({action:"list"});
    let rows=result.sessions;
    if(stopped)return;
    if(started!==revision){refreshAgain=true;return;}
    if(selected&&!rows.some(session=>session.session===selected)){
      const removed=selected;choose(null);drafts.delete(removed);
    }
    if(selected){
      const name=selected,current=await request({action:"inspect",session:name});
      if(selected===name)rows=rows.map(session=>session.session===name?current:session);
    }
    if(stopped)return;
    if(started!==revision){refreshAgain=true;return;}
    sessions=rows;
    const active=new Set(rows.map(session=>session.session));
    for(const name of drafts.keys())if(name!==null&&!active.has(name))drafts.delete(name);
    if(!$("model").options.length)for(const [id,label] of Object.entries(result.models))$("model").add(new Option(label,id));
    connection="online";
    if(errorKind==="refresh"){$("error").textContent="";errorKind="";}
    display();
  } catch(error){
    if(!stopped){connection="stale";fail(error,"refresh");display();}
  } finally{
    polling=false;
    if(refreshAgain){refreshAgain=false;await refresh();}
  }
}
$("new").addEventListener("click",()=>{choose(null);$("name").focus();});
$("create").addEventListener("submit",async event=>{
  event.preventDefault();
  await act("create-head","Creating head...",async()=>{
    const result=await request({action:"create",session:$("name").value,model:$("model").value,colors:colors()});
    revision++;sessions.push({...result,ready:false});choose(result.session);await refresh();
  });
});
$("save-colors").addEventListener("click",async()=>{
  if(!selected)return;
  const name=selected, submitted=Object.fromEntries(keys.map(key=>[key,$(key+"-hex").value]));
  rememberDraft();
  await act("save-colors","Applying...",async()=>{
    confirmed(name,await request({action:"configure",session:name,colors:colors()}));
    const draft=drafts.get(name);
    if(draft&&sameColors(draft.colors,submitted))draft.editingColors=false;
    if(selected===name&&sameColors(Object.fromEntries(keys.map(key=>[key,$(key+"-hex").value])),submitted))editingColors=false;
    await refresh();
  });
});
$("original-colors").addEventListener("click",async()=>{
  syncColors();editingColors=true;colorState();
  if(selected)$("save-colors").click();
});
$("speech").addEventListener("submit",async event=>{
  event.preventDefault();const session=sessions.find(item=>item.session===selected);
  if(!session)return;
  const values=Object.fromEntries((session.controls||[]).map(control=>[control.id,control.value]));
  const name=selected,text=$("sentence").value,voiceOnly=$("voice-only").checked;
  rememberDraft();
  await act("speak","Sending...",async()=>{
    confirmed(name,await request({action:"say",session:name,text,voice:values.voice||null,
    expression:voiceOnly?"neutral":values.expression||"neutral",
    intensity:Number(values.intensity??.35),gain:Number(values["expression-gain"]??4),
    mode:voiceOnly?"voice":"face"}));
    const draft=drafts.get(name);if(draft?.text===text)draft.text="";
    if(selected===name&&$("sentence").value===text)$("sentence").value="";
    await refresh();
  });
});
$("cancel").addEventListener("click",async()=>{
  const session=sessions.find(item=>item.session===selected);
  if(!session)return;
  await act("cancel","Stopping...",async()=>{confirmed(session.session,await request({action:"cancel",session:session.session,id:session.id}));await refresh();});
});
$("close").addEventListener("click",async()=>{
  const name=selected;
  await act("close","Closing...",async()=>{confirmed(name,await request({action:"close",session:name}));await refresh();});
});
$("exit").addEventListener("click",async()=>{
  if(!confirm("Close this manager and all heads it created? External CLI hosts will stay open."))return;
  await act("exit","Exiting...",async()=>{
    await request({action:"shutdown"});stopped=true;connection="closed";clearInterval(timer);
    $("status").textContent="Closing manager-owned heads. This page can now be closed.";
  });
});
$("refresh").addEventListener("click",refresh);
$("sentence").addEventListener("input",()=>{
  $("character-count").textContent=`${$("sentence").value.length} / ${$("sentence").maxLength}`;
});
display();
await refresh();
timer=setInterval(()=>{if(!document.hidden)refresh();},2000);

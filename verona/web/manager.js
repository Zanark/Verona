const $ = id => document.getElementById(id);
const token = location.hash.slice(1), keys = ["mesh","eyes","hair","lips","eyebrows"];
const defaults = {mesh:"#4DE8DB",eyes:"#FF0406",hair:"#331B0F",lips:"#A83252",eyebrows:"#21150F"};
let selected = null, sessions = [], polling = false, editingColors = false, controlSignature = "";
function fail(error) { $("error").textContent = error.message || String(error); }
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
  hex.pattern = "#?(?:[a-fA-F0-9]{3}|[a-fA-F0-9]{6})|"; hex.maxLength = 7;
  picker.addEventListener("input",()=>{hex.value=picker.value.toUpperCase();editingColors=true;});
  hex.addEventListener("input",()=>{
    editingColors=true;
    let value=hex.value.replace(/^#/,"");
    if (/^[\da-f]{3}$/i.test(value)) value=[...value].map(c=>c+c).join("");
    if (/^[\da-f]{6}$/i.test(value)) picker.value="#"+value;
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
    $(key+"-picker").value=value[key]||defaults[key];
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
      try {await request({action:"settings",session:name,settings:{[spec.id]:spec.type==="checkbox"?input.checked:input.value}});controlSignature="";input.blur();await refresh();}
      catch(error){fail(error);controlSignature="";await refresh();}
    });
    label.append(title,input);
    if(input.disabled) {
      const hint=document.createElement("small");hint.className="control-hint";
      hint.textContent=session.ready?"Currently unavailable for this head's mode or activity. Not necessarily fixed at creation.":
        "Currently unavailable: this head is not ready.";
      label.append(hint);$("readonly-controls").append(label);
    } else {$("controls").append(label);editable++;}
  }
  $("no-editable").hidden=editable>0;
}
function display() {
  $("sessions").replaceChildren();
  for(const session of sessions) {
    const button=document.createElement("button");
    button.textContent=`${session.session} | ${session.appearance?.model||"unknown"} | ${session.state}`;
    button.classList.toggle("active",session.session===selected);
    button.addEventListener("click",()=>choose(session.session));$("sessions").append(button);
  }
  const session=sessions.find(item=>item.session===selected);
  $("create").hidden=Boolean(selected);$("selected").hidden=!session;
  $("heading").textContent=session?`${session.session} — ${session.appearance?.model||"unknown"}`:"Create a head";
  $("status").textContent=session?`${session.state}${session.error?": "+session.error:""}`:"Choose a name, variant and optional colors.";
  $("save-colors").disabled=Boolean(selected)&&!session?.ready;
  $("colors").disabled=Boolean(selected)&&!session?.ready;
  if(session&&!editingColors)syncColors(session.appearance?.colors);
  if(session)showControls(session);
  $("speech").querySelector("button").disabled=!session?.ready||["generating","playing","cancelling"].includes(session.state);
  $("cancel").disabled=!session?.id||!["generating","playing","cancelling"].includes(session.state);
  $("close").disabled=!session?.ready;
}
function choose(name) {selected=name;editingColors=false;controlSignature="";$("error").textContent="";display();}
async function refresh() {
  if(polling)return;polling=true;
  try {
    const result=await request({action:"list"});sessions=result.sessions;
    if(selected&&!sessions.some(session=>session.session===selected)){
      selected=null;editingColors=false;controlSignature="";syncColors();
    }
    if(selected){
      const name=selected,current=await request({action:"inspect",session:name});
      if(selected===name)sessions=sessions.map(session=>session.session===name?current:session);
    }
    if(!$("model").options.length)for(const [id,label] of Object.entries(result.models))$("model").add(new Option(label,id));
    display();
  } catch(error){fail(error);}
  finally{polling=false;}
}
$("new").addEventListener("click",()=>{choose(null);syncColors();});
$("create").addEventListener("submit",async event=>{
  event.preventDefault();$("error").textContent="";
  try{const result=await request({action:"create",session:$("name").value,model:$("model").value,colors:colors()});selected=result.session;editingColors=false;await refresh();}
  catch(error){fail(error);}
});
$("save-colors").addEventListener("click",async()=>{
  if(!selected)return;
  try{await request({action:"configure",session:selected,colors:colors()});editingColors=false;await refresh();}catch(error){fail(error);}
});
$("original-colors").addEventListener("click",async()=>{
  syncColors();editingColors=true;
  if(selected)$("save-colors").click();
});
$("speech").addEventListener("submit",async event=>{
  event.preventDefault();const session=sessions.find(item=>item.session===selected);
  const values=Object.fromEntries((session.controls||[]).map(control=>[control.id,control.value]));
  try{await request({action:"say",session:selected,text:$("sentence").value,voice:values.voice||null,
    expression:$("voice-only").checked?"neutral":values.expression||"neutral",
    intensity:Number(values.intensity??.35),gain:Number(values["expression-gain"]??4),
    mode:$("voice-only").checked?"voice":"face"});$("sentence").value="";await refresh();}
  catch(error){fail(error);}
});
$("cancel").addEventListener("click",async()=>{
  const session=sessions.find(item=>item.session===selected);
  try{await request({action:"cancel",session:selected,id:session.id});await refresh();}catch(error){fail(error);}
});
$("close").addEventListener("click",async()=>{
  try{await request({action:"close",session:selected});await refresh();}catch(error){fail(error);}
});
$("exit").addEventListener("click",async()=>{
  if(!confirm("Close this manager and all heads it created? External CLI hosts will stay open."))return;
  try{await request({action:"shutdown"});clearInterval(timer);$("status").textContent="Closing manager-owned heads. This page can now be closed.";}catch(error){fail(error);}
});
$("refresh").addEventListener("click",refresh);
await refresh();
const timer=setInterval(()=>{if(!document.hidden)refresh();},2000);

import {createStudyRenderer} from "/mpfb-renderer.mjs";
import {startAgent} from "/agent-player.mjs";
import {APPEARANCE_KEYS, COLOR_SWATCHES, createAppearance, parseFaceColor} from "/face-colors.mjs";

const $ = id => document.getElementById(id);
const audio = $("audio"), token = location.hash.slice(1);
let model, draw, frames, metadata, pose, animation = 0, url = null, lost = false;
let loading = false, resting = true;
let owned = false;
const desktop = window.veronaDesktop;
const appearance = createAppearance(colors => {
  draw?.forEach(fn => fn.setColors(colors));
  for (const key of APPEARANCE_KEYS) {
    $(`${key}-color`).value = $(`${key}-hex`).value = colors[key] || COLOR_SWATCHES[key];
    $(`${key}-hex`).setCustomValidity("");
    $(`${key}-default`).textContent = colors[key] === null ? "Original" : "Custom";
  }
  $("appearance-note").textContent = colors.hair === null
    ? "Original native study: no hair. Choose a hair color to show an optional static procedural scalp cap."
    : "Hair: optional static procedural scalp cap, not imported MPFB hair. Lips/brows: approximate rest-coordinate color masks, not new anatomy.";
  if (model && !lost) renderAt(frames && !resting ? audio.currentTime : null);
});
window.veronaAppearance = appearance;
const editable = ["generate", "stop", "text", "voice", "expression", "intensity", "expression-gain", "yaw",
  ...APPEARANCE_KEYS.flatMap(key => [`${key}-color`, `${key}-hex`, `${key}-reset`])];
function lockControls() {
  for (const id of editable) $(id).disabled = loading || owned || lost;
  $("stop").disabled ||= !frames;
  audio.controls = !owned;
}
for (const key of APPEARANCE_KEYS) {
  const picker=$(`${key}-color`), hex=$(`${key}-hex`);
  const edit=(value,canonicalize)=>{
    try {
      const color=parseFaceColor(value);
      const invalid=APPEARANCE_KEYS.filter(other=>other!==key)
        .map(other=>[$(`${other}-hex`),$(`${other}-hex`).value,$(`${other}-hex`).validationMessage])
        .filter(([, , error])=>error);
      appearance.apply({[key]:color.hex});
      for(const [input,text,error] of invalid){input.value=text;input.setCustomValidity(error);}
      hex.value=canonicalize?color.hex:value;
      $("error").textContent=invalid.map(([, , error])=>error).join(" ");
      window.dispatchEvent(new CustomEvent("verona-appearance",{detail:appearance.read()}));
    } catch(error) {
      hex.setCustomValidity(error.message);$("error").textContent=error.message;
    }
  };
  picker.addEventListener("input",()=>edit(picker.value,true));
  hex.addEventListener("input",()=>edit(hex.value,false));
  hex.addEventListener("change",()=>edit(hex.value,true));
  $(`${key}-reset`).addEventListener("click",()=>{
    appearance.apply({[key]:null});
    $("error").textContent="";
    window.dispatchEvent(new CustomEvent("verona-appearance",{detail:appearance.read()}));
  });
}

async function request(path, body) {
  const response = await fetch(path, {
    headers: {"X-Verona-Token": token, ...(body ? {"Content-Type": "application/json"} : {})},
    ...(body ? {method: "POST", body: JSON.stringify(body)} : {})
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `Local request failed: ${response.status}`);
  }
  return response;
}

function renderAt(seconds = null, yaw = Number($("yaw").value)) {
  if (lost) throw new Error("WebGL context lost. Reload this study to restart.");
  if (seconds === null || !frames) pose.set(model.rest);
  else {
    const frame = Math.min(metadata.frames - 1, Math.max(0, seconds * metadata.fps));
    const a = Math.floor(frame), b = Math.min(a + 1, metadata.frames - 1), blend = frame - a;
    for (let i = 0; i < pose.length; i++) {
      pose[i] = frames[a * pose.length + i] * (1 - blend) + frames[b * pose.length + i] * blend;
    }
  }
  draw.forEach(fn => fn(pose, yaw));
  $("caption").textContent = `${seconds === null ? "Original native rest" : `${metadata.expression} | ${seconds.toFixed(2)}s`} | ${metadata?.expressionGainSetting ?? Number($("expression-gain").value)}x source / native rig | ${yaw} deg`;
}

function fail(error) {
  audio.pause();
  cancelAnimationFrame(animation);
  $("error").textContent = error.message;
}

function stop() {
  resting = true;
  audio.pause();
  audio.currentTime = 0;
  cancelAnimationFrame(animation);
  if (model && !lost) renderAt();
}

function tick() {
  try {
    if (resting) { renderAt(); return; }
    renderAt(audio.currentTime);
    if (!audio.paused && !audio.ended) animation = requestAnimationFrame(tick);
  } catch (error) { fail(error); }
}

async function generate(options = {}) {
  if (loading || lost) throw new Error("Wait for generation, or reload a lost WebGL context.");
  loading = true;
  lockControls();
  $("error").textContent = "";
  stop();
  frames = metadata = null;
  audio.removeAttribute("src"); audio.load();
  if (url) URL.revokeObjectURL(url);
  url = null;
  $("stop").disabled = true;
  $("status").textContent = "Generating real Claire speech and transferring its complete pose...";
  try {
    const result = await (await request("/api/generate", {
      text: $("text").value, voice: $("voice").value, expression: $("expression").value,
      intensity: Number($("intensity").value), expressionGain: options.gain ?? Number($("expression-gain").value),
      ...(options.agentRequestId ? {agentRequestId: options.agentRequestId} : {})
    })).json();
    const [motion, sound] = await Promise.all([
      request(`/api/clip/${result.id}/motion`).then(r => r.arrayBuffer()),
      request(`/api/clip/${result.id}/audio`).then(r => r.blob())
    ]);
    const data = new Float32Array(motion);
    if (result.frameFormat !== "float32-native-cm" || result.vertices !== pose.length / 3 ||
        !Number.isInteger(result.frames) || result.frames < 1 || !(result.fps > 0) ||
        data.length !== result.frames * pose.length || !data.every(Number.isFinite)) {
      throw new Error("Native motion format or geometry is invalid; clip was not installed.");
    }
    if (lost) throw new Error("WebGL context lost during generation. Reload to restart.");
    frames = data; metadata = result;
    url = URL.createObjectURL(sound); audio.src = url;
    $("stop").disabled = false;
    $("status").textContent = `Ready. Press audio Play. ${result.frames} frames; ${result.generationSeconds.toFixed(2)}s generation including ${result.transferSeconds.toFixed(2)}s native transfer.`;
    return result;
  } catch (error) {
    $("status").textContent = "Generation failed; no replacement clip is playable.";
    fail(error);
    throw error;
  } finally {
    loading = false;
    lockControls();
  }
}

async function prepareAgent(message) {
  if (loading || lost) throw new Error("Native study is busy or its WebGL context is lost.");
  $("text").value=message.text; $("voice").value=message.voice;
  $("expression").value=message.expression; $("intensity").value=String(message.intensity);
  $("expression-gain").value=String(message.gain);
  if (message.mode !== "voice") {
    const result=await generate({agentRequestId:message.id,gain:message.gain});
    return {audio,cache:{cacheHit:result.cacheHit,speechCacheHit:result.speechCacheHit===true}};
  }
  loading=true;lockControls();stop();
  frames=metadata=null;audio.removeAttribute("src");audio.load();
  if(url)URL.revokeObjectURL(url);url=null;
  try {
    const sound=await (await request("/api/preview", {
      text:message.text,voice:message.voice,expression:message.expression,
      intensity:message.intensity,agentRequestId:message.id,
      voiceSettings:{pitch:0,rate:0,bass:0,treble:0,emphasis:"none"}
    })).blob();
    url=URL.createObjectURL(sound);audio.src=url;
    $("status").textContent="Agent voice-only preview ready; native face remains at rest.";
    return {audio,cache:{}};
  } catch(error) {fail(error);throw error;}
  finally {loading=false;lockControls();}
}

audio.addEventListener("play", () => { resting = !frames; cancelAnimationFrame(animation); tick(); });
audio.addEventListener("pause", () => cancelAnimationFrame(animation));
audio.addEventListener("seeked", () => {
  cancelAnimationFrame(animation);
  if (frames && !lost && (!resting || audio.currentTime > 0)) { resting = false; tick(); }
});
audio.addEventListener("ended", () => { stop(); $("status").textContent = "Playback ended. Native rest restored."; });
audio.addEventListener("error", () => fail(new Error("Audio failed to load or decode. Generate again, or reload an expired session.")));
$("yaw").addEventListener("input", () => {
  if (model && !lost) renderAt(frames && !resting ? audio.currentTime : null);
});
audio.volume = Number($("volume").value);
$("volume").addEventListener("input", () => { audio.volume = Number($("volume").value); });
$("stop").addEventListener("click", stop);
$("generate").addEventListener("click", () => generate().catch(fail));
window.addEventListener("pagehide", () => { stop(); if (url) URL.revokeObjectURL(url); });
document.querySelectorAll("canvas").forEach(canvas => canvas.addEventListener("webglcontextlost", event => {
  event.preventDefault(); lost = true;
  $("generate").disabled = $("stop").disabled = true;
  fail(new Error("WebGL context lost. Reload this isolated study to restart."));
}));

try {
  const [session, native] = await Promise.all([
    request("/api/session").then(r => r.json()), request("/api/mesh").then(r => r.json())
  ]);
  model = native;
  if (session.appearance?.session) document.title = `Verona | ${session.appearance.session} | ${session.appearance.model}`;
  $("wire").dataset.appearanceModel = session.appearance?.model || "mpfb";
  $("wire").dataset.appearanceSession = session.appearance?.session || "";
  pose = Float32Array.from(model.rest);
  const managed = Boolean(desktop?.agentEnabled);
  draw = [createStudyRenderer($("wire"), model, false, false, managed)];
  if (!managed) draw.push(createStudyRenderer($("surface"), model, true, false));
  for (const voice of session.voices) $("voice").add(new Option(voice.name, voice.name));
  $("voice").value = session.defaultVoice;
  $("text").maxLength = session.limits.characters;
  appearance.apply(session.appearance?.colors || {});
  $("generate").disabled = false;
  if (desktop?.agentEnabled) await startAgent(desktop, prepareAgent, locked => {
    owned=locked;lockControls();
  }, fail);
  window.mpfbPlayer = {ready: true, generate, renderAt, get metadata() { return metadata; }};
} catch (error) { fail(error); }

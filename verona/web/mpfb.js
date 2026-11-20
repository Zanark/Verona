import {createStudyRenderer} from "/mpfb-renderer.mjs";

const $ = id => document.getElementById(id);
const audio = $("audio"), token = location.hash.slice(1);
let model, draw, frames, metadata, pose, animation = 0, url = null, lost = false;
let loading = false, resting = true;

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
  $("caption").textContent = `${seconds === null ? "Original native rest" : `${metadata.expression} | ${seconds.toFixed(2)}s`} | 4x source / native rig | ${yaw} deg`;
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

async function generate() {
  if (loading || lost) throw new Error("Wait for generation, or reload a lost WebGL context.");
  loading = true;
  $("generate").disabled = true;
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
      intensity: Number($("intensity").value), expressionGain: 4
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
    $("generate").disabled = lost;
  }
}

audio.addEventListener("play", () => { resting = false; cancelAnimationFrame(animation); tick(); });
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
  pose = Float32Array.from(model.rest);
  draw = [createStudyRenderer($("wire"), model, false, false),
    createStudyRenderer($("surface"), model, true, false)];
  for (const voice of session.voices) $("voice").add(new Option(voice.name, voice.name));
  $("voice").value = session.defaultVoice;
  $("text").maxLength = session.limits.characters;
  renderAt();
  $("generate").disabled = false;
  window.mpfbPlayer = {ready: true, generate, renderAt, get metadata() { return metadata; }};
} catch (error) { fail(error); }

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import {APPEARANCE_KEYS, COLOR_SWATCHES, createAppearance, parseFaceColor} from "../verona/web/face-colors.mjs";

const elements = new Map(), pending = new Map();
let sequence = 0, rendered, prepareAgent, lockAgent;
const requests=[];
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    value: id === "yaw" ? "0" : id === "volume" ? ".8" : id === "expression-gain" ? "4" : ".6",
    textContent: "", paused: true, currentTime: 0,
    dataset:{}, setCustomValidity() {},
    listeners: new Map(),
    addEventListener(name, fn) { this.listeners.set(name, fn); },
    emit(name) { this.listeners.get(name)?.(); },
    pause() { this.paused = true; this.emit("pause"); },
    load() {}, add() {}, removeAttribute() {}
  });
  return elements.get(id);
}
const native = {rest: Array(9).fill(0)};
const metadata = {id: "fixture", expression: "neutral", vertices: 3, frames: 2, fps: 30,
  frameFormat: "float32-native-cm", generationSeconds: .1, transferSeconds: .01};
const motion = new Float32Array(18).fill(1);
const window = {addEventListener() {}, veronaDesktop:{agentEnabled:true}};
const source = (await fs.readFile(new URL("../verona/web/mpfb.js", import.meta.url), "utf8"))
  .replace(/^import .* from ".*";$/gm, "");
await vm.runInNewContext(`(async()=>{${source}})()`, {
  window, location: {hash: "#fixture"}, Float32Array,
  document: {getElementById: element, querySelectorAll: () => [element("wire"), element("surface")]},
  APPEARANCE_KEYS,COLOR_SWATCHES,createAppearance,parseFaceColor,
  startAgent: async (desktop,prepare,lock) => {prepareAgent=prepare;lockAgent=lock;},
  createStudyRenderer: () => Object.assign(pose => { rendered = [...pose]; },{setColors(){}}),
  requestAnimationFrame: fn => { pending.set(++sequence, fn); return sequence; },
  cancelAnimationFrame: id => pending.delete(id),
  Option: function() {}, URL: {createObjectURL: () => "blob:fixture", revokeObjectURL() {}},
  fetch: async (path,options) => { requests.push({path,body:options.body&&JSON.parse(options.body)});return ({
    ok: true,
    json: async () => path === "/api/session" ? {
      voices: [{name: "Fixture voice"}], defaultVoice: "Fixture voice", limits: {characters: 280}
    } : path === "/api/mesh" ? native : metadata,
    arrayBuffer: async () => motion.buffer,
    blob: async () => ({})
  });}
});
assert(window.mpfbPlayer.ready);
element("expression-gain").value="2";
await window.mpfbPlayer.generate();
assert.equal(requests.findLast(item=>item.path==="/api/generate").body.expressionGain,2,
  "Native GUI gain must reach generation instead of a hardcoded fallback.");
const audio = element("audio");
assert.equal(audio.volume,.8);
audio.paused = false;
audio.emit("play");
assert.equal(pending.size, 1);
audio.emit("seeked");
assert.equal(pending.size, 1, "Seeking must replace, not duplicate, the animation loop.");
audio.emit("ended");
audio.emit("seeked");
assert.equal(pending.size, 0, "End/reset must leave no queued pose callback.");
assert.deepEqual(rendered, native.rest, "A pending seek must not replace native rest with frame zero.");
const message={id:"owned-request",text:"Fixture",voice:"Fixture voice",
  expression:"neutral",intensity:.5,gain:2,mode:"face"};
lockAgent(true);
assert(element("text").disabled);
element("volume").value="0";element("volume").emit("input");
assert.equal(audio.volume,0,"Owned native speech must still support the manager volume control.");
await prepareAgent(message);
assert(element("generate").disabled,"Preparation cannot unlock controls owned by agent speech.");
const generated=requests.findLast(item=>item.path==="/api/generate").body;
assert.equal(generated.agentRequestId,message.id);
assert.equal(generated.expressionGain,2);
assert.equal(element("expression-gain").value,"2");
const voice=await prepareAgent({...message,mode:"voice"});
assert.equal(voice.audio,audio);
assert.equal(requests.findLast(item=>item.path==="/api/preview").body.agentRequestId,message.id);
audio.paused=false;audio.emit("play");
assert.deepEqual(rendered,native.rest,"Voice-only speech must leave the native head at rest.");
assert.equal(pending.size,0);
lockAgent(false);
assert(!element("text").disabled);
console.log("Native playback seek/end single-loop regression passed.");

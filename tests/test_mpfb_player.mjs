import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const elements = new Map(), pending = new Map();
let sequence = 0, rendered;
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    value: id === "yaw" ? "0" : ".6", textContent: "", paused: true, currentTime: 0,
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
const window = {addEventListener() {}};
const source = (await fs.readFile(new URL("../verona/web/mpfb.js", import.meta.url), "utf8"))
  .replace('import {createStudyRenderer} from "/mpfb-renderer.mjs";', "");
await vm.runInNewContext(`(async()=>{${source}})()`, {
  window, location: {hash: "#fixture"}, Float32Array,
  document: {getElementById: element, querySelectorAll: () => [element("wire"), element("surface")]},
  createStudyRenderer: () => pose => { rendered = [...pose]; },
  requestAnimationFrame: fn => { pending.set(++sequence, fn); return sequence; },
  cancelAnimationFrame: id => pending.delete(id),
  Option: function() {}, URL: {createObjectURL: () => "blob:fixture", revokeObjectURL() {}},
  fetch: async path => ({
    ok: true,
    json: async () => path === "/api/session" ? {
      voices: [{name: "Fixture voice"}], defaultVoice: "Fixture voice", limits: {characters: 280}
    } : path === "/api/mesh" ? native : metadata,
    arrayBuffer: async () => motion.buffer,
    blob: async () => ({})
  })
});
assert(window.mpfbPlayer.ready);
await window.mpfbPlayer.generate();
const audio = element("audio");
audio.paused = false;
audio.emit("play");
assert.equal(pending.size, 1);
audio.emit("seeked");
assert.equal(pending.size, 1, "Seeking must replace, not duplicate, the animation loop.");
audio.emit("ended");
audio.emit("seeked");
assert.equal(pending.size, 0, "End/reset must leave no queued pose callback.");
assert.deepEqual(rendered, native.rest, "A pending seek must not replace native rest with frame zero.");
console.log("Native playback seek/end single-loop regression passed.");

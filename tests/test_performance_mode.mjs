import assert from "node:assert/strict";
import {attachPerformanceMode} from "../verona/web/performance-mode.mjs";

class Control extends EventTarget {
  constructor(fields) { super(); Object.assign(this, fields); }
  input() { this.dispatchEvent(new Event("input")); }
  emit(event) { this.dispatchEvent(new Event(event)); }
}
const input = new Control({type: "checkbox", checked: false});
const opacity = new Control({value: "65"});
const quickInput = new Control({checked: false}), quickOpacity = new Control({value: "100"});
const output = {}, quickOutput = {};
const audio = new Control({paused: true, ended: false, error: null});
const voice = new Control({paused: true, ended: false, error: null});
const states = [];
attachPerformanceMode(input, opacity, [audio, voice], state => states.push(state),
  {quickInput, quickOpacity, output, quickOutput});
assert.deepEqual(states.at(-1), {sleeping: false, opacity: .65, enabled: false});
quickInput.checked = true; quickInput.input();
assert(input.checked);
assert.deepEqual(states.at(-1), {sleeping: true, opacity: .1, enabled: true});
const count = states.length;
audio.emit("pause"); audio.emit("emptied");
assert.equal(states.length, count, "Duplicate idle notifications must not redraw or send IPC.");
audio.paused = false; audio.emit("play");
assert.deepEqual(states.at(-1), {sleeping: false, opacity: 1, enabled: true});
voice.paused = false; voice.emit("play");
audio.paused = true; audio.emit("pause");
assert.equal(states.at(-1).sleeping, false, "The other audio owner still keeps the head awake.");
voice.paused = true; voice.emit("pause");
assert.equal(states.at(-1).sleeping, true);
quickOpacity.value = "0"; quickOpacity.input();
assert.equal(opacity.value, "0"); assert.equal(quickOutput.value, "0%");
assert.equal(states.at(-1).opacity, .1, "Performance mode overrides but retains normal opacity.");
voice.paused = false; voice.emit("playing");
assert.equal(states.at(-1).opacity, 1);
voice.error = new Error("Fixture decode failure"); voice.emit("error");
assert.equal(states.at(-1).sleeping, true, "Failed playback cannot keep a silent head awake.");
voice.error = null; voice.ended = true; voice.emit("ended");
input.checked = false; input.input();
assert.equal(quickInput.checked, false);
assert.deepEqual(states.at(-1), {sleeping: false, opacity: 0, enabled: false});
opacity.value = "100"; opacity.input();
assert.equal(states.at(-1).opacity, 1); assert.equal(quickOpacity.value, "100");
assert.equal(output.value, "100%");
console.log("Performance media lifecycle, overrides, quick controls and idempotent idle state pass.");

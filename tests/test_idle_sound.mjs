import assert from "node:assert/strict";
import {createIdleSound, synthesizeIdleSound} from "../verona/web/idle-sound.mjs";
import {createIdleClock} from "../verona/web/idle-life.mjs";

for (const [kind, duration] of [["yawn",4.2],["sneeze",2.7]]) {
  const data = synthesizeIdleSound(kind);
  assert.equal(data.length, Math.round(duration*24000));
  let energy = 0, peak = 0;
  for (const value of data) {
    assert(Number.isFinite(value));
    peak = Math.max(peak, Math.abs(value)); energy += value*value;
  }
  assert(peak > .89 && peak <= .901, "Full-amplitude normalized cue without digital clipping.");
  assert(Math.sqrt(energy/data.length) > .05);
  assert.equal(Math.abs(data[0]), 0); assert.equal(Math.abs(data.at(-1)), 0);
}
assert.throws(() => synthesizeIdleSound("unknown"), /Unknown/);

let enabled = true, level = .75, time = 0, contexts = 0, buffers = 0, stops = 0, starts = [];
let resume, failure = false;
const messages = [], sources = [];
const context = {
  state: "running", destination: {},
  suspend: async () => { context.state = "suspended"; },
  resume: async () => {
    if (failure) throw Error("Output unavailable");
    if (resume) await new Promise(resolve => { resume.resolve = resolve; });
    context.state = "running";
  },
  createBuffer: () => { buffers++; return {copyToChannel() {}}; },
  createGain: () => ({gain: {}, connect() {}, disconnect() {}}),
  createBufferSource: () => {
    const source = {buffer: null, connect() {}, disconnect() {}, stop() { stops++; },
      start(_when, offset) { starts.push(offset); }};
    sources.push(source); return source;
  },
};
const sound = createIdleSound({enabled: () => enabled, volume: () => level, now: () => time,
  createContext: () => { contexts++; return context; }, report: text => messages.push(text)});
const yawn = {id: "yawn", sound: "yawn", duration: 4200};
const sneeze = {id: "sneeze", sound: "sneeze", duration: 2700};
await sound.start({id: "smile"});
assert.equal(contexts,0,"Silent gestures create no audio context.");
enabled = false; await sound.start(yawn); assert.equal(contexts,0);
enabled = true; level = 0; await sound.start(yawn); assert.equal(contexts,0);
level = .75; await sound.start(yawn);
assert.equal(starts.length,1); assert.equal(contexts,1); assert.equal(buffers,1);
await sound.start(yawn);
assert.equal(stops,1); assert.equal(buffers,1,"Only latest buffer retained/reused.");
await sound.start(sneeze); assert.equal(buffers,2);
sources.at(-1).onended();
assert.equal(context.state,"suspended","Finished output suspends its audio clock.");
assert(messages.at(-1).includes("ready"));

resume = {};
const stale = sound.start(yawn);
sound.stop(); time += 600;
resume.resolve(); resume = null; await stale;
assert.equal(starts.length,3,"Cancelled asynchronous resume never starts delayed audio.");
assert.equal(context.state,"suspended");
resume = {};
const late = sound.start(yawn);
time += 5000; resume.resolve(); resume = null; await late;
assert.equal(starts.length,3,"Overdue audio is skipped instead of replayed out of sync.");
failure = true; await sound.start(yawn);
assert(messages.at(-1).includes("Output unavailable"),"Device/resume failure is explicit.");
failure = false;

const lockedContext = {...context, state:"suspended",
  async resume() { this.state = "running"; }, async suspend() { this.state = "suspended"; }};
const locked = createIdleSound({enabled: () => true, volume: () => .75,
  createContext: () => lockedContext, report: text => messages.push(text)});
await locked.start(yawn);
assert(messages.at(-1).includes("autoplay"),"Browser autoplay blocking is not silent success.");
await locked.unlock();
assert(messages.at(-1).includes("ready"));
await locked.start(yawn);
assert.equal(lockedContext.state,"running","Explicit browser gesture permits future automatic output.");
locked.stop();

let startCount = 0, stopCount = 0, current = 0;
const clock = createIdleClock(() => {}, {now: () => current, random: () => .5,
  schedule: () => 1, cancel() {}, onStart: () => startCount++, onStop: () => stopCount++});
clock.setActive(true); clock.preview("yawn"); assert.equal(startCount,1);
const before = stopCount; clock.interrupt(); assert.equal(stopCount,before+1);
clock.preview("sneeze"); current += 2800; clock.sample(); assert(stopCount>before+1);
clock.setActive(false);
console.log("Bounded local audio waveforms, latest-buffer ownership, mute/zero level, completion, cancellation/resume races, late starts and explicit errors passed.");

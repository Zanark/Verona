import assert from "node:assert/strict";
import test from "node:test";
import { startAgent } from "../verona/web/agent-player.mjs";

class Audio extends EventTarget {
  readyState = 1;
  duration = 2;
  paused = true;
  plays = 0;
  async play() { this.paused = false; this.plays++; }
  pause() { this.paused = true; }
}

function desktop() {
  return {
    results: [], ready: false,
    onAgent(callback) { this.receive = callback; },
    async agentReady() { this.ready = true; },
    async agentResult(value) { this.results.push(value); this.report?.(value); },
  };
}
const message = { action: "say", id: "a".repeat(32) };

test("accepted/prepared/playing is not completion; only ended completes", async () => {
  const d = desktop(), audio = new Audio();
  await startAgent(d, async () => ({ audio, cache: { cacheHit: true } }), () => {}, assert.fail);
  let playing;
  const started = new Promise((resolve) => { playing = resolve; });
  d.report = (value) => { if (value.state === "playing") playing(); };
  let finished = false;
  const task = d.receive(message).then(() => { finished = true; });
  await started;
  assert.equal(finished, false);
  assert.deepEqual(d.results.map((v) => v.state), ["playing"]);
  audio.dispatchEvent(new Event("ended"));
  await task;
  assert.deepEqual(d.results.map((v) => v.state), ["playing", "completed"]);
  assert.equal(d.results[1].cacheHit, true);
  assert.equal(audio.paused, true);
});

test("cancellation during generation never starts playback afterwards", async () => {
  const d = desktop(), audio = new Audio();
  let release;
  const preparation = new Promise((resolve) => { release = resolve; });
  await startAgent(d, () => preparation, () => {}, assert.fail);
  const task = d.receive(message);
  await d.receive({ action: "cancel", id: message.id });
  release({ audio, cache: {} });
  await task;
  assert.equal(audio.plays, 0);
  assert.deepEqual(d.results.map((v) => v.state), ["cancelled"]);
});

test("cancellation during playback pauses immediately without completed acknowledgement", async () => {
  const d = desktop(), audio = new Audio();
  let playing;
  const started = new Promise((resolve) => { playing = resolve; });
  d.report = (value) => { if (value.state === "playing") playing(); };
  await startAgent(d, async () => ({ audio, cache: {} }), () => {}, assert.fail);
  const task = d.receive(message);
  await started;
  await d.receive({ action: "cancel", id: message.id });
  assert.equal(audio.paused, true);
  await task;
  assert.deepEqual(d.results.map((v) => v.state), ["playing", "cancelled"]);
});

test("autoplay/device failure is failed, never a success-shaped fallback", async () => {
  const d = desktop(), audio = new Audio(), errors = [];
  audio.play = async () => { throw new Error("fixture output unavailable"); };
  await startAgent(d, async () => ({ audio, cache: {} }), () => {}, (e) => errors.push(e.message));
  await d.receive(message);
  assert.deepEqual(d.results.map((v) => v.state), ["failed"]);
  assert.match(d.results[0].error, /fixture output unavailable/);
  assert.equal(errors.length, 1);
});

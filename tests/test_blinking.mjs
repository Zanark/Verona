import assert from "node:assert/strict";
import {attachBlinking, createBlinkClock} from "../verona/web/blinking.mjs";

let time = 0, wakeups = 0, id = 0;
const timers = new Map();
const clock = createBlinkClock(() => wakeups++, {
  now: () => time, random: () => .5,
  schedule: (callback, delay) => { timers.set(++id, {callback, delay}); return id; },
  cancel: handle => timers.delete(handle),
});
const fire = () => {
  assert.equal(timers.size, 1);
  const [handle, timer] = [...timers][0];
  timers.delete(handle);
  time += timer.delay;
  timer.callback();
};
clock.setActive(true);
assert.equal([...timers.values()][0].delay, 5500);
assert.deepEqual(clock.sample(), {amount: 0, moving: false});
assert.equal(wakeups, 1);
clock.setActive(true);
assert.equal(wakeups, 1, "Repeated activation cannot reset the cadence or create another timer.");
fire();
assert.equal(timers.size, 0);
assert.deepEqual(clock.sample(), {amount: 0, moving: true});
time += 45;
assert.equal(clock.sample().amount, .5);
time += 45;
assert.equal(clock.sample().amount, 1);
time += 30;
assert.equal(clock.sample().amount, 1);
time += 85;
assert.equal(clock.sample().amount, .5);
time += 85;
assert.deepEqual(clock.sample(), {amount: 0, moving: false});
assert.equal(timers.size, 1, "A completed blink sleeps instead of keeping RAF alive.");
clock.setActive(false);
assert.equal(timers.size, 0);
clock.setActive(true);
fire();
time += 90;
assert.equal(clock.sample().amount, 1);
clock.setActive(false);
assert.deepEqual(clock.sample(), {amount: 0, moving: false});
time += 600000;
clock.setActive(true);
assert.equal([...timers.values()][0].delay, 5500, "Resume waits anew; it does not replay missed blinks.");
fire();
time += 1000;
assert.deepEqual(clock.sample(), {amount: 0, moving: false}, "A late frame finishes, never slows the blink.");
assert.equal(timers.size, 1);
clock.setActive(false);
assert.equal(timers.size, 0);
console.log("Deterministic blink cadence, smooth closure and bounded lifecycle passed.");

const saved = Object.fromEntries(["window", "document", "matchMedia", "setTimeout", "clearTimeout"]
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const target = fields => {
  const listeners = new Map();
  return {...fields, addEventListener(type, callback) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(callback);
  }, emit(type) { for (const listener of listeners.get(type) || []) listener(); }};
};
try {
  const input = target({checked: true}), media = target({matches: true});
  const doc = target({hidden: false}), win = target({});
  let usable = true, timerId = 0;
  const pending = new Map();
  Object.assign(globalThis, {
    window: win, document: doc, matchMedia: () => media,
    setTimeout: callback => { pending.set(++timerId, callback); return timerId; },
    clearTimeout: handle => pending.delete(handle),
  });
  const attached = attachBlinking(input, () => {}, () => usable);
  assert.equal(input.checked, false, "Reduced motion defaults natural blinking off.");
  assert.equal(pending.size, 0);
  media.matches = false; media.emit("change");
  assert.equal(input.checked, true);
  assert.equal(pending.size, 1);
  doc.hidden = true; doc.emit("visibilitychange");
  assert.equal(pending.size, 0);
  doc.hidden = false; doc.emit("visibilitychange");
  assert.equal(pending.size, 1);
  win.emit("pagehide");
  assert.equal(pending.size, 0);
  win.emit("pageshow");
  assert.equal(pending.size, 1);
  usable = false; attached.refresh();
  assert.equal(pending.size, 0, "A lost/unavailable renderer cannot keep a blink timer.");
  usable = true; attached.refresh();
  input.checked = false; input.emit("input");
  media.matches = true; media.emit("change");
  media.matches = false; media.emit("change");
  assert.equal(input.checked, false, "Explicit user choice survives OS preference changes.");
  assert.equal(pending.size, 0);
  input.checked = true; input.emit("input");
  media.matches = true; media.emit("change");
  assert.equal(input.checked, true, "Explicit opt-in may override reduced motion.");
  assert.equal(pending.size, 1);
  attached.setActive(false);
  assert.equal(pending.size, 0);
} finally {
  for (const [key, descriptor] of Object.entries(saved)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}
console.log("Reduced-motion defaults, user override, hidden pages and context availability passed.");

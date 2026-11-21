import assert from "node:assert/strict";
import {IDLE_ACTIONS, attachIdleLife, createIdleClock, idlePose, sampleIdleAction} from "../verona/web/idle-life.mjs";

const numeric = pose => Object.fromEntries(Object.entries(pose).filter(([, value]) => typeof value === "number"));
const neutral = numeric(idlePose());
const signatures = new Set();
for (const action of IDLE_ACTIONS) {
  const trajectory = [];
  for (let elapsed = 0; elapsed <= action.duration; elapsed += 10) {
    const pose = sampleIdleAction(action.id, elapsed);
    for (const [key, value] of Object.entries(numeric(pose))) {
      assert(Number.isFinite(value), `${action.id}/${key} is finite`);
      assert(Math.abs(value) <= (key === "jaw" ? 1.3 : 1), `${action.id}/${key} is bounded`);
    }
    if (elapsed === 0) assert.deepEqual(numeric(pose), neutral);
    trajectory.push(numeric(pose));
  }
  assert.deepEqual(sampleIdleAction(action.id, action.duration), idlePose());
  assert.deepEqual(sampleIdleAction(action.id, action.duration+60000), idlePose());
  signatures.add(JSON.stringify(trajectory));
}
assert.equal(signatures.size, 30, "Thirty different complete numeric trajectories, not labels alone.");
const facial = ["smile","smirk","brow","furrow","nose","press","purse","puff","jaw","shift",
  "squeeze","winkLeft","winkRight"];
const composites = ["delight","skeptic","distaste","surprise","ponder","chuckle","chew","kiss","wince","resolve"];
for (const id of composites) {
  const action = IDLE_ACTIONS.find(item => item.id === id);
  let maximum = 0;
  for (let elapsed = 0; elapsed < action.duration; elapsed += 20) {
    const pose = sampleIdleAction(id, elapsed);
    maximum = Math.max(maximum, facial.filter(key => Math.abs(pose[key]) > .05).length);
  }
  assert(maximum >= 3, `${id} overlaps at least three actual facial fields, excluding rigid pose/gaze.`);
}
for (const id of ["eye-scan","eye-roll","wink","alternate-wink","reading"]) {
  const action = IDLE_ACTIONS.find(item => item.id === id);
  assert(Array.from({length: 50}, (_, i) => sampleIdleAction(id, action.duration*i/50))
    .some(pose => Math.abs(pose.gazeX)+Math.abs(pose.gazeY)+pose.winkLeft+pose.winkRight > .2));
}
const yawn = IDLE_ACTIONS.find(action => action.id === "yawn");
const openYawn=sampleIdleAction("yawn",2100);
assert(openYawn.yawn>.9&&openYawn.squeeze>.7);
assert.equal(openYawn.purse,0,"Yawning separates lips rather than pushing a puckered lip forward.");
assert(IDLE_ACTIONS.filter(action => action !== yawn).every(action => yawn.weight === 3*action.weight));
assert(!yawn.cooldown, "Recent-history exclusion still applies; no extra rarity cooldown fights the requested weighting.");
const lottery = new Map();
for (let cell = 0; cell < 32; cell++) {
  let timestamp = 0, callback;
  const values = [.5, (cell+.5)/32, .5];
  const probe = createIdleClock(() => {}, {now: () => timestamp, random: () => values.shift(),
    schedule: fn => { callback = fn; return 1; }, cancel() {}});
  probe.setActive(true); timestamp = 20000; callback();
  const id = probe.sample().id;
  lottery.set(id, (lottery.get(id) || 0)+1); probe.setActive(false);
}
assert.equal(lottery.get("yawn"),3,"Actual selection assigns three equal-probability cells to yawn.");
assert(IDLE_ACTIONS.filter(action => action.id !== "yawn").every(action => lottery.get(action.id)===1));
assert.throws(() => sampleIdleAction("missing", 0), /Unknown idle action/);
const left = sampleIdleAction("look", 700, -1), right = sampleIdleAction("look", 700, 1);
assert.equal(left.yaw, -right.yaw);
assert.equal(left.gazeX, -right.gazeX);

let time = 0, wakeups = 0, next = 0, usable = true, seed = 19371;
const random = () => { seed = (1664525*seed+1013904223) >>> 0; return seed/4294967296; };
const timers = new Map(), cancelled = [];
const clock = createIdleClock(() => wakeups++, {
  now: () => time, random, allowed: () => usable,
  schedule(callback, delay) {
    const id = ++next;
    timers.set(id, {callback, delay, deadline: time+delay});
    return id;
  },
  cancel(id) { cancelled.push(timers.get(id)?.callback); timers.delete(id); },
});
const fire = (late = 0) => {
  assert.equal(timers.size, 1, "Exactly one waiting timeout.");
  const [id, timer] = [...timers][0];
  assert(timer.delay >= 12000 && timer.delay < 28000);
  timers.delete(id); time = timer.deadline+late; timer.callback();
};
clock.setActive(true);
assert.equal(wakeups, 0, "Waiting does not request rendering.");
clock.setActive(true);
assert.equal(timers.size, 1);
const seen = new Set(), recent = [], last = new Map();
for (let run = 0; run < 400; run++) {
  fire();
  const {id} = clock.sample(), action = IDLE_ACTIONS.find(item => item.id === id);
  assert(action);
  assert(!recent.includes(id), "No action repeats within the last four.");
  if (last.has(id)) assert(time >= last.get(id), "Rare actions respect their full cooldown.");
  last.set(id, time+action.duration+(action.cooldown || 0));
  recent.push(id); if (recent.length > 4) recent.shift();
  seen.add(id);
  assert.equal(timers.size, 0, "An active gesture has no second timer.");
  time += action.duration;
  assert.equal(clock.sample().moving, false);
  assert.equal(timers.size, 1);
}
assert.equal(seen.size, 30, "All thirty actions are reachable by automatic weighted selection.");
clock.preview("sneeze"); time += 1100;
assert(clock.sample().squeeze > .9);
clock.interrupt();
assert.deepEqual(clock.sample(), idlePose(), "Interruption immediately removes the complete layer.");
assert.equal(timers.size, 1);
const stale = cancelled.at(-1), before = wakeups;
stale();
assert.equal(wakeups, before, "A cancelled callback cannot resurrect an action.");
fire(600000);
assert.deepEqual(clock.sample(), idlePose(), "Suspension skips an overdue start.");
assert.equal(timers.size, 1);
fire();
time += 600000;
assert.deepEqual(clock.sample(), idlePose(), "A late frame finishes instead of replaying history.");
clock.preview("smile"); time += 800;
usable = false;
assert.deepEqual(clock.sample(), idlePose(), "Eligibility loss cancels without requiring another event.");
assert.equal(timers.size, 0);
assert.throws(() => clock.preview("smile"), /idle head/);
usable = true; clock.setActive(true);
assert.equal(timers.size, 1);
clock.setActive(false);
assert.equal(timers.size, 0);
assert.deepEqual(clock.sample(), idlePose());
console.log("30 distinct/reachable bounded trajectories, five eye actions, ten 3+ facial-field composites and weighted yawn passed.");

const saved = Object.fromEntries(["window", "document", "matchMedia", "setTimeout", "clearTimeout"]
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const target = fields => {
  const value = new EventTarget();
  Object.assign(value, fields);
  value.emit = type => value.dispatchEvent(new Event(type));
  return value;
};
try {
  const input = target({checked: true}), media = target({matches: true});
  const doc = target({hidden: false}), win = target({});
  const pending = new Map(); let id = 0, ready = true;
  Object.assign(globalThis, {
    window: win, document: doc, matchMedia: () => media,
    setTimeout: callback => { pending.set(++id, callback); return id; },
    clearTimeout: handle => pending.delete(handle),
  });
  const attached = attachIdleLife(input, () => {}, () => ready);
  assert.equal(input.checked, false);
  assert.equal(pending.size, 0);
  media.matches = false; media.emit("change");
  assert.equal(pending.size, 1);
  doc.emit("pointerdown");
  assert.equal(pending.size, 0, "A held control cannot start a gesture.");
  win.emit("pointerup");
  assert.equal(pending.size, 1);
  const old = id;
  doc.emit("keydown");
  assert.equal(pending.size, 1);
  assert(id > old, "Typing restarts a full quiet wait.");
  doc.hidden = true; doc.emit("visibilitychange");
  assert.equal(pending.size, 0);
  doc.hidden = false; doc.emit("visibilitychange");
  assert.equal(pending.size, 1);
  win.emit("pagehide");
  assert.equal(pending.size, 0);
  win.emit("pageshow");
  assert.equal(pending.size, 1);
  ready = false; attached.refresh();
  assert.equal(pending.size, 0);
  ready = true; attached.refresh();
  input.checked = false; input.emit("input");
  media.matches = true; media.emit("change");
  media.matches = false; media.emit("change");
  assert.equal(input.checked, false, "Explicit choice survives OS changes.");
  input.checked = true; input.emit("input");
  media.matches = true; media.emit("change");
  assert.equal(input.checked, true, "Explicit opt-in may override reduced motion.");
  attached.setActive(false);
  assert.equal(pending.size, 0);
} finally {
  for (const [key, descriptor] of Object.entries(saved)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}
console.log("Reduced motion, explicit choice, held controls, typing, visibility, page lifecycle and availability passed.");

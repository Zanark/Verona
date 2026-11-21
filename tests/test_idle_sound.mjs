import assert from "node:assert/strict";
import {createIdleSound} from "../verona/web/idle-sound.mjs";
import {createIdleClock} from "../verona/web/idle-life.mjs";

let enabled = true, level = .75, time = 0, contexts = 0, buffers = 0, stops = 0, starts = [];
let resume, failure = false;
let style = "female";
const messages = [], sources = [], gains = [], loads = [];
const context = {
  state: "running", destination: {},
  suspend: async () => { context.state = "suspended"; },
  resume: async () => {
    if (failure) throw Error("Output unavailable");
    if (resume) await new Promise(resolve => { resume.resolve = resolve; });
    context.state = "running";
  },
  decodeAudioData: async bytes => { buffers++; return {duration:bytes.byteLength===17?2.7:4.2,numberOfChannels:1}; },
  createGain: () => { const gain={gain: {},connect(){},disconnect(){}};gains.push(gain);return gain; },
  createBufferSource: () => {
    const source = {buffer: null, connect() {}, disconnect() {}, stop() { stops++; },
      start(_when, offset) { starts.push(offset); }};
    sources.push(source); return source;
  },
};
const sound = createIdleSound({enabled: () => enabled, volume: () => level, now: () => time,
  effectStyle: () => style, loadEffect: async (kind,value) => {
    loads.push(`${kind}-${value}`);return new ArrayBuffer(kind==="sneeze"?17:16);
  },
  createContext: () => { contexts++; return context; }, report: text => messages.push(text)});
const yawn = {id: "yawn", sound: "yawn", duration: 4200};
const sneeze = {id: "sneeze", sound: "sneeze", duration: 2700};
await sound.start({id: "smile"});
assert.equal(contexts,0,"Silent gestures create no audio context.");
enabled = false; await sound.start(yawn,{preview:true}); assert.equal(contexts,0);
enabled = true; level = 0; await sound.start(yawn,{preview:true}); assert.equal(contexts,0);
level = .75; await sound.start(yawn,{preview:true});
assert.equal(starts.length,1); assert.equal(contexts,1); assert.equal(buffers,1);
assert.equal(gains.at(-1).gain.value,.2,"Even stale75% or direct callers cannot exceed20%.");
assert.deepEqual(loads,["yawn-female"]);
await sound.start(yawn,{preview:true});
assert.equal(stops,1); assert.equal(buffers,1,"Only latest buffer retained/reused.");
await sound.start(sneeze); assert.equal(buffers,2);
assert.equal(loads.at(-1),"sneeze-female","Sneeze uses the supplied voice-matched asset, not synthesis.");
sources.at(-1).onended();
assert.equal(context.state,"suspended","Finished output suspends its audio clock.");
assert(messages.at(-1).includes("ready"));

resume = {};
const stale = sound.start(yawn,{preview:true});
sound.stop(); time += 600;
resume.resolve(); resume = null; await stale;
assert.equal(starts.length,3,"Cancelled asynchronous resume never starts delayed audio.");
assert.equal(context.state,"suspended");
resume = {};
const late = sound.start(yawn,{preview:true});
time += 5000; resume.resolve(); resume = null; await late;
assert.equal(starts.length,3,"Overdue audio is skipped instead of replayed out of sync.");
failure = true; await sound.start(yawn,{preview:true});
assert(messages.at(-1).includes("Output unavailable"),"Device/resume failure is explicit.");
failure = false;
style="male";await sound.start(yawn,{preview:true});
assert.equal(loads.at(-1),"yawn-male","Voice style switches the actual loaded effect.");
level=.03;await sound.start(yawn,{preview:true});assert.equal(gains.at(-1).gain.value,.03);
sound.stop();
await sound.start(sneeze);
assert.equal(loads.at(-1),"sneeze-male");
const sameSneezeLoads=loads.length;
await sound.start(sneeze);assert.equal(loads.length,sameSneezeLoads,"Same kind/style reuses only the latest buffer.");
style="female";await sound.start(sneeze);assert.equal(loads.at(-1),"sneeze-female");
sound.stop();

let finishLoad, aborted;
const fetching=createIdleSound({enabled:()=>true,volume:()=>.2,createContext:()=>context,
  loadEffect:(_kind,_style,signal)=>new Promise(resolve=>{finishLoad=resolve;aborted=signal;}),
  report:text=>messages.push(text)});
await fetching.unlock();
const fetchStart=fetching.start(sneeze,{preview:true});
await Promise.resolve();
const beforeFetch=starts.length;
fetching.stop();assert(aborted.aborted);
finishLoad(new ArrayBuffer(16));await fetchStart;
assert.equal(starts.length,beforeFetch,"Cancelled asset loading never starts sound.");

const lockedContext = {...context, state:"suspended",
  async resume() { this.state = "running"; }, async suspend() { this.state = "suspended"; }};
const locked = createIdleSound({enabled: () => true, volume: () => .75,
  loadEffect:async()=>new ArrayBuffer(16),
  createContext: () => lockedContext, report: text => messages.push(text)});
await locked.start(yawn,{preview:true});
assert(messages.at(-1).includes("autoplay"),"Browser autoplay blocking is not silent success.");
await locked.unlock();
assert(messages.at(-1).includes("ready"));
await locked.start(yawn,{preview:true});
assert.equal(lockedContext.state,"running","Explicit browser gesture permits future automatic output.");
locked.stop();
let chance=.5, rareLoads=0;
const rare=createIdleSound({enabled:()=>true,volume:()=>.2,now:()=>time,random:()=>chance,
  createContext:()=>context,loadEffect:async()=>{rareLoads++;return new ArrayBuffer(16);},
  report:()=>{}});
await rare.start(yawn);assert.equal(rareLoads,0,"Most yawns are silent without loading audio.");
chance=.01;await rare.unlock();await rare.start(yawn);
const audibleStarts=starts.length;rare.stop();time+=599999;await rare.start(yawn);
assert.equal(starts.length,audibleStarts,"Automatic audio waits at least ten minutes.");
time+=2;await rare.start(yawn);
assert.equal(starts.length,audibleStarts+1,"Eligible rare draw can play after the minimum gap.");
rare.stop();
const bad=createIdleSound({enabled:()=>true,volume:()=>.2,createContext:()=>context,
  loadEffect:async()=>new ArrayBuffer(16),report:text=>messages.push(text)});
await bad.unlock();
const beforeInvalid=starts.length;
await bad.start(sneeze);
assert(messages.at(-1).includes("bounded mono"),"Sneeze rejects a decoded clip longer than2.7s.");
assert.equal(starts.length,beforeInvalid);
const missing=createIdleSound({enabled:()=>true,volume:()=>.2,createContext:()=>context,
  loadEffect:async()=>{throw Error("Prepared sneeze missing");},report:text=>messages.push(text)});
await missing.unlock();await missing.start(sneeze);
assert(messages.at(-1).includes("Prepared sneeze missing"),"Missing supplied sneeze is explicit, never synthesized.");
assert.equal(starts.length,beforeInvalid);

let startCount = 0, stopCount = 0, current = 0;
const clock = createIdleClock(() => {}, {now: () => current, random: () => .5,
  schedule: () => 1, cancel() {}, onStart: () => startCount++, onStop: () => stopCount++});
clock.setActive(true); clock.preview("yawn"); assert.equal(startCount,1);
const before = stopCount; clock.interrupt(); assert.equal(stopCount,before+1);
clock.preview("sneeze"); current += 2800; clock.sample(); assert(stopCount>before+1);
clock.setActive(false);
const {createRequire}=await import("node:module");
const {trimSamples,wav}=createRequire(import.meta.url)("../scripts/prepare-idle-yawns.cjs");
const raw=new Float32Array(24000*8);
for(let i=24000;i<raw.length-24000;i++)raw[i]=.4*Math.sin(i*.07);
const trimmed=trimSamples(raw);
assert(trimmed.startSeconds>.9&&trimmed.startSeconds<1);
assert.equal(trimmed.samples.length,100800);
assert.equal(Math.abs(trimmed.samples[0]),0);
assert.equal(Math.abs(trimmed.samples.at(-1)),0);
assert.equal(wav(trimmed.samples).length,201644);
const sneezeTrimmed=trimSamples(raw,24000,2.7);
assert.equal(sneezeTrimmed.samples.length,64800);
assert.equal(Math.abs(sneezeTrimmed.samples.at(-1)),0);
assert.throws(()=>trimSamples(new Float32Array(24000)),/No usable/);
console.log("Prepared yawn/sneeze kind/style selection, latest-buffer ownership, bounds, cap, cancellation, rarity and explicit missing errors passed.");

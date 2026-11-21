export const IDLE_ACTIONS = Object.freeze([
  {id: "smile", label: "Soft smile", duration: 2600, weight: 2},
  {id: "smirk", label: "Crooked smirk", duration: 2300, weight: 1.4},
  {id: "brow", label: "Curious brow", duration: 1900, weight: 1.4},
  {id: "furrow", label: "Brow furrow", duration: 2100, weight: 1},
  {id: "scrunch", label: "Nose scrunch", duration: 1500, weight: 1},
  {id: "press", label: "Lip press", duration: 1800, weight: 1},
  {id: "purse", label: "Lip purse", duration: 2200, weight: 1},
  {id: "puff", label: "Cheek puff", duration: 2400, weight: .8},
  {id: "jaw", label: "Jaw loosen", duration: 3000, weight: .8},
  {id: "yawn", label: "Silent yawn", duration: 4200, weight: .35, cooldown: 90000},
  {id: "sneeze", label: "Silent sneeze", duration: 2700, weight: .25, cooldown: 120000},
  {id: "look", label: "Look around", duration: 3400, weight: 1.4},
  {id: "nod", label: "Double nod", duration: 1900, weight: 1.2},
  {id: "stretch", label: "Neck stretch", duration: 3900, weight: .8},
  {id: "squeeze", label: "Eye squeeze", duration: 1800, weight: .7},
].map(Object.freeze));

const byId = new Map(IDLE_ACTIONS.map(action => [action.id, action]));
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t*t*(3-2*t); };
const pulse = (t, a, b, c, d) => smooth((t-a)/(b-a)) * (1-smooth((t-c)/(d-c)));
const fields = ["pitch", "yaw", "roll", "gazeX", "gazeY", "smile", "smirk",
  "brow", "furrow", "nose", "press", "purse", "puff", "jaw", "shift", "squeeze"];

export function idlePose() {
  return reset({id: null, moving: false, side: 1});
}

function reset(pose) {
  for (const key of fields) pose[key] = 0;
  pose.id = null; pose.moving = false; pose.side = 1;
  return pose;
}

export function sampleIdleAction(id, elapsed, side = 1, pose = idlePose()) {
  const action = byId.get(id);
  if (!action) throw new Error(`Unknown idle action: ${id}`);
  reset(pose);
  if (elapsed < 0 || elapsed >= action.duration) return pose;
  const t = elapsed/action.duration, e = pulse(t, 0, .28, .64, 1);
  pose.id = id; pose.moving = true; pose.side = side;
  if (elapsed === 0) return pose;
  switch (id) {
    case "smile": pose.smile = .8*e; break;
    case "smirk": pose.smirk = .9*e; pose.gazeX = side*.07*e; break;
    case "brow": pose.brow = e; break;
    case "furrow": pose.furrow = .85*e; break;
    case "scrunch": pose.nose = e; pose.press = .25*e; break;
    case "press": pose.press = e; break;
    case "purse": pose.purse = e; break;
    case "puff": pose.puff = e; pose.press = .6*e; break;
    case "jaw":
      pose.jaw = .25*e;
      pose.shift = .45*Math.sin(t*2*Math.PI)*e;
      break;
    case "yawn":
      pose.jaw = 1.3*e; pose.purse = .3*e;
      pose.squeeze = .65*e; pose.pitch = -.09*e;
      break;
    case "sneeze": {
      const inhale = pulse(t, 0, .22, .30, .45);
      const burst = pulse(t, .30, .40, .46, .65);
      const recover = pulse(t, .50, .64, .70, 1);
      pose.pitch = -.10*inhale + .22*burst + .04*recover;
      pose.jaw = .35*inhale + .55*burst;
      pose.nose = burst; pose.squeeze = pulse(t, .20, .34, .58, .77);
      break;
    }
    case "look":
      pose.yaw = side*.14*(pulse(t, .10, .25, .35, .50)-pulse(t, .50, .65, .75, .93));
      pose.gazeX = side*.18*(pulse(t, 0, .12, .32, .48)-pulse(t, .44, .55, .76, 1));
      break;
    case "nod":
      pose.pitch = .13*pulse(t, 0, .17, .23, .42)+.085*pulse(t, .43, .60, .65, 1);
      break;
    case "stretch":
      pose.roll = side*.12*(pulse(t, 0, .22, .32, .50)-pulse(t, .50, .70, .80, 1));
      break;
    case "squeeze": pose.squeeze = e; pose.furrow = .35*e; pose.smile = .18*e; break;
  }
  return pose;
}

export function createIdleClock(wake, {
  now = () => performance.now(), random = Math.random,
  schedule = setTimeout, cancel = clearTimeout, allowed = () => true,
} = {}) {
  let active = false, timer = null, action = null, started = 0, side = 1, revision = 0;
  const recent = [], cooldowns = new Map(), pose = idlePose();
  const clear = () => {
    revision++;
    if (timer !== null) cancel(timer);
    timer = null; action = null;
  };
  const begin = selected => {
    action = selected; started = now(); side = random() < .5 ? -1 : 1;
    recent.push(action.id);
    if (recent.length > 4) recent.shift();
    cooldowns.set(action.id, started + action.duration + (action.cooldown || 0));
    wake();
  };
  const arm = () => {
    if (!active || timer !== null || action) return;
    const delay = 12000 + random()*16000, deadline = now()+delay, version = ++revision;
    timer = schedule(() => {
      if (version !== revision) return;
      timer = null;
      if (!active || !allowed()) { active = false; return; }
      if (now() > deadline+2000) { arm(); return; }
      const choices = IDLE_ACTIONS.filter(candidate =>
        !recent.includes(candidate.id) && (cooldowns.get(candidate.id) || 0) <= now());
      let choice = random()*choices.reduce((sum, candidate) => sum+candidate.weight, 0);
      const selected = choices.find(candidate => (choice -= candidate.weight) < 0) || choices.at(-1);
      begin(selected);
    }, delay);
  };
  return {
    setActive(value) {
      if (active === value) return;
      const moving = Boolean(action);
      clear(); active = value;
      arm();
      if (moving) wake();
    },
    isActive: () => active && allowed(),
    interrupt() {
      const moving = Boolean(action);
      clear(); arm();
      if (moving) wake();
    },
    preview(id) {
      const selected = byId.get(id);
      if (!selected) throw new Error(`Unknown idle action: ${id}`);
      if (!active || !allowed()) throw new Error("Idle previews require an enabled, visible, idle head. Finish playback or clear its paused clip first.");
      clear(); begin(selected);
    },
    sample() {
      if (!allowed()) { clear(); active = false; }
      if (!action) return reset(pose);
      const elapsed = Math.max(0, now()-started);
      if (elapsed >= action.duration) {
        action = null; arm();
        return reset(pose);
      }
      return sampleIdleAction(action.id, elapsed, side, pose);
    },
  };
}

export function attachIdleLife(input, wake, available = () => true) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let chosen = false, held = false, hidden = false;
  input.checked = !reduced.matches;
  const allowed = () => input.checked && !document.hidden && !hidden && !held && available();
  const clock = createIdleClock(wake, {allowed});
  const refresh = () => clock.setActive(allowed());
  clock.refresh = refresh;
  input.addEventListener("input", () => { chosen = true; refresh(); });
  reduced.addEventListener("change", () => {
    if (!chosen) input.checked = !reduced.matches;
    refresh();
  });
  document.addEventListener("pointerdown", () => { held = true; refresh(); }, true);
  for (const event of ["pointerup", "pointercancel"]) {
    window.addEventListener(event, () => { held = false; refresh(); }, true);
  }
  for (const event of ["keydown", "input", "wheel"]) {
    document.addEventListener(event, () => { clock.interrupt(); refresh(); }, {capture: true, passive: true});
  }
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("blur", () => { held = false; clock.interrupt(); refresh(); });
  window.addEventListener("pagehide", () => { hidden = true; refresh(); });
  window.addEventListener("pageshow", () => { hidden = held = false; refresh(); });
  refresh();
  return clock;
}

// Bounded cosmetic fields; speech geometry, topology and optical joints stay unchanged.
export const IDLE_GLSL = `
  uniform vec4 idleFaceA, idleFaceB, idleFaceC;
  float idleField(vec2 p, vec2 radius) {
    return 1.0-smoothstep(0.35,1.0,length(p/radius));
  }
  vec3 idleOffset(vec3 rest) {
    if (idleFaceC.w == 0.0) return vec3(0.0);
    vec3 p = featurePosition(rest);
    float x = p.x-.08, y = p.y-140.15;
    float front = smoothstep(0.6,2.6,p.z);
    float corner = idleField(vec2(abs(x)-2.0,y),vec2(2.0,1.8));
    float oneSide = smoothstep(-.4,.4,x*idleFaceC.w);
    float lip = idleField(vec2(x,y),vec2(3.2,1.1));
    float cheek = idleField(vec2(abs(x)-4.0,y-2.6),vec2(2.5,2.5));
    vec3 eye = blinkCenter(rest);
    float brow = idleField(vec2(rest.x-eye.x,rest.y-eye.y-1.8),vec2(2.0,1.2));
    float inner = 1.0-smoothstep(1.0,4.0,abs(x));
    float nose = idleField(vec2(x,y-3.8),vec2(2.2,2.1));
    float jaw = (1.0-smoothstep(-.5,.6,y))*(1.0-smoothstep(3.0,6.0,abs(x)));
    vec3 offset = vec3(0.0);
    offset.y += corner*(.65*idleFaceA.x+.75*idleFaceA.y*oneSide);
    offset.x += sign(x)*corner*(.22*idleFaceA.x+.4*idleFaceA.y*oneSide);
    offset.y += brow*(.75*idleFaceA.z*oneSide-.4*idleFaceA.w*inner);
    offset.x -= sign(x)*brow*.22*idleFaceA.w*inner;
    offset.y += nose*.42*idleFaceB.x-y*lip*.65*idleFaceB.y;
    offset.x -= x*lip*.22*idleFaceB.z;
    offset.z += lip*.6*idleFaceB.z+cheek*.45*idleFaceB.w;
    offset.x += sign(x)*cheek*.4*idleFaceB.w;
    offset.y -= jaw*idleFaceC.x;
    offset.x += jaw*idleFaceC.y;
    offset.y += cheek*.18*idleFaceC.z;
    return offset*front;
  }
`;

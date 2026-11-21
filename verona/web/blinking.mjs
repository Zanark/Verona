const smooth = value => value * value * (3 - 2 * value);

export function createBlinkClock(wake, {
  now = () => performance.now(), random = Math.random,
  schedule = setTimeout, cancel = clearTimeout,
} = {}) {
  let active = false, timer = null, started = null;
  const arm = () => {
    timer = schedule(() => {
      timer = null;
      started = now();
      wake();
    }, 3500 + random() * 4000);
  };
  return {
    setActive(value) {
      if (active === value) return;
      active = value;
      if (timer !== null) cancel(timer);
      timer = started = null;
      if (active) arm();
      wake();
    },
    sample() {
      if (started === null) return {amount: 0, moving: false};
      const elapsed = Math.max(0, now() - started);
      if (elapsed >= 290) {
        started = null;
        if (active) arm();
        return {amount: 0, moving: false};
      }
      const amount = elapsed < 90 ? smooth(elapsed / 90)
        : elapsed < 120 ? 1 : 1 - smooth((elapsed - 120) / 170);
      return {amount, moving: true};
    },
  };
}

export function attachBlinking(input, wake, available = () => true) {
  const clock = createBlinkClock(wake);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let chosen = false;
  input.checked = !reduced.matches;
  const sync = () => clock.setActive(input.checked && !document.hidden && available());
  clock.refresh = sync;
  input.addEventListener("input", () => { chosen = true; sync(); });
  reduced.addEventListener("change", () => {
    if (!chosen) input.checked = !reduced.matches;
    sync();
  });
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => clock.setActive(false));
  window.addEventListener("pageshow", sync);
  sync();
  return clock;
}

// Model-space cosmetic lid field, shared by skin and optical aperture clipping.
export const BLINK_GLSL = `
  uniform float blink;
  uniform vec2 idleLids;
  uniform vec3 blinkCenterA, blinkCenterB, blinkRadius;
  vec3 blinkCenter(vec3 p) {
    return abs(p.x-blinkCenterA.x) < abs(p.x-blinkCenterB.x) ? blinkCenterA : blinkCenterB;
  }
  float blinkAmount(vec3 p) {
    bool first = abs(p.x-blinkCenterA.x) < abs(p.x-blinkCenterB.x);
    return max(blink, first ? idleLids.x : idleLids.y);
  }
  vec3 blinkOffset(vec3 rest) {
    float amount = blinkAmount(rest);
    if (amount <= 0.0) return vec3(0.0);
    vec3 local = (rest-blinkCenter(rest))/blinkRadius;
    float influence = (1.0-smoothstep(1.05,1.9,length(local.xy)))
      * smoothstep(0.15,0.65,local.z);
    return vec3(0.0, -local.y*blinkRadius.y,
      max(0.0, 1.04-local.z)*blinkRadius.z)*influence*amount;
  }
  bool blinkOccludes(vec3 rest) {
    float amount = blinkAmount(rest);
    if (amount <= 0.0) return false;
    vec3 local = (rest-blinkCenter(rest))/blinkRadius;
    return amount >= 0.999 || abs(local.y) > 1.05*(1.0-amount);
  }
`;

export const CLAIRE_BLINK = {
  centers: [[-2.9485,147.5517,2.2364],[3.1021,147.4944,2.2830]],
  radius: [1.65,.85,1.4],
};

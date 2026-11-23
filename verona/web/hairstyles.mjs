export const HAIRSTYLES = Object.freeze({
  claire: Object.freeze({ name: "Claire waves (original)", fit: 1 }),
  curls: Object.freeze({ name: "Spiral curls", fit: 1 }),
  "curly-fade": Object.freeze({ name: "Textured curls fade", fit: 1 }),
  "swept-quiff": Object.freeze({ name: "Swept quiff fade", fit: 1 }),
});

export const HAIR_FADE_GLSL = `
  uniform bool hairFade;
  uniform vec3 hairFadeCenter, hairFadeAxes;
  void clipHairFade(vec3 p) {
    if (material != 1 || !hairFade) return;
    vec3 local = (p-hairFadeCenter)/hairFadeAxes;
    float coverage = smoothstep(.10,.62,local.y);
    vec2 uv = vec2(atan(local.x,local.z)*90.0,local.y*100.0);
    vec2 cell = floor(uv);
    float seed = fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
    vec2 grain = fract(uv)-.5 + .13*vec2(sin(seed*31.0),cos(seed*29.0));
    if (coverage <= 0.0 || length(grain) > .85*sqrt(coverage)) discard;
  }
`;

export function hairstyle(id) {
  if (!Object.hasOwn(HAIRSTYLES, id)) throw new Error("Choose a supported hairstyle.");
  return HAIRSTYLES[id];
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function shortScalp(meta, neutral) {
  if (!neutral.length || neutral.length % 3) throw new Error("Malformed short-hair skull coordinates.");
  const points = [];
  const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < neutral.length; i += 3) {
    const p = [0, 1, 2].map(a => neutral[i + a] / meta.quantization * meta.scale + meta.center[a]);
    if (!p.every(Number.isFinite)) throw new Error("Short-hair fitting requires finite skull coordinates.");
    if (p[1] < 149) continue;
    points.push(p);
    for (let a = 0; a < 3; a++) { low[a] = Math.min(low[a], p[a]); high[a] = Math.max(high[a], p[a]); }
  }
  if (!points.length) throw new Error("Short-hair fitting requires upper-skull samples.");
  const center = [(low[0] + high[0]) / 2, 148.2, (low[2] + high[2]) / 2];
  const axes = [(high[0] - low[0]) / 2 + .25, high[1] - center[1] + .25, (high[2] - low[2]) / 2 + .25];
  let radius = 1;
  for (const p of points) {
    const [x, y, z] = p.map((v, a) => (v - center[a]) / axes[a]);
    radius = Math.max(radius, Math.sqrt(x*x + z*z + Math.max(0, y)**4));
  }
  return { center, axes: axes.map(v => v * radius * 1.025) };
}

export function createHairstyle(id, meta, neutral) {
  hairstyle(id);
  if (id === "claire") throw new Error("Original Claire hair comes from the verified mesh, not a reconstruction.");
  if (meta.center?.length !== 3 || !meta.center.every(Number.isFinite)
      || !Number.isFinite(meta.scale) || meta.scale <= 0
      || !Number.isFinite(meta.quantization) || meta.quantization <= 0) {
    throw new Error("Cannot build hair with malformed mesh coordinates.");
  }
  const positions = [], edges = [], triangles = [];
  const shortFit = id !== "curls" && neutral ? shortScalp(meta, neutral) : null;
  const vertex = (x, y, z) => positions.push(x, y, z);
  const connect = (offset, rows, columns, contourEvery = 8, reverse = false) => {
    for (let row = 0; row < rows - 1; row++) for (let column = 0; column < columns; column++) {
      const a = offset + row * columns + column, b = offset + row * columns + (column + 1) % columns;
      const c = a + columns, d = b + columns;
      if (reverse) triangles.push(a, b, c, b, d, c);
      else triangles.push(a, c, b, b, c, d);
      if (column % contourEvery === 0) edges.push(a, c);
    }
  };
  const tube = (path, radius, sections = 40, sides = 8, flatten = 1) => {
    const offset = positions.length / 3;
    let previousNormal;
    for (let row = 0; row < sections; row++) {
      const t = row / (sections - 1), p = path(t), before = path(Math.max(0, t - .001)), after = path(Math.min(1, t + .001));
      const tangent = after.map((v, i) => v - before[i]), length = Math.hypot(...tangent);
      if (length < 1e-8) throw new Error("Hairstyle has a stationary sweep.");
      const direction = tangent.map(v => v / length), axis = Math.abs(direction[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
      const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
      const seed = previousNormal || axis, dot = seed.reduce((sum, v, i) => sum + v * direction[i], 0);
      let u = seed.map((v, i) => v - dot * direction[i]);
      if (Math.hypot(...u) < 1e-8) u = cross(direction, axis);
      const size = Math.hypot(...u), normal = u.map(v => v / size), binormal = cross(direction, normal);
      previousNormal = normal;
      const r = typeof radius === "function" ? radius(t) : radius;
      for (let side = 0; side < sides; side++) {
        const angle = 2 * Math.PI * side / sides;
        vertex(...p.map((v, i) => v + r * (flatten * normal[i] * Math.cos(angle) + binormal[i] * Math.sin(angle))));
      }
    }
    connect(offset, sections, sides, 4, true);
  };
  const columns = id === "curls" ? 64 : 96, rows = id === "curls" ? 16 : 24;
  if (id !== "curls") {
    const swept = id === "swept-quiff";
    const point = (theta, angle) => {
      const x = Math.sin(theta) * Math.sin(angle), z = Math.sin(theta) * Math.cos(angle);
      const top = Math.max(0, Math.cos(theta));
      const crown = smooth(.35, .76, top);
      const lift = swept
        ? crown * (1.0 + 3.0 * Math.exp(-(((theta - .62) / .50) ** 2))
          * smooth(-.2, .8, Math.cos(angle)) * (.45 + .55 * smooth(-.6, .6, x)))
        : crown * (.65 + .24 * Math.sin(23*x + Math.cos(19*z)) * Math.cos(17*z + Math.sin(21*x)));
      const vertical = Math.cos(theta);
      return [9.5 * x + (swept ? .8 * crown : 0),
        148.2 + 11 * (vertical > 0 ? Math.sqrt(vertical) : vertical) + lift,
        -5.7 + 11.6 * z];
    };
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const t = row / (rows - 1), a = 2 * Math.PI * col / columns;
      const front = smooth(0, 1, Math.max(0, Math.cos(a)));
      vertex(...point((.012 + .988 * t) * (1.65 - .62 * front), a));
    }
    connect(0, rows, columns, 4);
    const scalp = (x, z) => {
      const y = Math.sqrt(Math.max(0, 1 - x * x - z * z));
      return point(Math.acos(y), Math.atan2(x, z));
    };
    if (swept) {
      for (let lock = 0; lock < 52; lock++) {
        const lane = lock % 13, layer = Math.floor(lock / 13);
        const x = -.74 + 1.35 * lane / 12;
        tube(t => {
          const across = x + .32 * Math.sin(Math.PI * t);
          const arc = .99 - layer * .16 - (1.5 + .09 * Math.sin(lock * 1.7)) * t;
          const p = scalp(across, Math.sqrt(1 - across * across) * Math.sin(arc));
          p[1] += .12 + (.35 + layer * .08) * Math.sin(Math.PI * t)
            + .035 * Math.sin(t * 15 + lock);
          return p;
        }, t => (.10 + .035 * Math.sin(lock * 2.1) ** 2)
          * (.15 + .85 * Math.sin(Math.PI * t) ** .6), 32, 6, .45);
      }
    } else {
      const count = 144;
      for (let lock = 0; lock < count; lock++) {
        const radial = Math.sqrt((lock + .5) / count) * .84;
        const a = lock * Math.PI * (3 - Math.sqrt(5));
        const root = scalp(radial * Math.sin(a), radial * Math.cos(a));
        const phase = lock * 2.17, height = .9 + .7 * (.5 + .5 * Math.sin(lock * 3.1));
        tube(t => {
          const angle = phase + t * Math.PI * (3.4 + .4 * Math.sin(lock));
          const radius = (.34 + .12 * Math.sin(lock * 1.3) ** 2) * Math.sin(Math.PI * t * .9);
          return [root[0] + radius * Math.cos(angle) + .55 * radial * Math.sin(a) * t,
            root[1] + .10 + height * t,
            root[2] + radius * Math.sin(angle) + .55 * radial * Math.cos(a) * t];
        }, t => .15 * (1 - .75 * smooth(.65, 1, t)), 12, 6);
      }
    }
  } else {
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const t = row / (rows - 1), a = 2 * Math.PI * col / columns, front = smooth(0, 1, Math.max(0, Math.cos(a)));
      const limit = 1.63 - .58 * front + .10 * Math.sin(a) * front;
      const theta = (.012 + .988 * t) * limit;
      vertex(9.5 * Math.sin(theta) * Math.sin(a) - .5 * (1 - t) ** 2,
        148.2 + 11 * Math.cos(theta), -5.7 + 11.6 * Math.sin(theta) * Math.cos(a));
    }
    connect(0, rows, columns);
    const count = 48;
    for (let lock = 0; lock < count; lock++) {
      const a = .88 + (2 * Math.PI - 1.76) * lock / (count - 1);
      tube(t => {
        const theta = .72 + .83 * smooth(0, .35, t), fall = smooth(.25, 1, t);
        const phase = t * Math.PI * 9 + lock * .8, curl = 1.05 * smooth(.2, .4, t);
        const radius = 9.65 * Math.sin(theta) + .3 * fall;
        return [radius * Math.sin(a) + curl * Math.cos(phase),
          148.2 + 11 * Math.cos(theta) - 18 * fall,
          -5.7 + 11.8 * Math.sin(theta) * Math.cos(a) + curl * Math.sin(phase)];
      }, t => .55 * (.35 + .65 * smooth(0, .15, t)) * (1 - .6 * smooth(.85, 1, t)));
    }
  }
  const factor = meta.hair?.scale ?? 1, hairAnchor = [0, 148.2, -5.7];
  if (!Number.isFinite(factor) || factor < 1) throw new Error("Malformed native hair fit.");
  const packed = Int16Array.from(positions, (value, i) => {
    if (shortFit) {
      const axis = i % 3;
      value = shortFit.center[axis] + (value - hairAnchor[axis]) / [9.5, 11, 11.6][axis] * shortFit.axes[axis];
    } else if (factor !== 1) {
      const anchor = hairAnchor[i % 3];
      value = (value - anchor) * factor + anchor;
    }
    const n = Math.round((value - meta.center[i % 3]) / meta.scale * meta.quantization);
    if (!Number.isFinite(n) || n < -32768 || n > 32767) throw new Error("Hairstyle exceeds the packed mesh bounds.");
    return n;
  });
  const fade = id === "curls" ? null : shortFit || {
    center: hairAnchor, axes: [9.5, 11, 11.6].map(value => value * factor),
  };
  return { positions: packed, edges: Uint32Array.from(edges), triangles: Uint32Array.from(triangles), fade };
}

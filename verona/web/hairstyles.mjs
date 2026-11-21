export const HAIRSTYLES = Object.freeze({
  claire: Object.freeze({ name: "Claire waves (original)", fit: 1 }),
  curls: Object.freeze({ name: "Spiral curls", fit: 1 }),
  quiff: Object.freeze({ name: "Short textured quiff", fit: 1 }),
  "side-part": Object.freeze({ name: "Classic side part", fit: 1 }),
});

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
  for (const p of points) radius = Math.max(radius, Math.hypot(...p.map((v, a) => (v - center[a]) / axes[a])));
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
  const tube = (path, radius) => {
    const sections = 40, sides = 8;
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
        vertex(...p.map((v, i) => v + r * (normal[i] * Math.cos(angle) + binormal[i] * Math.sin(angle))));
      }
    }
    connect(offset, sections, sides, 4, true);
  };
  const columns = 64, rows = 16;
  if (id !== "curls") {
    const point = (theta, angle) => {
      const x = Math.sin(theta) * Math.sin(angle), z = Math.sin(theta) * Math.cos(angle);
      const top = Math.max(0, Math.cos(theta));
      const lift = id === "quiff"
        ? 1.9 * Math.exp(-(((theta - .62) / .48) ** 2)) * smooth(0, .8, Math.cos(angle))
        : .7 * smooth(-.3, .7, x) * top;
      return [9.5 * x, 148.2 + 11 * Math.cos(theta) + lift, -5.7 + 11.6 * z];
    };
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const t = row / (rows - 1), a = 2 * Math.PI * col / columns;
      const front = smooth(0, 1, Math.max(0, Math.cos(a)));
      vertex(...point((.012 + .988 * t) * (1.45 - .40 * front), a));
    }
    connect(0, rows, columns, 4);
    const swept = (x, z, t) => {
      const y = Math.sqrt(Math.max(0, 1 - x * x - z * z));
      const p = point(Math.acos(y), Math.atan2(x, z));
      p[1] += .12 + .25 * Math.sin(Math.PI * t);
      return p;
    };
    if (id === "quiff") {
      for (let lock = 0; lock < 14; lock++) {
        const x = -.7 + 1.4 * lock / 13;
        tube(t => {
          const across = x + .055 * Math.sin(Math.PI * t);
          const arc = 1.02 - (1.6 + .12 * Math.sin(lock * 1.7)) * t;
          return swept(across, Math.sqrt(1 - across * across) * Math.sin(arc), t);
        }, t => .42 * (.12 + .88 * Math.sin(Math.PI * t) ** .45));
      }
    } else {
      for (const side of [-1, 1]) for (let lock = 0; lock < 9; lock++) {
        tube(t => {
          const z = .66 - 1.32 * lock / 8 - .08 * Math.sin(Math.PI * t);
          const start = -.23 + side * .018;
          const x = start * (1 - t) + side * .965 * Math.sqrt(1 - z * z) * t;
          return swept(x, z, t);
        }, t => .30 * (.12 + .88 * Math.sin(Math.PI * t) ** .45));
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
  return { positions: packed, edges: Uint32Array.from(edges), triangles: Uint32Array.from(triangles) };
}

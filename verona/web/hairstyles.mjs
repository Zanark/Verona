export const HAIRSTYLES = Object.freeze({
  claire: Object.freeze({ name: "Claire waves (original)", fit: 1 }),
  pixie: Object.freeze({ name: "Tapered pixie", fit: 1 }),
  bob: Object.freeze({ name: "Rounded bob", fit: 1 }),
  angled: Object.freeze({ name: "Asymmetric angled bob", fit: 1 }),
  straight: Object.freeze({ name: "Long sleek layers", fit: .82 }),
  curls: Object.freeze({ name: "Spiral curls", fit: 1 }),
  ponytail: Object.freeze({ name: "High ponytail", fit: .80 }),
  twins: Object.freeze({ name: "Twin tails", fit: .94 }),
  bun: Object.freeze({ name: "Coiled top bun", fit: .86 }),
  double: Object.freeze({ name: "Double space buns", fit: .90 }),
  braid: Object.freeze({ name: "Braided crown", fit: .96 }),
});

export function hairstyle(id) {
  if (!Object.hasOwn(HAIRSTYLES, id)) throw new Error("Choose a supported hairstyle.");
  return HAIRSTYLES[id];
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createHairstyle(id, meta) {
  hairstyle(id);
  if (id === "claire") throw new Error("Original Claire hair comes from the verified mesh, not a reconstruction.");
  if (meta.center?.length !== 3 || !meta.center.every(Number.isFinite)
      || !Number.isFinite(meta.scale) || meta.scale <= 0
      || !Number.isFinite(meta.quantization) || meta.quantization <= 0) {
    throw new Error("Cannot build hair with malformed mesh coordinates.");
  }
  const positions = [], edges = [], triangles = [];
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
  const tube = (path, radius, sections = 32, sides = 8) => {
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
  const ellipsoid = (center, radii, twist = 0) => {
    const offset = positions.length / 3, rows = 18, columns = 32;
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const theta = .015 + (Math.PI - .03) * row / (rows - 1), a = 2 * Math.PI * col / columns + twist * Math.cos(theta);
      const ripple = 1 + .07 * Math.cos(a * 9 + theta * 5);
      vertex(center[0] + radii[0] * Math.sin(theta) * Math.sin(a) * ripple,
        center[1] + radii[1] * Math.cos(theta), center[2] + radii[2] * Math.sin(theta) * Math.cos(a) * ripple);
    }
    connect(offset, rows, columns, 4);
  };
  const columns = 64, rows = 16;
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const t = row / (rows - 1), a = 2 * Math.PI * col / columns, front = smooth(0, 1, Math.max(0, Math.cos(a)));
    const limit = 1.63 - .58 * front + (id === "pixie" ? .26 : .10) * Math.sin(a) * front;
    const theta = (.012 + .988 * t) * limit;
    vertex(9.5 * Math.sin(theta) * Math.sin(a) - .5 * (1 - t) ** 2,
      148.2 + 11 * Math.cos(theta), -5.7 + 11.6 * Math.sin(theta) * Math.cos(a));
  }
  connect(0, rows, columns);
  if (["pixie", "bob", "angled", "straight", "curls"].includes(id)) {
    const count = id === "pixie" ? 16 : 24;
    for (let lock = 0; lock < count; lock++) {
      const a = .88 + (2 * Math.PI - 1.76) * lock / (count - 1);
      const length = id === "pixie" ? 3.2 : id === "bob" ? 11 : id === "angled" ? 10 + 5 * Math.sin(a) : id === "straight" ? 24 : 18;
      const curly = id === "curls";
      tube(t => {
        const theta = .72 + .83 * smooth(0, .35, t), fall = smooth(.25, 1, t);
        const phase = t * Math.PI * 9 + lock * .8, curl = curly ? 1.05 * smooth(.2, .4, t) : 0;
        const radius = 9.65 * Math.sin(theta) + (id === "bob" ? .7 * Math.sin(t * Math.PI) - .5 * fall : .3 * fall);
        return [radius * Math.sin(a) + curl * Math.cos(phase),
          148.2 + 11 * Math.cos(theta) - length * fall,
          -5.7 + 11.8 * Math.sin(theta) * Math.cos(a) + curl * Math.sin(phase)];
      }, t => (id === "pixie" ? .7 : curly ? .55 : .85) * (.35 + .65 * smooth(0, .15, t)) * (1 - .6 * smooth(.85, 1, t)), curly ? 40 : 28);
    }
  }
  if (id === "ponytail" || id === "twins") {
    for (const sign of id === "twins" ? [-1, 1] : [0]) {
      const x = sign * 8.5, y = sign ? 151 : 156.8, z = sign ? -8 : -13.5;
      ellipsoid([x, y, z], [1.8, 1.8, 1.8]);
      for (let strand = 0; strand < 7; strand++) {
        const a = strand * 2 * Math.PI / 7;
        tube(t => [x + sign * (2.8 * Math.sin(t * Math.PI / 2)) + (1 - .6*t) * Math.sin(a) * 1.3 + .5*Math.sin(t*7+a),
          y + 2.5 * Math.sin(t * Math.PI) - 20 * t,
          z - (sign ? 3.5 : 10) * Math.sin(t * Math.PI / 2) + (1 - .6*t) * Math.cos(a) * 1.3],
        t => .75 * (1 - .75 * smooth(.6, 1, t)));
      }
    }
  }
  if (id === "bun" || id === "double") {
    for (const sign of id === "double" ? [-1, 1] : [0]) {
      const center = [sign * 6.7, sign ? 157.7 : 159.8, -6.5];
      ellipsoid(center, sign ? [3.1, 3, 3.1] : [3.5, 3, 3.4], 1.6);
      tube(t => {
        const a = 2 * Math.PI * t * 3;
        return [center[0] + 3.2 * Math.sin(a), center[1] - 2 + 4*t, center[2] + 3.2 * Math.cos(a)];
      }, .45, 80);
    }
  }
  if (id === "braid") {
    for (let strand = 0; strand < 3; strand++) tube(t => {
      const a = 2 * Math.PI * t, weave = a * 16 + strand * 2 * Math.PI / 3;
      return [(8.8 + .5 * Math.cos(weave)) * Math.sin(a),
        154.9 + 1.1 * Math.cos(a) + .5 * Math.sin(weave), -5.7 + (9.5 + .5 * Math.cos(weave)) * Math.cos(a)];
    }, .5, 160);
  }
  const packed = Int16Array.from(positions, (value, i) => {
    const n = Math.round((value - meta.center[i % 3]) / meta.scale * meta.quantization);
    if (!Number.isFinite(n) || n < -32768 || n > 32767) throw new Error("Hairstyle exceeds the packed mesh bounds.");
    return n;
  });
  return { positions: packed, edges: Uint32Array.from(edges), triangles: Uint32Array.from(triangles) };
}

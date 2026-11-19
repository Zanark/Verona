const COLORS = Object.freeze([
  [0.48, 0.57, 0.65], [0.025, 0.12, 0.40], [0.012, 0.055, 0.085],
  [0.018, 0.027, 0.038], [0.72, 0.81, 0.87],
]);
const TARGETS = [
  [0, 140.65, 3.8], [0, 139.55, 3.8],
  [-2.4, 140.1, 3.6], [2.4, 140.1, 3.6],
  [-3, 149.4, 2.6], [3, 149.4, 2.6], [0, 136.1, 1.8],
];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

function validMeta(meta) {
  if (!Number.isFinite(meta.scale) || meta.scale <= 0
      || !Number.isFinite(meta.quantization) || meta.quantization <= 0
      || meta.center?.length !== 3 || !meta.center.every(Number.isFinite)) {
    throw new Error("Cannot build robot from malformed face coordinates.");
  }
}

export function createRobot(meta) {
  validMeta(meta);
  const groups = new Map(), world = [], panels = [];
  function triangle(a, b, c, material, part) {
    const ab = b.map((v, i) => v - a[i]), ac = c.map((v, i) => v - a[i]);
    const n = [ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]];
    const length = Math.hypot(...n);
    if (length < 1e-8) throw new Error("Robot panel contains a degenerate triangle.");
    const key = `${material}:${part}`;
    if (!groups.has(key)) groups.set(key, { material, part, color: COLORS[material], positions: [], normals: [] });
    const group = groups.get(key);
    for (const point of [a, b, c]) {
      world.push(...point);
      group.positions.push(...point.map((v, i) => {
        const q = Math.round((v - meta.center[i]) / meta.scale * meta.quantization);
        if (q < -32767 || q > 32767) throw new Error("Robot exceeds the face coordinate range.");
        return q;
      }));
      group.normals.push(...n.map(v => v / length));
    }
  }
  function plate(name, outline, material = 0, part = 0, depth = .45) {
    panels.push({ name, part });
    const area = outline.reduce((sum, p, i) => {
      const q = outline[(i+1)%outline.length];
      return sum + p[0]*q[1] - p[1]*q[0];
    }, 0);
    if (area < 0) outline = [...outline].reverse();
    const center = [0, 0, 0];
    for (const point of outline) for (let j = 0; j < 3; j++) center[j] += point[j] / outline.length;
    const inset = outline.map(p => p.map((v, j) => center[j] + (v - center[j]) * .87 + (j === 2 ? .14 : 0)));
    const back = outline.map(p => [p[0], p[1], p[2] - depth]);
    const frontCenter = [center[0], center[1], center[2] + .14];
    const backCenter = [center[0], center[1], center[2] - depth];
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length;
      triangle(frontCenter, inset[i], inset[j], material, part);
      triangle(inset[i], outline[i], outline[j], 4, part);
      triangle(inset[i], outline[j], inset[j], 4, part);
      triangle(outline[i], back[i], back[j], material, part);
      triangle(outline[i], back[j], outline[j], material, part);
      triangle(backCenter, back[j], back[i], 3, part);
    }
  }
  const mirrored = (points, side) => side === 1 ? points : points.map(([x,y,z]) => [-x,y,z]).reverse();
  for (const side of [-1, 1]) {
    const panel = (name, points, material = 0, part = 0, depth = .45) =>
      plate(`${name}-${side}`, mirrored(points, side), material, part, depth);
    panel("helmet-crown", [[.8,151,3],[6.4,151.5,2.1],[7.2,155.8,.4],[4.5,160.4,-.2],[1.3,159.4,2.2]], 1);
    panel("temple", [[6,149.5,1.8],[8,151,.1],[8,156,-1],[6.5,156,1]], 1);
    panel("side-fin", [[7,154,-.6],[8.6,154,-1.3],[9.1,165,-2.2],[7.9,162,-1]], 1, 0, .7);
    panel("fin-inlay", [[7.72,155,.0],[8.05,155,-.15],[8.62,162.6,-1.1]], 0);
    panel("temple-frame", [[6.2,148.8,3.1],[7.5,150,1.9],[7.5,140,1.8],[6,137.4,3.1]], 0);
    panel("outer-cheek", [[4.5,145.8,4.1],[6.4,147.2,3.8],[6.1,139,3.7],[4.1,137.9,4.7]], 1);
    panel("cheek-spine", [[1.9,145.8,5],[4.1,145.4,4.8],[3.3,141,5.3],[1.4,141.6,5.7]], 0);
    for (let row = 0; row < 5; row++) {
      const y = 145.4 - row * 1.13;
      panel(`cheek-louver-${row}`, [[4.5,y,4.8],[6,y+.55,4],[5.8,y+.12,4.6],[4.25,y-.65,5.1]], row % 2 ? 0 : 4);
    }
    panel("under-eye", [[1.15,146.45,4.55],[5.9,146.85,3.9],[5.45,145.9,4.4],[2,145.5,5]], 0);
    const eye = mirrored([[1.25,147.05,3.94],[5.6,147.2,3.94],[5.75,148.75,3.94],[1.1,148.2,3.94]], side);
    for (let i = 1; i < eye.length - 1; i++) triangle(eye[0], eye[i], eye[i+1], 2, 0);
    panel("brow", [[.85,148.65,4.6],[5.9,149.5,3.7],[5.9,148.9,4.3],[1.05,148.05,4.8]], 0, side < 0 ? 4 : 5);
    panel("jaw-wing", [[3.5,139.5,4.8],[6.1,139,3.8],[4.8,135.6,3.4],[2.5,135.1,4.4]], 1, 1);
    panel("jaw-rail", [[3.7,138.5,5],[4.7,138.6,4.6],[3.8,135.2,4.2],[2.9,135.1,4.6]], 0, 1);
    for (let ring = 0; ring < 3; ring++) for (let j = 0; j < 32; j++) {
      const angle = j * Math.PI / 16, next = (j + 1) * Math.PI / 16;
      const r0 = 1.05 + ring * .54, r1 = r0 + .48, x = side * (8.05 + ring * .12);
      const at = (a, r) => [x, 148 + Math.sin(a)*r, -1.1 + Math.cos(a)*r];
      const a = at(angle,r0), b = at(next,r0), c = at(next,r1), d = at(angle,r1);
      triangle(a,b,c,ring === 1 ? 1 : 0,0); triangle(a,c,d,ring === 1 ? 1 : 0,0);
      const e = [d[0] - side*.55,d[1],d[2]], f = [c[0] - side*.55,c[1],c[2]];
      triangle(d,c,f,3,0); triangle(d,f,e,3,0);
    }
  }
  plate("central-crest", [[-1.2,151.5,3.4],[1.2,151.5,3.4],[2,158.9,2.4],[0,162.3,1.3],[-2,158.9,2.4]], 1);
  plate("crest-inset", [[-.45,153,3.7],[.45,153,3.7],[.75,158.6,3],[0,159.8,2.7],[-.75,158.6,3]], 3);
  for (let row = 0; row < 4; row++) {
    const y = 151.2 - row*.66;
    plate(`bridge-${row}`, [[-.82,y,4.8],[.82,y,4.8],[.57,y-.52,5.3],[-.57,y-.52,5.3]], 0);
  }
  plate("nose", [[-.58,147.7,5.1],[.58,147.7,5.1],[1.1,143.5,6.1],[0,142.8,6.6],[-1.1,143.5,6.1]], 0);
  plate("mouth-cavity", [[-2.7,141.7,4.3],[2.7,141.7,4.3],[2.7,137.2,4.3],[-2.7,137.2,4.3]], 3);
  plate("chin", [[-2.6,138.1,4.8],[2.6,138.1,4.8],[1.9,135,4.3],[0,134.3,4],[-1.9,135,4.3]], 0, 1);
  plate("chin-keel", [[-.55,137.5,5.2],[.55,137.5,5.2],[.85,134.4,4.7],[0,133.7,4.5],[-.85,134.4,4.7]], 1, 1);
  for (let side = -1; side <= 1; side++) {
    const x = side * 1.45, index = side + 1;
    plate(`upper-mouth-${index}`, [[x-.67,141.1,5.8],[x+.67,141.1,5.8],[x+.67,140.35,5.95],[x-.67,140.35,5.95]], 0, 20+index);
    plate(`lower-mouth-${index}`, [[x-.67,140.08,5.8],[x+.67,140.08,5.8],[x+.67,139.25,5.6],[x-.67,139.25,5.6]], 0, 30+index);
  }
  for (let row = 0; row < 5; row++) for (let j = 0; j < 20; j++) {
    const angle = .62 + j * (Math.PI*2-1.24)/20, next = .62 + (j+1)*(Math.PI*2-1.24)/20;
    const ys = [136,141,147,153,158,161], radii = [4,6.6,8,8.2,6,2.1];
    const at = (r,a) => [Math.sin(a)*radii[r],ys[r],Math.cos(a)*radii[r]*.77-1];
    triangle(at(row,angle),at(row,next),at(row+1,next),1,0);
    triangle(at(row,angle),at(row+1,next),at(row+1,angle),1,0);
  }
  const positions = new Float32Array(world.length);
  for (let i = 0; i < world.length; i++) positions[i] = (world[i] - meta.center[i%3]) / meta.scale * meta.quantization;
  return {
    groups: [...groups.values()].map(g => ({ ...g, positions: new Int16Array(g.positions), normals: new Float32Array(g.normals),
      count: g.positions.length / 3 })),
    positions, panels,
  };
}

export function bindRobot(neutral, meta) {
  validMeta(meta);
  if (!neutral.length || neutral.length % 3 || !neutral.every(Number.isFinite)) {
    throw new Error("Cannot bind robot to malformed neutral geometry.");
  }
  const indices = TARGETS.map(target => {
    let best = -1, distance = Infinity;
    for (let i = 0; i < neutral.length; i += 3) {
      let d = 0;
      for (let j = 0; j < 3; j++) d += ((neutral[i+j]/meta.quantization*meta.scale+meta.center[j])-target[j])**2;
      if (d < distance) { distance = d; best = i; }
    }
    if (distance > 16) throw new Error("Robot speech landmark is outside the supported Claire surface.");
    return best;
  });
  return { indices, vertices: neutral.length, worldScale: meta.scale/meta.quantization };
}

export function sampleRobot(rig, neutral, motion, left, right, blend, out) {
  if (out.length !== 6 || neutral.length !== rig.vertices || !Number.isFinite(blend) || blend < 0 || blend > 1
      || !Number.isInteger(left) || !Number.isInteger(right) || left < 0 || right < 0
      || (motion && (motion.length % rig.vertices || Math.max(left,right)*rig.vertices+rig.vertices > motion.length))) {
    throw new Error("Robot motion does not match the face timeline.");
  }
  if (!motion) { out.fill(0); return out; }
  const delta = (landmark, axis) => {
    const i = rig.indices[landmark] + axis;
    return (motion[left*rig.vertices+i]*(1-blend)+motion[right*rig.vertices+i]*blend-neutral[i])*rig.worldScale;
  };
  const opening = Math.max(0, delta(0,1)-delta(1,1));
  out[0] = clamp(opening*.35+Math.max(0,-delta(6,1))*.10, 0, .38);
  out[1] = clamp(opening*.65, 0, .65);
  out[2] = clamp((delta(3,0)-delta(2,0))*.65, -.35, .45);
  out[3] = clamp((delta(2,1)+delta(3,1))*.45, -.35, .45);
  out[4] = clamp(delta(4,1)*1.6, -.55, .8);
  out[5] = clamp(delta(5,1)*1.6, -.55, .8);
  if (!out.every(Number.isFinite)) throw new Error("Robot motion contains nonfinite landmark samples.");
  return out;
}

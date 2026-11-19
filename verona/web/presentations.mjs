export const PRESENTATIONS = Object.freeze({
  claire: Object.freeze({ name: "Claire", style: 0, framing: "full" }),
  facemesh: Object.freeze({ name: "FaceMesh", style: 1, framing: "front" }),
  facedot: Object.freeze({ name: "FaceDot", style: 2, framing: "head-neck" }),
  uniform: Object.freeze({ name: "UniformPolygons", style: 3, framing: "head-neck" }),
});

export function presentation(id) {
  if (!Object.hasOwn(PRESENTATIONS, id)) throw new Error("Choose a supported presentation.");
  return PRESENTATIONS[id];
}

export function topologyEdges(triangles) {
  const edges = [], seen = new Set();
  for (let i = 0; i < triangles.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const a = triangles[i + j], b = triangles[i + (j + 1) % 3];
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      if (!seen.has(key)) { seen.add(key); edges.push(a, b); }
    }
  }
  return new Uint32Array(edges);
}

export function frontFaceTopology(positions, edges, triangles, meta, detail) {
  if (!Number.isInteger(detail) || detail < 1 || detail > 5
      || positions.length % 3 || edges.length % 2 || triangles.length % 3
      || !Number.isFinite(meta.scale) || meta.scale <= 0 || !Number.isFinite(meta.quantization)
      || meta.quantization <= 0 || !meta.center?.every(Number.isFinite)) {
    throw new Error("Cannot build FaceMesh from malformed geometry/detail.");
  }
  const count = positions.length / 3, world = new Float32Array(positions.length);
  const inside = new Uint8Array(count), protectedVertex = new Uint8Array(count);
  const parent = new Uint32Array(count);
  const step = [0.7, 0.5, 0.35, 0.22, 0][detail - 1], cells = [];
  for (let i = 0; i < count; i++) {
    parent[i] = i;
    for (let j = 0; j < 3; j++) {
      world[i * 3 + j] = positions[i * 3 + j] / meta.quantization * meta.scale + meta.center[j];
    }
    const [x, y, z] = world.subarray(i * 3, i * 3 + 3);
    if (![x, y, z].every(Number.isFinite)) throw new Error("FaceMesh contains nonfinite positions.");
    inside[i] = y >= 135.7 && y <= 157 && z >= -0.7 && Math.abs(x) <= 7.5;
    protectedVertex[i] = (Math.abs(x) <= 3.2 && y >= 138.7 && y <= 142.3)
      || (Math.abs(Math.abs(x) - 3.02) <= 2 && y >= 146 && y <= 149.2)
      || (Math.abs(x) <= 1.6 && y >= 142.3 && y <= 147);
    if (step) cells[i] = [x, y, z].map(value => Math.floor(value / step)).join(":");
  }
  for (const indices of [edges, triangles]) {
    for (const index of indices) {
      if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error("FaceMesh index is out of bounds.");
    }
  }
  const root = (i) => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  const faces = [];
  for (let i = 0; i < triangles.length; i += 3) {
    const face = [triangles[i], triangles[i + 1], triangles[i + 2]];
    if (face.every(index => inside[index])) faces.push(face);
  }
  const normal = (face) => {
    const [a, b, c] = face.map(index => index * 3);
    const x = positions[b] - positions[a], y = positions[b + 1] - positions[a + 1], z = positions[b + 2] - positions[a + 2];
    const u = positions[c] - positions[a], v = positions[c + 1] - positions[a + 1], w = positions[c + 2] - positions[a + 2];
    return [y * w - z * v, z * u - x * w, x * v - y * u];
  };
  if (step) {
    const adjacency = Array.from({ length: count }, () => new Set());
    const reference = faces.map((face, i) => {
      for (const index of face) adjacency[index].add(i);
      return normal(face);
    });
    const safeContraction = (a, b, incident) => {
      const neighborsA = new Set(), neighborsB = new Set();
      let sharedFaces = 0;
      for (const i of incident) {
        const face = faces[i].map(root);
        if (new Set(face).size !== 3) continue;
        const hasA = face.includes(a), hasB = face.includes(b);
        if (hasA) for (const index of face) if (index !== a) neighborsA.add(index);
        if (hasB) for (const index of face) if (index !== b) neighborsB.add(index);
        if (hasA && hasB) { sharedFaces++; continue; }
        const next = normal(face.map(index => index === b ? a : index));
        const before = reference[i];
        const dot = next.reduce((sum, value, j) => sum + value * before[j], 0);
        if (dot <= 1e-9 * Math.hypot(...next) * Math.hypot(...before)) return false;
      }
      const common = [...neighborsA].filter(index => neighborsB.has(index)).length;
      return sharedFaces >= 1 && sharedFaces <= 2 && common === sharedFaces;
    };
    // Contract connected native edges only; never merge nearby opposing lip/lid sheets.
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i], b = edges[i + 1];
      if (inside[a] && inside[b] && !protectedVertex[a] && !protectedVertex[b] && cells[a] === cells[b]) {
        const ra = Math.min(root(a), root(b)), rb = Math.max(root(a), root(b));
        if (ra === rb) continue;
        const incident = new Set([...adjacency[ra], ...adjacency[rb]]);
        if (!safeContraction(ra, rb, incident)) continue;
        parent[rb] = ra;
        adjacency[ra] = incident;
        adjacency[rb].clear();
      }
    }
  }
  const kept = [], unique = new Set();
  for (const source of faces) {
    const face = source.map(root);
    if (new Set(face).size !== 3) continue;
    const key = face.slice().sort((a, b) => a - b).join(":");
    if (!unique.has(key)) { unique.add(key); kept.push(...face); }
  }
  if (!kept.length) throw new Error("FaceMesh removed the entire front face.");
  const triangleData = new Uint32Array(kept);
  return { triangles: triangleData, edges: topologyEdges(triangleData),
    vertices: new Uint32Array([...new Set(kept)].sort((a, b) => a - b)) };
}

export function presentationFit(positions, vertices, quantization, extraPositions = null, extraVertices = null) {
  const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
  const include = (data, indices) => {
    const count = indices ? indices.length : data.length / 3;
    for (let n = 0; n < count; n++) for (let j = 0; j < 3; j++) {
      const value = data[(indices ? indices[n] : n) * 3 + j] / quantization;
      low[j] = Math.min(low[j], value); high[j] = Math.max(high[j], value);
    }
  };
  include(positions, vertices);
  if (extraPositions) include(extraPositions, extraVertices);
  const extent = Math.max(...high.map((value, i) => value - low[i]));
  if (!Number.isFinite(extent) || extent <= 0) throw new Error("Cannot fit an empty presentation.");
  return { center: high.map((value, i) => (value + low[i]) / 2), scale: 1.8 / extent };
}

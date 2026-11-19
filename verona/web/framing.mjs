export function trimTopology(positions, edges, triangles, cutoff) {
  if (!Number.isFinite(cutoff) || positions.length % 3 || edges.length % 2 || triangles.length % 3) {
    throw new Error("Cannot frame malformed face geometry.");
  }
  const count = positions.length / 3;
  const used = new Uint8Array(count);
  for (let i = 0; i < count; i++) used[i] = positions[i * 3 + 1] >= cutoff ? 1 : 0;
  const retain = (indices, width) => {
    const kept = [];
    for (let i = 0; i < indices.length; i += width) {
      let visible = false;
      for (let j = 0; j < width; j++) {
        if (positions[indices[i + j] * 3 + 1] >= cutoff) visible = true;
      }
      if (!visible) continue;
      for (let j = 0; j < width; j++) {
        const index = indices[i + j];
        kept.push(index);
        used[index] = 1;
      }
    }
    return new Uint32Array(kept);
  };
  const keptTriangles = retain(triangles, 3), keptEdges = retain(edges, 2);
  const vertices = [];
  for (let i = 0; i < count; i++) if (used[i]) vertices.push(i);
  if (!vertices.length || !keptTriangles.length) throw new Error("Framing removed the entire face surface.");
  return { triangles: keptTriangles, edges: keptEdges, vertices: new Uint32Array(vertices) };
}
export const NECK_CUTOFF_Y = 134;

export const JAW_CROP = Object.freeze({
  chin: 135.7, curve: 0.1, rearRise: 3, rearStart: -1, rearSpan: 7,
  defaultNeck: 1.7, maximumNeck: 6,
});

export function jawCutHeight(x, z, neck) {
  return JAW_CROP.chin + JAW_CROP.curve * x * x
    + JAW_CROP.rearRise * Math.max(0, Math.min(1, (JAW_CROP.rearStart - z) / JAW_CROP.rearSpan)) - neck;
}

export function trimJawTopology(positions, edges, triangles, meta, neck) {
  if (!Number.isFinite(neck) || neck < 0 || neck > JAW_CROP.maximumNeck
      || positions.length % 3 || edges.length % 2 || triangles.length % 3
      || meta.center?.length !== 3 || !meta.center.every(Number.isFinite)
      || !Number.isFinite(meta.scale) || meta.scale <= 0
      || !Number.isFinite(meta.quantization) || meta.quantization <= 0) {
    throw new Error("Cannot frame malformed jaw geometry or neck length.");
  }
  const count = positions.length / 3, world = new Float32Array(positions.length);
  const used = new Uint8Array(count);
  for (let i = 0; i < positions.length; i++) {
    const value = positions[i] / meta.quantization * meta.scale + meta.center[i % 3];
    if (!Number.isFinite(value)) throw new Error("Jaw geometry contains nonfinite positions.");
    world[i] = value;
  }
  for (let i = 0; i < count; i++) {
    used[i] = world[i * 3 + 1] >= jawCutHeight(world[i * 3], world[i * 3 + 2], neck);
  }
  const retain = (indices, width) => {
    const kept = [];
    for (let i = 0; i < indices.length; i += width) {
      let lowX = Infinity, highX = -Infinity, highY = -Infinity, highZ = -Infinity;
      for (let j = 0; j < width; j++) {
        const index = indices[i + j];
        if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error("Jaw index is out of bounds.");
        const x = world[index * 3], y = world[index * 3 + 1], z = world[index * 3 + 2];
        lowX = Math.min(lowX, x); highX = Math.max(highX, x);
        highY = Math.max(highY, y); highZ = Math.max(highZ, z);
      }
      // Conservative curved-boundary bound: interiors can survive even if every corner is clipped.
      const nearestX = lowX > 0 ? lowX : highX < 0 ? highX : 0;
      if (highY + 0.002 < jawCutHeight(nearestX, highZ, neck)) continue;
      for (let j = 0; j < width; j++) {
        kept.push(indices[i + j]);
        used[indices[i + j]] = 1;
      }
    }
    return new Uint32Array(kept);
  };
  const keptTriangles = retain(triangles, 3), keptEdges = retain(edges, 2);
  const vertices = [];
  for (let i = 0; i < count; i++) if (used[i]) vertices.push(i);
  if (!keptTriangles.length) throw new Error("Jaw framing removed the entire face surface.");
  return { triangles: keptTriangles, edges: keptEdges, vertices: new Uint32Array(vertices) };
}

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

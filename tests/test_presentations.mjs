import assert from "node:assert/strict";
import { frontFaceTopology, topologyEdges, presentationFit, presentation } from "../verona/web/presentations.mjs";

const positions = [], triangles = [], edges = [];
const columns = 61, rows = 101;
for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
  positions.push(x / 6 - 5, 136 + y / 5, 3);
  const a = y * columns + x;
  if (x + 1 < columns) edges.push(a, a + 1);
  if (y + 1 < rows) edges.push(a, a + columns);
  if (x + 1 < columns && y + 1 < rows) {
    triangles.push(a, a + 1, a + columns + 1, a, a + columns + 1, a + columns);
  }
}
const frontCount = positions.length / 3;
positions.push(9,147,-3, 0,130,0, -9,147,-3);
triangles.push(frontCount, frontCount + 1, frontCount + 2);
const original = positions.slice();
const meta = { center: [0,0,0], scale: 1, quantization: 1 };
const native = frontFaceTopology(positions, edges, triangles, meta, 5);
assert.equal(native.triangles.length, (rows - 1) * (columns - 1) * 6);
assert(native.vertices.every(i => i < frontCount));
const counts = [];
for (let detail = 1; detail <= 5; detail++) {
  const result = frontFaceTopology(positions, edges, triangles, meta, detail);
  counts.push(result.triangles.length / 3);
  assert(result.vertices.every(i => i < frontCount));
  assert(result.triangles.every(i => i < frontCount));
  const used = new Set(result.vertices);
  for (let i = 0; i < frontCount; i++) {
    const [x,y] = positions.slice(i * 3, i * 3 + 2);
    if (Math.abs(x) < 3 && y > 139 && y < 142) assert(used.has(i), `Lost protected lip ${i}`);
    if (Math.abs(Math.abs(x)-3.02) < 1.8 && y > 146.2 && y < 149) assert(used.has(i), `Lost protected lid ${i}`);
  }
}
assert(counts[0] < counts[4]);
assert.deepEqual(positions, original);
const fold = [4.5,150.05,3, 4.25,150.05,3, 4.35,149.9,3, 4.35,150.3,3, 4.5,150.5,3];
const foldTriangles = [0,1,4, 1,2,3];
assert.deepEqual([...frontFaceTopology(fold, [0,1], foldTriangles, meta, 1).triangles], foldTriangles);
assert.deepEqual([...topologyEdges(new Uint32Array([0,1,2, 0,2,3]))], [0,1,1,2,2,0,2,3,3,0]);
const fit = presentationFit(positions, native.vertices, 1);
assert(Math.abs(fit.center[1] - 146) < 1e-6);
assert(Math.abs(fit.scale - .09) < 1e-6);
assert.throws(() => frontFaceTopology(positions, edges, triangles, meta, 0), /malformed/);
assert.throws(() => frontFaceTopology(positions, edges, [...triangles,0,1,999999], meta, 5), /bounds/);
assert.throws(() => frontFaceTopology(positions, edges, [frontCount,frontCount+1,frontCount+2], meta, 5), /entire front/);
assert.throws(() => presentation("realistic"), /supported/);
assert.throws(() => presentationFit(positions, [], 1), /empty/);
assert.equal(presentation("claire").framing, "full");
console.log(JSON.stringify({ frontOnly: true, protectedLipsAndLids: true, triangleCountsByDetail: counts,
  originalGeometryUnchanged: true, futureRealisticNotImplemented: true }));

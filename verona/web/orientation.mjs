export function rotationMatrix(x, y, z) {
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y);
  const cz = Math.cos(z), sz = Math.sin(z);
  return new Float32Array([
    cz * cy, sz * cy, -sy,
    cz * sy * sx - sz * cx, sz * sy * sx + cz * cx, cy * sx,
    cz * sy * cx + sz * sx, sz * sy * cx - cz * sx, cy * cx,
  ]);
}

export function cursorGaze(x, y, rect, rotation, zoom, center, scale) {
  const half = Math.max(1, rect.height / 2) * zoom * .91;
  const target = [(x - rect.left - rect.width / 2) / half,
    (rect.top + rect.height / 2 - y) / half, 2];
  const local = [0, 1, 2].map((axis) => rotation[axis * 3] * target[0]
    + rotation[axis * 3 + 1] * target[1] + rotation[axis * 3 + 2] * target[2]);
  const distance = Math.max(.5, Math.abs(local[2] - (2.26 - center[2]) / scale));
  return [Math.max(-.42, Math.min(.42, (local[0] - (.08 - center[0]) / scale) / distance)),
    Math.max(-.24, Math.min(.24, (local[1] - (147.52 - center[1]) / scale) / distance))];
}

const transform = (m, p) => [0, 1, 2].map(row => m[row]*p[0] + m[row+3]*p[1] + m[row+6]*p[2]);

export function cursorHeadAngles(x, y, rect, rotation, zoom, center, scale) {
  const anchor = transform(rotation, [(0.08-center[0])/scale, (147.52-center[1])/scale, (2.26-center[2])/scale]);
  const half = Math.max(1, rect.height / 2) * zoom * .91;
  const dx = (x-rect.left-rect.width/2)/half-anchor[0], dy = (rect.top+rect.height/2-y)/half-anchor[1];
  return [Math.max(-.45, Math.min(.45, -Math.atan2(dy, Math.hypot(dx, 2)))),
    Math.max(-.65, Math.min(.65, Math.atan2(dx, 2)))];
}

export function trackedHeadPose(angles, manual, center, scale) {
  if (angles[0] === 0 && angles[1] === 0) return { rotation: manual, offset: [0, 0, 0] };
  const follow = rotationMatrix(angles[0], angles[1], 0);
  const rotation = new Float32Array(9);
  for (let column = 0; column < 3; column++) rotation.set(transform(follow, Array.from(manual.slice(column*3,column*3+3))), column*3);
  const eye = [(0.08-center[0])/scale, (147.52-center[1])/scale, (2.26-center[2])/scale];
  const anchor = transform(manual, eye), moved = transform(rotation, eye);
  return { rotation, offset: anchor.map((v, i) => v - moved[i]) };
}

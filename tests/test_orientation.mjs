import assert from "node:assert/strict";
import { rotationMatrix, cursorGaze } from "../verona/web/orientation.mjs";

const rotate = (m, p) => [0, 1, 2].map((row) =>
  m[row] * p[0] + m[row + 3] * p[1] + m[row + 6] * p[2]);
const close = (actual, expected) => actual.forEach((v, i) => assert(Math.abs(v - expected[i]) < 1e-6));
close(rotate(rotationMatrix(Math.PI / 2, 0, 0), [0, 1, 0]), [0, 0, 1]);
close(rotate(rotationMatrix(0, Math.PI / 2, 0), [0, 0, 1]), [1, 0, 0]);
close(rotate(rotationMatrix(0, 0, Math.PI / 2), [1, 0, 0]), [0, 1, 0]);
const m = rotationMatrix(.5, -.8, 1.2), p = rotate(m, [.2, -.4, .8]);
assert(Math.abs(Math.hypot(...p) - Math.hypot(.2, -.4, .8)) < 1e-6);
const rect = { left: 100, top: 50, width: 400, height: 600 }, center = [0, 147.52, 2.26];
const gaze = (x, y, angles = [0, 0, 0]) => cursorGaze(x, y, rect, rotationMatrix(...angles), 1, center, 15);
assert(gaze(600, 350)[0] > 0);
assert(gaze(0, 350)[0] < 0);
assert(gaze(300, -100)[1] > 0);
assert(gaze(300, 900)[1] < 0);
assert(gaze(600, 350, [0, 0, Math.PI])[0] < 0);
assert(gaze(1e9, -1e9).every(Number.isFinite));
assert(Math.abs(gaze(1e9, -1e9)[0]) <= .42 && Math.abs(gaze(1e9, -1e9)[1]) <= .24);
console.log("XYZ composition, distance preservation, cursor direction, rotation compensation and gaze bounds pass.");

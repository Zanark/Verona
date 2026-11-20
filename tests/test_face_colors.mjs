import assert from "node:assert/strict";
import test from "node:test";
import { parseFaceColor } from "../verona/web/face-colors.mjs";

test("hex entry accepts shorthand, optional hash, case and surrounding whitespace", () => {
  assert.deepEqual(parseFaceColor(" #a3f "), { hex: "#AA33FF", rgb: [170 / 255, .2, 1] });
  assert.deepEqual(parseFaceColor("12AbEf"), { hex: "#12ABEF", rgb: [18 / 255, 171 / 255, 239 / 255] });
  assert.deepEqual(parseFaceColor("#000000").rgb, [0, 0, 0]);
  assert.deepEqual(parseFaceColor("fff").rgb, [1, 1, 1]);
});

test("invalid or alpha-bearing hex is rejected instead of silently choosing a color", () => {
  for (const input of ["", "#", "#12", "#abcd", "#12345", "#12345678", "1234567",
    "#GG0000", "red", "rgb(0,0,0)", "##123456", "#12 3456", null, 123456, {}]) {
    assert.throws(() => parseFaceColor(input), /3- or 6-digit hex color/);
  }
});

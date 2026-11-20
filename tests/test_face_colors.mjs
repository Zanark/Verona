import assert from "node:assert/strict";
import test from "node:test";
import { parseFaceColor, createAppearance } from "../verona/web/face-colors.mjs";

test("hex entry accepts shorthand, optional hash, case and surrounding whitespace", () => {
  assert.deepEqual(parseFaceColor(" #a3f "), { hex: "#AA33FF", rgb: [170 / 255, .2, 1] });
  assert.deepEqual(parseFaceColor("12AbEf"), { hex: "#12ABEF", rgb: [18 / 255, 171 / 255, 239 / 255] });
  assert.deepEqual(parseFaceColor("#000000").rgb, [0, 0, 0]);
  assert.deepEqual(parseFaceColor("fff").rgb, [1, 1, 1]);
});

test("appearance patches are canonical, independent, atomic and reset to original", () => {
  const updates=[],appearance=createAppearance(colors=>updates.push(colors));
  const original={mesh:null,eyes:null,hair:null,lips:null,eyebrows:null};
  assert.deepEqual(appearance.read(),original);
  assert.deepEqual(appearance.apply({hair:"#aabbcc",lips:"#112233"}),
    {...original,hair:"#AABBCC",lips:"#112233"});
  const before=appearance.read(),count=updates.length;
  for(const patch of [{mesh:"#FFFFFF",hair:"blue"},{eyes:"#abc"},{lips:"#12345678"},
    {hair:undefined},{unknown:null},[],null]){
    assert.throws(()=>appearance.apply(patch));
    assert.deepEqual(appearance.read(),before);
    assert.equal(updates.length,count,"Invalid patches cannot reach the renderer.");
  }
  const snapshot=appearance.read();snapshot.hair="#FFFFFF";
  assert.equal(appearance.read().hair,"#AABBCC");
  assert.deepEqual(appearance.apply({hair:null}),{...original,lips:"#112233"});
  assert.deepEqual(appearance.apply(original),original);
});

test("invalid or alpha-bearing hex is rejected instead of silently choosing a color", () => {
  for (const input of ["", "#", "#12", "#abcd", "#12345", "#12345678", "1234567",
    "#GG0000", "red", "rgb(0,0,0)", "##123456", "#12 3456", null, 123456, {}]) {
    assert.throws(() => parseFaceColor(input), /3- or 6-digit hex color/);
  }
});

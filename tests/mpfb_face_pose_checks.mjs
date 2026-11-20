import assert from "node:assert/strict";
import test from "node:test";
import {blendFaceUnits} from "../scripts/mpfb_face_poses.mjs";

test("native targets blend over the distinct rest head without mutation or drift", () => {
  const model={rest:[1,2,3,-1,2,3],basis:{
    jaw:[0,-2,1,0,-2,1],smile:[.2,.3,0,-.2,.3,0]}};
  const before=JSON.stringify(model);
  assert.deepEqual([...blendFaceUnits(model,{},0)],model.rest);
  const result=blendFaceUnits(model,{jaw:.5,smile:1},.5);
  const expected=[1.1,1.65,3.25,-1.1,1.65,3.25];
  result.forEach((value,i)=>assert(Math.abs(value-expected[i])<1e-6));
  assert.deepEqual(blendFaceUnits(model,{jaw:.5,smile:1},.5),result);
  assert.equal(JSON.stringify(model),before);
});

test("unknown/malformed units, invalid strengths and nonfinite geometry fail explicitly", () => {
  const model={rest:[0,0,0],basis:{jaw:[0,-1,0],broken:[1,2],bad:[Infinity,0,0]}};
  for(const [weights,strength] of [[{missing:1},1],[{broken:1},1],[{bad:1},1],
    [{jaw:NaN},1],[{jaw:-1},1],[{jaw:1.1},1],[{jaw:1},Infinity],[{jaw:1},-1],[{},1.1]]) {
    assert.throws(()=>blendFaceUnits(model,weights,strength));
  }
  assert.throws(()=>blendFaceUnits({rest:[0,0],basis:{}},{}));
  assert.throws(()=>blendFaceUnits({rest:[Infinity,0,0],basis:{}},{}));
});

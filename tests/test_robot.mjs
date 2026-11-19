import assert from "node:assert/strict";
import { createRobot, bindRobot, sampleRobot } from "../verona/web/robot.mjs";
import { presentationFit } from "../verona/web/presentations.mjs";

const meta = { center: [0,146,0], scale: 20, quantization: 10000 };
const robot = createRobot(meta), again = createRobot(meta);
assert(robot.panels.some(p => p.name === "chin" && p.part === 1));
assert(robot.panels.filter(p => p.name.startsWith("cheek-louver")).length === 10);
assert(robot.panels.filter(p => p.name.includes("mouth-")).length === 7);
let vertices = 0;
for (let g = 0; g < robot.groups.length; g++) {
  const group = robot.groups[g];
  assert.deepEqual(group.positions,again.groups[g].positions);
  assert.equal(group.positions.length,group.normals.length);
  assert.equal(group.positions.length,group.count*3);
  assert.equal(group.count%3,0);
  vertices += group.count;
  for (let i = 0; i < group.positions.length; i += 9) {
    const p = group.positions, ab = [p[i+3]-p[i],p[i+4]-p[i+1],p[i+5]-p[i+2]];
    const ac = [p[i+6]-p[i],p[i+7]-p[i+1],p[i+8]-p[i+2]];
    const cross = [ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    assert(Math.hypot(...cross)>0,`Quantized degenerate panel ${g}/${i}`);
    for (let j = 0; j < 9; j += 3) assert(Math.abs(Math.hypot(...group.normals.subarray(i+j,i+j+3))-1)<1e-5);
  }
}
assert(vertices/3 < 10000);
const fit = presentationFit(robot.positions,null,meta.quantization);
for (let i = 0; i < robot.positions.length; i += 3) for (let j = 0; j < 3; j++) {
  assert(Math.abs((robot.positions[i+j]/meta.quantization-fit.center[j])*fit.scale)<.901);
}
const targets = [[0,140.65,3.8],[0,139.55,3.8],[-2.4,140.1,3.6],[2.4,140.1,3.6],
  [-3,149.4,2.6],[3,149.4,2.6],[0,136.1,1.8]];
const neutral = new Int16Array(targets.flatMap(p=>p.map((v,j)=>Math.round((v-meta.center[j])/meta.scale*meta.quantization))));
const before = neutral.slice(), rig = bindRobot(neutral,meta), out = new Float32Array(6);
const motion = new Int16Array([...neutral,...neutral]);
motion[neutral.length+4] -= 200;
motion[neutral.length+18+1] -= 200;
motion[neutral.length+6] -= 150;
motion[neutral.length+9] += 150;
motion[neutral.length+12+1] += 200;
motion[neutral.length+15+1] -= 100;
assert.deepEqual([...sampleRobot(rig,neutral,motion,0,0,0,out)],[0,0,0,0,0,0]);
const full = [...sampleRobot(rig,neutral,motion,1,1,0,out)];
assert(full[0]>0 && full[1]>0 && full[2]>0 && full[4]>0 && full[5]<0);
const half = [...sampleRobot(rig,neutral,motion,0,1,.5,out)];
for (let i = 0; i < 6; i++) assert(Math.abs(half[i]-full[i]/2)<1e-6);
const extreme = motion.slice(); extreme[neutral.length+4] -= 3000;
sampleRobot(rig,neutral,extreme,1,1,0,out);
assert(Math.abs(out[0]-.38)<1e-6 && Math.abs(out[1]-.65)<1e-6);
assert.equal(sampleRobot(rig,neutral,null,0,0,0,out),out);
assert.deepEqual([...out],[0,0,0,0,0,0]);
assert.deepEqual(neutral,before);
assert.throws(()=>sampleRobot(rig,neutral,motion,0,2,0,out),/timeline/);
assert.throws(()=>sampleRobot(rig,neutral,motion,-1,0,0,out),/timeline/);
assert.throws(()=>sampleRobot(rig,neutral,motion,0,1,NaN,out),/timeline/);
const invalid = new Float32Array(motion); invalid[neutral.length+4]=NaN;
assert.throws(()=>sampleRobot(rig,neutral,invalid,1,1,0,out),/nonfinite/);
assert.throws(()=>bindRobot(new Int16Array([0,0,0]),meta),/landmark/);
assert.throws(()=>createRobot({...meta,scale:0}),/malformed/);
console.log(JSON.stringify({triangles:vertices/3,drawGroups:robot.groups.length,
  deterministic:true,quantizedNondegenerate:true,audioClockInterpolation:true,sparseRig:true,neutralRestoration:true}));

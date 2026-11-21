import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { HAIRSTYLES, hairstyle, createHairstyle } from "../verona/web/hairstyles.mjs";
import { trimJawTopology } from "../verona/web/framing.mjs";

const meta = { center: [0,142,-5], scale: 28, quantization: 16000 }, hashes = new Set();
const inventory = [];
for (const id of Object.keys(HAIRSTYLES).filter(id=>id!=="claire")) {
  const hair = createHairstyle(id,meta), count=hair.positions.length/3;
  assert(count>500 && count<17000);
  assert(hair.triangles.length/3<33000);
  const parents=Uint32Array.from({length:count},(_,i)=>i);
  const root=i=>{while(parents[i]!==i)i=parents[i];return i;};
  for(let i=0;i<hair.triangles.length;i+=3){
    const a=root(hair.triangles[i]);
    parents[root(hair.triangles[i+1])]=a;parents[root(hair.triangles[i+2])]=a;
  }
  const components=new Map();
  for(let i=0;i<count;i++){const r=root(i);components.set(r,(components.get(r)||0)+1);}
  assert.equal(components.size,49,"One scalp and 48 independent spiral locks, previously 24");
  assert.equal([...components.values()].filter(size=>size===320).length,48);
  assert([...hair.triangles,...hair.edges].every(i=>i>=0 && i<count));
  let collapsed=0, faceBlocked=0;
  const p = i => [0,1,2].map(a=>hair.positions[i*3+a]/meta.quantization*meta.scale+meta.center[a]);
  for(let i=0;i<count;i++){const [x,y,z]=p(i);if(Math.abs(x)<5 && y>139 && y<151 && z>0)faceBlocked++;}
  assert.equal(faceBlocked,0,`${id} covers the protected central face`);
  for(let i=0;i<hair.triangles.length;i+=3){
    const [a,b,c]=Array.from(hair.triangles.slice(i,i+3),p),u=b.map((v,j)=>v-a[j]),v=c.map((n,j)=>n-a[j]);
    if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-8)collapsed++;
  }
  assert.equal(collapsed,0,`${id} has collapsed packed triangles`);
  const hash=createHash("sha256").update(Buffer.from(hair.positions.buffer)).digest("hex");
  assert(!hashes.has(hash),`${id} duplicates another geometry`);hashes.add(hash);
  assert.equal(createHash("sha256").update(Buffer.from(createHairstyle(id,meta).positions.buffer)).digest("hex"),hash);
  for(const depth of [0,1.7,6])assert(trimJawTopology(hair.positions,hair.edges,hair.triangles,meta,depth).triangles.length<=hair.triangles.length);
  inventory.push({id,vertices:count,triangles:hair.triangles.length/3});
}
assert.deepEqual(Object.keys(HAIRSTYLES),["claire","curls"]);
assert.equal(hashes.size,1);
for(const id of ["pixie","bob","angled","straight","ponytail","twins","bun","double","braid"]){
  assert.throws(()=>hairstyle(id),/supported/);
  assert.throws(()=>createHairstyle(id,meta),/supported/);
}
assert.throws(()=>createHairstyle("unknown",meta),/supported/);
assert.throws(()=>createHairstyle("claire",meta),/verified mesh/);
assert.throws(()=>createHairstyle("curls",{...meta,scale:0}),/malformed/);
assert.throws(()=>createHairstyle("curls",{...meta,scale:.001}),/bounds/);
const original=createHairstyle("curls",meta);
const fitted=createHairstyle("curls",{...meta,hair:{scale:1.12}});
assert.deepEqual(fitted.triangles,original.triangles);
for(let i=0;i<fitted.positions.length;i++){
  const axis=i%3,anchor=[0,148.2,-5.7][axis];
  const world=original.positions[i]/meta.quantization*meta.scale+meta.center[axis];
  const expected=(world-anchor)*1.12+anchor;
  const actual=fitted.positions[i]/meta.quantization*meta.scale+meta.center[axis];
  assert(Math.abs(actual-expected)<=meta.scale/meta.quantization*1.12);
}
assert.throws(()=>createHairstyle("curls",{...meta,hair:{scale:NaN}}),/hair fit/);
console.log(JSON.stringify({deterministicDistinctHairstyles:hashes.size,inventory}));

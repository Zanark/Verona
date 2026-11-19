import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { HAIRSTYLES, createHairstyle } from "../verona/web/hairstyles.mjs";
import { trimJawTopology } from "../verona/web/framing.mjs";

const meta = { center: [0,142,-5], scale: 28, quantization: 16000 }, hashes = new Set();
const inventory = [];
for (const id of Object.keys(HAIRSTYLES).filter(id=>id!=="claire")) {
  const hair = createHairstyle(id,meta), count=hair.positions.length/3;
  assert(count>500 && count<10000);
  assert(hair.triangles.length/3<17840);
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
assert(hashes.size>=10);
assert.throws(()=>createHairstyle("unknown",meta),/supported/);
assert.throws(()=>createHairstyle("claire",meta),/verified mesh/);
assert.throws(()=>createHairstyle("bob",{...meta,scale:0}),/malformed/);
assert.throws(()=>createHairstyle("bob",{...meta,scale:.001}),/bounds/);
console.log(JSON.stringify({deterministicDistinctHairstyles:hashes.size,inventory}));

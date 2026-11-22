import assert from "node:assert/strict";
import {facialProfile, mouthAperture, mouthShape, sampleMouthOpening, WIDE_MOUTH_OPENING_CM} from "../verona/web/facial-features.mjs";

const profile=facialProfile("claire"),meta={center:[0,140,0],scale:10,quantization:10000};
const points=[];
for(const upper of [true,false])for(let n=0;n<=20;n++){
  const x=n/10-1,t=x*x;
  points.push(profile.mouth[0]+x*(profile.mouth[2]-.3),
    (profile.mouth[1]+(upper?.45:-.35))*(1-t)+profile.upper[4]*t,
    profile.depth[0]*(1-t)+profile.depth[1]*t+.5);
}
const rimVertices=points.length/3;
// Nearby back surfaces must not become the visible animated aperture.
for(let n=0;n<rimVertices;n++)points.push(points[n*3],points[n*3+1],0);
const packed=Int16Array.from(points,(v,n)=>Math.round((v-meta.center[n%3])/meta.scale*meta.quantization));
const indices=mouthAperture(packed,meta,profile);
const {pairs} = mouthShape(packed,meta,profile);
const restOpening=sampleMouthOpening(packed,meta,pairs);
const closedSpeech=packed.slice(), wideSpeech=packed.slice();
for(let n=0;n<pairs.length;n+=2){
  closedSpeech[pairs[n+1]*3+1]-=100;
  wideSpeech[pairs[n+1]*3+1]-=1800;
}
assert(sampleMouthOpening(closedSpeech,meta,pairs)-restOpening<WIDE_MOUTH_OPENING_CM);
assert(sampleMouthOpening(wideSpeech,meta,pairs)-restOpening>WIDE_MOUTH_OPENING_CM);
assert.equal(sampleMouthOpening(packed,meta,pairs)-restOpening,0);
assert.equal(sampleMouthOpening(Int16Array.from([...packed,...wideSpeech]),meta,pairs,packed.length),
  sampleMouthOpening(wideSpeech,meta,pairs),"Sampling must use the selected animation frame.");
assert.throws(()=>sampleMouthOpening(new Int16Array(),meta,pairs),/finite/);
assert(indices.length>0&&indices.length<=240);
assert([...indices].every(i=>i<rimVertices));
assert(indices.every((_,i)=>i%3||new Set(indices.slice(i,i+3)).size===3));
for(let n=0;n<indices.length;n+=3){
  const xs=Array.from(indices.slice(n,n+3),i=>points[i*3]);
  assert(Math.max(...xs)-Math.min(...xs)<profile.mouth[2]/2,
    "Local upper/lower strips must not bridge the recessed corners to the protruding center.");
}
const area=positions=>{
  let total=0;
  for(let n=0;n<indices.length;n+=3){
    const [a,b,c]=Array.from(indices.slice(n,n+3),i=>positions.slice(i*3,i*3+2));
    total+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]))/2;
  }
  return total;
};
const open=points.map((v,n)=>n%3===1&&Math.floor(n/3)>=21&&Math.floor(n/3)<42?v-2:v);
assert(area(open)>area(points)*3,"Existing indices must follow actual upper/lower animated separation.");
assert.throws(()=>mouthAperture(new Int16Array(),meta,profile),/native lip rim/);
assert.throws(()=>facialProfile("unregistered"),/No native/);
console.log("Native mouth-rim selection, animated aperture and explicit failure checks passed.");

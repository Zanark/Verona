// Symmetric rest-space paint guides, fitted to the six native lip silhouettes.
// These approximate cosmetics, not anatomical calibration or new speech poses.
const PROFILES = {
  claire: {mouth: [.08, 140.20, 2.65], upper: [141.04, 141.15, 140.94, 140.55, 140.18],
    lower: [139.48, 139.49, 139.62, 139.91, 140.18], depth: [4.08, 3.08]},
  mpfb: {mouth: [.08, 140.96, 2.6], upper: [141.96, 142.06, 141.84, 141.35, 140.95],
    lower: [139.62, 139.68, 139.95, 140.44, 140.95], depth: [5.20, 4.12]},
  mark: {mouth: [.08, 141.11, 3.2], upper: [141.72, 141.82, 141.62, 141.32, 141.08],
    lower: [140.08, 140.13, 140.38, 140.77, 141.08], depth: [5.03, 4.0]},
  "reference-structure": {mouth: [.08, 141.05, 2.65],
    upper: [141.73, 141.84, 141.64, 141.29, 141.03],
    lower: [140.16, 140.20, 140.40, 140.74, 141.03], depth: [5.29, 4.16]},
  "reference-shell": {mouth: [.08, 140.94, 2.65],
    upper: [141.69, 141.81, 141.59, 141.25, 140.96],
    lower: [140.14, 140.16, 140.29, 140.64, 140.96], depth: [5.13, 4.12]},
  "male-sharp": {mouth: [.08, 140.25, 2.65], upper: [141.04, 141.15, 140.94, 140.55, 140.18],
    lower: [139.50, 139.52, 139.66, 139.94, 140.18], depth: [4.14, 3.12]},
};

export function facialProfile(model) {
  const profile = PROFILES[model];
  if (!profile) throw new Error("No native facial paint guide for this model.");
  return profile;
}

export function mouthAperture(positions, meta, profile) {
  const [cx, cy, width] = profile.mouth, halfWidth = width-.3;
  const candidates = [];
  for (let i=0; i<positions.length; i+=3) {
    const p = [0,1,2].map(axis => positions[i+axis]/meta.quantization*meta.scale+meta.center[axis]);
    if (Math.abs(p[0]-cx)<width+.3 && Math.abs(p[1]-cy)<1
        && p[2]>Math.min(...profile.depth)-.5) candidates.push({id:i/3,p});
  }
  if (!candidates.length) throw new Error("The native lip rim has no finite vertices.");
  const rims = [];
  for (const upper of [true,false]) {
    const rim = [];
    for (let n=0;n<=40;n++) {
    const x=n/20-1, t=x*x;
    const target=[cx+x*halfWidth, (cy+(upper?.10:-.15))*(1-t)+profile.upper[4]*t,
      profile.depth[0]*(1-t)+profile.depth[1]*t+.25];
    let best=null, distance=Infinity;
    for (const point of candidates) {
      const local=Math.min(1,Math.abs((point.p[0]-cx)/halfWidth));
      const seam=cy*(1-local*local)+profile.upper[4]*local*local;
      if(upper ? point.p[1]<seam : point.p[1]>seam)continue;
      const delta=point.p.map((v,axis)=>v-target[axis]);
      const d=4*delta[0]*delta[0]+4*delta[1]*delta[1]+delta[2]*delta[2];
      if(d<distance){best=point.id;distance=d;}
    }
    if(best===null)throw new Error("Cannot identify both sides of the native lip rim.");
    rim.push(best);
    }
    rims.push(rim);
  }
  const triangles=[];
  // Pair corresponding upper/lower samples; a corner fan lies behind the
  // protruding center lips and leaves the original mouth sheet visible.
  for(let n=0;n<40;n++)for(const face of [
    [rims[0][n],rims[0][n+1],rims[1][n+1]],
    [rims[0][n],rims[1][n+1],rims[1][n]],
  ])if(new Set(face).size===3){
    triangles.push(...face);
  }
  if(!triangles.length)throw new Error("The native lip rim cannot form a mouth aperture.");
  return Uint32Array.from(triangles);
}

export const FACIAL_FEATURE_GLSL = `
  uniform vec3 lipMouth;
  uniform vec2 lipDepth;
  uniform float lipUpper[5], lipLower[5], rowanLids;
  float mouthSeam(float x) {
    float t=min(1.0,abs(x-lipMouth.x)/(lipMouth.z-.3));
    return mix(lipMouth.y,lipUpper[4],t*t);
  }
  float lipCurve(float values[5], float t) {
    float u = clamp(t, 0.0, 1.0)*4.0;
    int i = min(3, int(u));
    u -= float(i);
    float a=values[i], b=values[i+1];
    float m0=i==0 ? 0.0 : (b-values[i-1])*.5;
    float m1=i==3 ? 0.0 : (values[i+2]-a)*.5;
    return (2.0*u*u*u-3.0*u*u+1.0)*a+(u*u*u-2.0*u*u+u)*m0
      +(-2.0*u*u*u+3.0*u*u)*b+(u*u*u-u*u)*m1;
  }
  vec3 lipRegion(vec3 p) {
    float t=abs(p.x-lipMouth.x)/lipMouth.z;
    float border=min(lipCurve(lipUpper,t)-p.y,p.y-lipCurve(lipLower,t));
    return vec3(t,border,mix(lipDepth.x,lipDepth.y,min(1.0,t*t)));
  }
  float lipstick(vec3 p) {
    vec3 region=lipRegion(p);
    return smoothstep(-.035,.035,region.y)*(1.0-smoothstep(.98,1.02,region.x))
      *smoothstep(region.z,region.z+.12,p.z);
  }
  float rowanLidRidge(vec3 p) {
    if(rowanLids<.5) return 0.0;
    vec3 local=(p-blinkCenter(p))/blinkRadius;
    float radius=length(local.xy);
    if(radius<.7 || radius>1.7 || local.z<.15) return 0.0;
    float distance=(radius-1.12)/.15;
    float ridge=exp(-distance*distance);
    return .16*ridge*smoothstep(.15,.65,local.z)*(1.0-blinkAmount(p));
  }
`;

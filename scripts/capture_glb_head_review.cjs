const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const crypto = require("node:crypto");

const studyPath = process.argv[2], output = process.argv[3];
if (!studyPath || !output) throw new Error("Provide an existing study directory and a NEW capture directory.");
require("node:fs").mkdirSync(output, { recursive: false });
app.setPath("userData", path.join(output, "profile"));
app.setPath("sessionData", path.join(output, "profile"));
app.on("window-all-closed", () => {});
const deadline = setTimeout(async () => {
  await fs.writeFile(path.join(output, "failure.json"), JSON.stringify({ error: "Capture exceeded its five-minute deadline." }));
  app.exit(1);
}, 300000);
const capability = crypto.randomBytes(24).toString("hex");
const html = String.raw`<!doctype html><html><body style="margin:0"><canvas width="640" height="640"></canvas>
<script type="module">
import {mouthShape,sampleMouthOpening,WIDE_MOUTH_OPENING_CM} from "./facial-features.mjs";
let gl,program,positionBuffer,normalBuffer,triangles,mouth,meta,faces,groups,groupCount,mouthPairs,restOpening;
const mouthMeta={quantization:1,scale:1,center:[0,0,0]};
const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
const floats=async(file)=>new Float32Array(await (await fetch("./"+meta.id+"/"+file,{cache:"no-store"})).arrayBuffer());
window.setup=async(data)=>{
 meta=data;gl=document.querySelector("canvas").getContext("webgl2",{alpha:true,antialias:true,premultipliedAlpha:false});
 if(!gl)throw Error("WebGL2 unavailable");
 // Unrigged closed oral sheets need a bounded forward bias on the display-only cutout.
 const vs="#version 300 es\nin vec3 position,normal;uniform mat3 rotation;uniform bool erase;out vec3 p,n3;void main(){vec3 v=position;if(erase)v.z+=.55;p=rotation*((v-vec3(0,145,0))/14.0);n3=rotation*normal;gl_Position=vec4(p.xy,-p.z*.35,1.0);}";
 const frag="#version 300 es\nprecision highp float;in vec3 p,n3;uniform bool erase;out vec4 value;void main(){if(erase){value=vec4(0);return;}vec3 n=normalize(n3);if(!gl_FrontFacing)n=-n;float light=.32+.68*max(0.,dot(n,normalize(vec3(.3,.5,1.))));value=vec4(pow(vec3(.75,.72,.68)*light,vec3(1./2.2)),1);}";
 program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,frag));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 positionBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);
 const location=gl.getAttribLocation(program,"position");gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);
 normalBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer);
 const nl=gl.getAttribLocation(program,"normal");gl.enableVertexAttribArray(nl);gl.vertexAttribPointer(nl,3,gl.FLOAT,false,0,0);
 const dataBuffer=await (await fetch("./"+meta.id+"/triangles.bin")).arrayBuffer();
 faces=new Uint32Array(dataBuffer);
 triangles=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangles);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,faces,gl.STATIC_DRAW);
 const rest=await floats(meta.frames[0].file);
 const shared=new Map();groups=new Uint32Array(meta.vertices);
 for(let i=0;i<meta.vertices;i++){
  const key=[rest[i*3],rest[i*3+1],rest[i*3+2]].map(v=>Math.round(v*1e5)).join(",");
  if(!shared.has(key))shared.set(key,shared.size);groups[i]=shared.get(key);
 }
 groupCount=shared.size;
 const destination=meta.registration.heightCorrespondencesCm[3][1];
 const cy=meta.method==="native"?destination:140.20+.8*.65*(destination-140.15);
 const width=meta.method==="native"?({lyra:2.3,mira:2.4,neris:2.6}[meta.id]):2.65;
 const samples=[],center=[],corner=[];
 for(let i=0;i<rest.length;i+=3)if(Math.abs(rest[i]-.08)<width+.3&&Math.abs(rest[i+1]-cy)<.5&&rest[i+2]>0){
  samples.push(rest[i+2]);if(Math.abs(rest[i]-.08)<.6)center.push(rest[i+2]);if(Math.abs(rest[i]-.08)>width*.65)corner.push(rest[i+2]);
 }
 const percentile=(a,q)=>{if(!a.length)throw Error("Missing source mouth depth samples");a.sort((x,y)=>x-y);return a[Math.floor((a.length-1)*q)];};
 const profile={mouth:[.08,cy,width],upper:[cy,cy,cy,cy,cy],depth:[percentile(center,.8)-.25,percentile(corner,.8)-.25]};
 const {indices,pairs}=mouthShape(rest,mouthMeta,profile);
 mouthPairs=pairs;restOpening=sampleMouthOpening(rest,mouthMeta,pairs);
 meta.mouthTriangles=indices.length/3;
 mouth=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mouth);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
 gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);
 return {mouthTriangles:indices.length/3,mouthGuide:profile};
};
window.render=async(step)=>{
 const positions=await floats(step.file);
 if(positions.length!==meta.vertices*3)throw Error("Incomplete candidate pose");
 gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);gl.bufferData(gl.ARRAY_BUFFER,positions,gl.DYNAMIC_DRAW);
 const sums=new Float32Array(groupCount*3),normals=new Float32Array(positions.length);
 for(let i=0;i<faces.length;i+=3){
  const a=faces[i]*3,b=faces[i+1]*3,c=faces[i+2]*3;
  const ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2];
  const vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  for(let j=0;j<3;j++){const k=groups[faces[i+j]]*3;sums[k]+=nx;sums[k+1]+=ny;sums[k+2]+=nz;}
 }
 for(let i=0;i<groupCount;i++){const k=i*3,l=Math.hypot(sums[k],sums[k+1],sums[k+2])||1;sums[k]/=l;sums[k+1]/=l;sums[k+2]/=l;}
 for(let i=0;i<meta.vertices;i++)normals.set(sums.subarray(groups[i]*3,groups[i]*3+3),i*3);
 gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer);gl.bufferData(gl.ARRAY_BUFFER,normals,gl.DYNAMIC_DRAW);
 const a=step.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 gl.uniformMatrix3fv(gl.getUniformLocation(program,"rotation"),false,[c,0,-s,0,1,0,s,0,c]);
 gl.depthMask(true);gl.depthFunc(gl.LEQUAL);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.uniform1i(gl.getUniformLocation(program,"erase"),0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangles);
 gl.drawElements(gl.TRIANGLES,meta.triangles*3,gl.UNSIGNED_INT,0);
 const opening=sampleMouthOpening(positions,mouthMeta,mouthPairs)-restOpening;
 if(opening>=WIDE_MOUTH_OPENING_CM){
  gl.uniform1i(gl.getUniformLocation(program,"erase"),1);
  gl.depthMask(false);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-1);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mouth);gl.drawElements(gl.TRIANGLES,meta.mouthTriangles*3,gl.UNSIGNED_INT,0);
  gl.disable(gl.POLYGON_OFFSET_FILL);gl.depthMask(true);
 }
 gl.finish();
 if(gl.getError())throw Error("Candidate WebGL draw failed");
 return document.querySelector("canvas").toDataURL("image/png");
};
window.dispose=()=>gl.getExtension("WEBGL_lose_context")?.loseContext();
</script></body></html>`;

let server;
app.whenReady().then(async () => {
  const study = JSON.parse(await fs.readFile(path.join(studyPath, "study.json"), "utf8"));
  const allowed = new Map(), receipt = { candidates: [], sourceStudy: studyPath, audio: false };
  for (const candidate of study.candidates) {
    for (const file of new Set(["triangles.bin", ...candidate.frames.map(f => f.file)])) {
      allowed.set(candidate.id + "/" + file, path.join(studyPath, candidate.id, file));
    }
  }
  const features = await fs.readFile(path.join(__dirname, "..", "verona", "web", "facial-features.mjs"));
  server = http.createServer(async (req, res) => {
    try {
      const prefix = "/" + capability + "/";
      if (req.method !== "GET" || !req.url.startsWith(prefix)) { res.writeHead(404).end(); return; }
      const key = req.url.slice(prefix.length);
      res.setHeader("Cache-Control", "no-store");
      if (!key) { res.setHeader("Content-Type", "text/html"); res.end(html); }
      else if (key === "facial-features.mjs") { res.setHeader("Content-Type", "text/javascript"); res.end(features); }
      else if (allowed.has(key)) { res.setHeader("Content-Type", "application/octet-stream"); res.end(await fs.readFile(allowed.get(key))); }
      else res.writeHead(404).end();
    } catch (error) { res.writeHead(500).end(String(error)); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  for (const candidate of study.candidates) {
    const folder = path.join(output, candidate.id);
    await fs.mkdir(folder);
    const win = new BrowserWindow({ show: false, width: 640, height: 640,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false,
        offscreen: true, backgroundThrottling: false } });
    const errors = [];
    win.webContents.on("console-message", (_event, level, message) => { if (level >= 3) errors.push(message); });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/${capability}/`);
    const setup = await win.webContents.executeJavaScript(`setup(${JSON.stringify(candidate)})`);
    for (const [index, frame] of candidate.frames.entries()) {
      const png = await win.webContents.executeJavaScript(`render(${JSON.stringify(frame)})`);
      await fs.writeFile(path.join(folder, String(index).padStart(3, "0") + ".png"), Buffer.from(png.split(",")[1], "base64"));
    }
    if (errors.length) throw new Error(errors.join("\n"));
    await win.webContents.executeJavaScript("dispose()");
    win.destroy();
    receipt.candidates.push({ id: candidate.id, frames: candidate.frames.length, ...setup });
  }
  await fs.writeFile(path.join(output, "receipt.json"), JSON.stringify(receipt, null, 2));
  clearTimeout(deadline);server.close();app.quit();
}).catch(async error => {
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, "failure.json"), JSON.stringify({ error: error.stack }));
  app.exit(1);
});

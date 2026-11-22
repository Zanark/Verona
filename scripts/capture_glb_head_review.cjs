const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const crypto = require("node:crypto");

const studyPath = process.argv[2], output = process.argv[3];
const selected = process.argv[4]?.replace(/^--candidate=/,"");
if (process.argv.length > 5 || (process.argv[4] && (!process.argv[4].startsWith("--candidate=") || !selected))) throw new Error("Expected one nonempty --candidate=<id> option.");
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
import {mouthShape,sampleMouthOpening,WIDE_MOUTH_OPENING_CM,FACIAL_FEATURE_GLSL,facialProfile} from "./facial-features.mjs";
import {BLINK_GLSL} from "./blinking.mjs";
let gl,program,positionBuffer,normalBuffer,triangles,mouth,meta,faces,groups,groupCount,mouthPairs,restOpening;
const mouthMeta={quantization:1,scale:1,center:[0,0,0]};
const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
const floats=async(file)=>new Float32Array(await (await fetch("./"+meta.id+"/"+file,{cache:"no-store"})).arrayBuffer());
window.setup=async(data)=>{
 meta=data;gl=document.querySelector("canvas").getContext("webgl2",{alpha:true,antialias:true,premultipliedAlpha:false});
 if(!gl)throw Error("WebGL2 unavailable");
 // Unrigged closed oral sheets need a bounded forward bias on the display-only cutout.
 const vs=meta.colors?"#version 300 es\nin vec3 position,normal;in vec4 paint;uniform mat3 rotation;uniform vec3 viewCenter;uniform float viewScale;uniform bool erase;out vec3 p,n3,world;out vec4 pigment;void main(){vec3 v=position;world=v;pigment=paint;if(erase)v.z+=.55;p=rotation*((v-viewCenter)/viewScale);n3=rotation*normal;gl_Position=vec4(p.xy,-p.z*.35,1.0);}":
 "#version 300 es\nin vec3 position,normal;uniform mat3 rotation;uniform bool erase;out vec3 p,n3;void main(){vec3 v=position;if(erase)v.z+=.55;p=rotation*((v-vec3(0,145,0))/14.0);n3=rotation*normal;gl_Position=vec4(p.xy,-p.z*.35,1.0);}";
 const frag=meta.colors?"#version 300 es\nprecision highp float;in vec3 p,n3,world;in vec4 pigment;uniform bool erase,colored;uniform float eyeY,eyeRadius,cropY;out vec4 value;\n"+BLINK_GLSL+FACIAL_FEATURE_GLSL+"\nvoid main(){if(world.y<cropY)discard;if(erase){value=vec4(0);return;}if(pigment.a>.5&&blink>0.&&(blink>=.999||abs(world.y-eyeY)>eyeRadius*(1.-blink)))discard;vec3 n=normalize(n3);if(!gl_FrontFacing)n=-n;float diffuse=dot(n,normalize(vec3(.3,.5,1.)));float light=.32+.68*max(0.,diffuse);if(colored){vec3 color=pigment.rgb;float band=.88+.12*max(0.,diffuse);if(pigment.a==0.){vec3 r=pigment.xyz;color=vec3(.96,.79,.71);float blush=.25*exp(-pow((abs(r.x-.08)-4.1)/1.1,2.)-pow((r.y-144.)/.85,2.))*smoothstep(1.,3.,r.z);color=mix(color,vec3(.94,.46,.52),blush);color=mix(color,vec3(.86,.50,.56),lipstick(r));}else if(pigment.a<-.5)band=.68+.32*smoothstep(.15,.23,diffuse);else if(pigment.a>.5)band=1.;value=vec4(color*band,1);}else value=vec4(pow(vec3(.75,.72,.68)*light,vec3(1./2.2)),1);}":
 "#version 300 es\nprecision highp float;in vec3 p,n3;uniform bool erase;out vec4 value;void main(){if(erase){value=vec4(0);return;}vec3 n=normalize(n3);if(!gl_FrontFacing)n=-n;float light=.32+.68*max(0.,dot(n,normalize(vec3(.3,.5,1.))));value=vec4(pow(vec3(.75,.72,.68)*light,vec3(1./2.2)),1);}";
 program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,frag));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 positionBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);
 const location=gl.getAttribLocation(program,"position");gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);
 normalBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer);
 const nl=gl.getAttribLocation(program,"normal");gl.enableVertexAttribArray(nl);gl.vertexAttribPointer(nl,3,gl.FLOAT,false,0,0);
 const cl=gl.getAttribLocation(program,"paint");
 if(meta.colors){
  const colors=await floats(meta.colors);
  if(colors.length!==meta.vertices*4||!colors.every(Number.isFinite))throw Error("Incomplete candidate colors");
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,colors,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(cl);gl.vertexAttribPointer(cl,4,gl.FLOAT,false,0,0);
 }else if(cl>=0){gl.disableVertexAttribArray(cl);gl.vertexAttrib4f(cl,0,0,0,0);}
 gl.uniform1i(gl.getUniformLocation(program,"colored"),Boolean(meta.colors)&&meta.toon!==false);
 gl.uniform3fv(gl.getUniformLocation(program,"viewCenter"),meta.viewCenter??[0,145,0]);
 gl.uniform1f(gl.getUniformLocation(program,"viewScale"),meta.viewScale??14);
 gl.uniform1f(gl.getUniformLocation(program,"cropY"),meta.cropY??-1000);
 gl.uniform1f(gl.getUniformLocation(program,"eyeY"),meta.eyeY??147.5);
 gl.uniform1f(gl.getUniformLocation(program,"eyeRadius"),meta.eyeRadius??1.32);
 const lip=facialProfile("claire");
 gl.uniform3fv(gl.getUniformLocation(program,"lipMouth"),lip.mouth);
 gl.uniform2fv(gl.getUniformLocation(program,"lipDepth"),lip.depth);
 gl.uniform1fv(gl.getUniformLocation(program,"lipUpper"),lip.upper);
 gl.uniform1fv(gl.getUniformLocation(program,"lipLower"),lip.lower);
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
 const destination=meta.mouthProfile?.mouth[1]??meta.registration.heightCorrespondencesCm[3][1];
 const cy=meta.method==="native"?destination:140.20+.8*.65*(destination-140.15);
 const width=meta.method==="native"?({lyra:2.3,mira:2.4,neris:2.6}[meta.id]):2.65;
 const samples=[],center=[],corner=[];
 for(let i=0;i<rest.length;i+=3)if(Math.abs(rest[i]-.08)<width+.3&&Math.abs(rest[i+1]-cy)<.5&&rest[i+2]>0){
  samples.push(rest[i+2]);if(Math.abs(rest[i]-.08)<.6)center.push(rest[i+2]);if(Math.abs(rest[i]-.08)>width*.65)corner.push(rest[i+2]);
 }
 const percentile=(a,q)=>{if(!a.length)throw Error("Missing source mouth depth samples");a.sort((x,y)=>x-y);return a[Math.floor((a.length-1)*q)];};
 const profile=meta.mouthProfile??{mouth:[.08,cy,width],upper:[cy,cy,cy,cy,cy],depth:[percentile(center,.8)-.25,percentile(corner,.8)-.25]};
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
 gl.uniform1f(gl.getUniformLocation(program,"blink"),step.blink??0);
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
 return {png:document.querySelector("canvas").toDataURL("image/png"),opening,wideCutout:opening>=WIDE_MOUTH_OPENING_CM};
};
window.dispose=()=>gl.getExtension("WEBGL_lose_context")?.loseContext();
</script></body></html>`;

let server;
app.whenReady().then(async () => {
  const study = JSON.parse(await fs.readFile(path.join(studyPath, "study.json"), "utf8"));
  const candidates = selected ? study.candidates.filter(c => c.id === selected) : study.candidates;
  if (!candidates.length) throw new Error("Requested capture candidate is absent.");
  const allowed = new Map(), receipt = { candidates: [], sourceStudy: studyPath, audio: false };
  for (const candidate of candidates) {
    for (const file of new Set(["triangles.bin", ...(candidate.colors?[candidate.colors]:[]), ...candidate.frames.map(f => f.file)])) {
      allowed.set(candidate.id + "/" + file, path.join(studyPath, candidate.id, file));
    }
  }
  const features = await fs.readFile(path.join(__dirname, "..", "verona", "web", "facial-features.mjs"));
  const blinking = await fs.readFile(path.join(__dirname, "..", "verona", "web", "blinking.mjs"));
  server = http.createServer(async (req, res) => {
    try {
      const prefix = "/" + capability + "/";
      if (req.method !== "GET" || !req.url.startsWith(prefix)) { res.writeHead(404).end(); return; }
      const key = req.url.slice(prefix.length);
      res.setHeader("Cache-Control", "no-store");
      if (!key) { res.setHeader("Content-Type", "text/html"); res.end(html); }
      else if (key === "facial-features.mjs") { res.setHeader("Content-Type", "text/javascript"); res.end(features); }
      else if (key === "blinking.mjs") { res.setHeader("Content-Type", "text/javascript"); res.end(blinking); }
      else if (allowed.has(key)) { res.setHeader("Content-Type", "application/octet-stream"); res.end(await fs.readFile(allowed.get(key))); }
      else res.writeHead(404).end();
    } catch (error) { res.writeHead(500).end(String(error)); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  for (const candidate of candidates) {
    const folder = path.join(output, candidate.id);
    await fs.mkdir(folder);
    const win = new BrowserWindow({ show: false, width: 640, height: 640,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false,
        offscreen: true, backgroundThrottling: false } });
    const errors = [];
    win.webContents.on("console-message", (_event, level, message) => { if (level >= 3) errors.push(message); });
    await win.loadURL(`http://127.0.0.1:${server.address().port}/${capability}/`);
    const setup = await win.webContents.executeJavaScript(`setup(${JSON.stringify(candidate)})`);
    const openingSamples=[];
    for (const [index, frame] of candidate.frames.entries()) {
      const {png,opening,wideCutout} = await win.webContents.executeJavaScript(`render(${JSON.stringify(frame)})`);
      await fs.writeFile(path.join(folder, String(index).padStart(3, "0") + ".png"), Buffer.from(png.split(",")[1], "base64"));
      openingSamples.push({frame:index,opening,wideCutout});
    }
    if (errors.length) throw new Error(errors.join("\n"));
    await win.webContents.executeJavaScript("dispose()");
    win.destroy();
    receipt.candidates.push({ id: candidate.id, frames: candidate.frames.length, ...setup, openingSamples });
  }
  await fs.writeFile(path.join(output, "receipt.json"), JSON.stringify(receipt, null, 2));
  clearTimeout(deadline);server.close();app.quit();
}).catch(async error => {
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, "failure.json"), JSON.stringify({ error: error.stack }));
  app.exit(1);
});

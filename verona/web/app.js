const $ = (id) => document.getElementById(id);
const audio = $("audio");
const controls = ["play", "restart", "seek"];
const settingNames = ["pitch", "rate", "bass", "treble"];
const editing = ["generate", "preview", "reset-voice", "text", "voice", "expression", "intensity",
  ...settingNames, "emphasis"];
const preview = $("voice-preview");
let token = window.location.hash.slice(1);
let renderer, clip, audioUrl, previewUrl, defaultVoice, raf = 0, busy = false;

function failure(error) {
  $("error").textContent = error instanceof Error ? error.message : String(error);
  $("error").hidden = false;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      cache: "no-store",
      headers: { "X-Verona-Token": token || "", ...options.headers },
    });
  } catch {
    throw new Error("Cannot reach local Verona. Restart Verona.cmd, then open its new local URL.");
  }
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || `Local request failed (${response.status}).`);
  }
  return response;
}

function surfaceNormals(positions, triangles, offset = 0, count = positions.length / 3) {
  const normals = new Float32Array(count * 3);
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i] * 3, b = triangles[i + 1] * 3, c = triangles[i + 2] * 3;
    const x = positions[offset + b] - positions[offset + a];
    const y = positions[offset + b + 1] - positions[offset + a + 1];
    const z = positions[offset + b + 2] - positions[offset + a + 2];
    const u = positions[offset + c] - positions[offset + a];
    const v = positions[offset + c + 1] - positions[offset + a + 1];
    const w = positions[offset + c + 2] - positions[offset + a + 2];
    const nx = y * w - z * v, ny = z * u - x * w, nz = x * v - y * u;
    for (let j = 0; j < 3; j++) {
      const index = triangles[i + j] * 3;
      normals[index] += nx; normals[index + 1] += ny; normals[index + 2] += nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= length; normals[i + 1] /= length; normals[i + 2] /= length;
  }
  return normals;
}

class FaceRenderer {
  constructor(canvas, meta, binary) {
    this.canvas = canvas;
    this.meta = meta;
    this.frames = 0;
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: false });
    if (!gl) throw new Error("WebGL2 is unavailable. Use a current Edge or Chrome with graphics enabled.");
    this.gl = gl;
    const vertex = `#version 300 es
      in vec3 positionA;
      in vec3 positionB;
      in vec3 normalA;
      in vec3 normalB;
      in vec3 restPosition;
      uniform float blend, quantization, aspect, yaw, zoom, pointSize;
      uniform vec3 center;
      uniform float scale;
      out vec3 viewNormal, rest;
      void main() {
        vec3 p = mix(positionA, positionB, blend) / quantization;
        mat3 rotation = mat3(cos(yaw),0.0,-sin(yaw), 0.0,1.0,0.0, sin(yaw),0.0,cos(yaw));
        p = rotation * p;
        gl_Position = vec4(p.x * zoom / aspect, p.y * zoom, -p.z * 0.35, 1.0);
        gl_PointSize = pointSize;
        viewNormal = rotation * mix(normalA, normalB, blend);
        rest = restPosition / quantization * scale + center;
      }`;
    const fragment = `#version 300 es
      precision highp float;
      uniform vec3 color;
      uniform bool points;
      uniform int material, pass;
      in vec3 viewNormal, rest;
      out vec4 outputColor;
      float square(float value) { return value*value; }
      void main() {
        if (points && distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;
        vec3 n = normalize(viewNormal);
        vec3 key = normalize(vec3(-0.55, 0.65, 1.5));
        float diffuse = clamp((dot(n, key)+0.22)/1.22,0.0,1.0);
        float rim = pow(1.0 - abs(n.z), 3.0);
        float fill = max(dot(n, normalize(vec3(0.9,0.15,0.6))),0.0);
        if (pass == 1) {
          float facing = smoothstep(-0.05,0.55,n.z);
          outputColor = vec4(color * (0.65 + diffuse * 0.35), facing * (material==1?0.12:0.105));
          return;
        }
        vec3 base = color;
        float polish = 0.10;
        if (material == 0) {
          float x = abs(rest.x - 0.08);
          float lipCenter = 140.15 - 0.10 * square(x / 2.5);
          float lip = (1.0-smoothstep(0.70,1.0,square(x/2.65)+square((rest.y-lipCenter)/0.70)))
            * smoothstep(2.6,3.2,rest.z);
          base = mix(base,vec3(0.29,0.038,0.058),lip * 0.94);
          polish += lip*0.25;
          float blush = exp(-square((x-3.9)/1.7)-square((rest.y-144.4)/1.6))
            * smoothstep(1.5,2.8,rest.z);
          base = mix(base,vec3(0.47,0.17,0.13),blush*0.20);
          float cavity = (1.0-smoothstep(0.65,1.0,square(x/2.3)+square((rest.y-140.1)/0.62)))
            * (1.0-smoothstep(3.0,3.35,rest.z));
          base = mix(base,vec3(0.008,0.003,0.006),cavity);
          float browY = 149.25 + 0.46 * exp(-square((x-3.65)/1.4));
          float browWidth=mix(0.15,0.065,smoothstep(2.5,4.9,x));
          float brow = (1.0-smoothstep(browWidth,browWidth+0.07,abs(rest.y-browY)))
            * smoothstep(1.3,1.8,x)*(1.0-smoothstep(4.5,4.9,x))*smoothstep(1.6,2.5,rest.z);
          base = mix(base,vec3(0.040,0.015,0.009),brow*0.92);
          float eyeX=(x-3.02)/1.65;
          float upper=147.53+0.58*sqrt(max(0.0,1.0-eyeX*eyeX))+0.075*eyeX;
          float liner=(1.0-smoothstep(0.035,0.10,abs(rest.y-upper)))
            *smoothstep(1.25,1.6,x)*(1.0-smoothstep(4.5,4.85,x))
            *smoothstep(2.1,2.8,rest.z);
          float shadow=exp(-square((rest.y-upper-0.27)/0.31))
            *smoothstep(1.4,1.9,x)*(1.0-smoothstep(4.5,4.9,x))*smoothstep(2.0,2.8,rest.z);
          base=mix(base,vec3(0.20,0.077,0.052),shadow*0.24);
          base=mix(base,vec3(0.018,0.006,0.007),liner*0.86);
        } else if (material == 1) {
          float ribbon=0.5+0.5*sin(rest.y*1.65+rest.x*0.28+rest.z*0.42);
          float fiber=pow(0.5+0.5*cos(atan(rest.x+1.5,rest.z+5.7)*150.0+rest.y*0.18),8.0);
          base*=0.73+0.17*ribbon+0.24*fiber;
          float partX=-1.65+0.13*(rest.z-2.0);
          float part=(1.0-smoothstep(0.045,0.10,abs(rest.x-partX)))
            *smoothstep(153.7,155.0,rest.y)*smoothstep(-6.0,-4.5,rest.z);
          base=mix(base,vec3(0.21,0.095,0.055),part*0.75);
          polish=0.30+0.08*ribbon;
        } else if (material == 2) {
          vec3 eyeCenter = rest.x < 0.0 ? vec3(-2.9485,147.5517,2.2364) : vec3(3.1021,147.4944,2.2830);
          vec3 local = rest-eyeCenter;
          float radius = length(local.xy-vec2(0.0,0.08));
          float front = smoothstep(0.9,1.2,local.z);
          float iris = (1.0-smoothstep(0.53,0.59,radius))*front;
          float pupil = (1.0-smoothstep(0.20,0.25,radius))*front;
          vec3 hazel=mix(vec3(0.025,0.019,0.008),vec3(0.21,0.14,0.035),
            1.0-smoothstep(0.28,0.56,radius));
          hazel*=0.85+0.15*sin(atan(local.y,local.x)*62.0);
          base = mix(base,hazel,iris);
          base = mix(base,vec3(0.003,0.002,0.002),pupil);
          polish=0.7;
        }
        float specular = pow(max(dot(n,normalize(key+vec3(0,0,1))),0.0),material==2?80.0:36.0);
        vec3 lit = base * (0.23 + 0.62*diffuse + 0.18*fill) + vec3(0.065,0.040,0.027)*rim;
        lit += vec3(0.88,0.73,0.57)*specular*polish;
        outputColor = vec4(pow(max(lit,vec3(0.0)),vec3(1.0/2.2)),1.0);
      }`;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`Face shader failed: ${gl.getShaderInfoLog(shader)}`);
      }
      return shader;
    };
    const program = gl.createProgram();
    const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, fragment)];
    for (const shader of shaders) gl.attachShader(program, shader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Face renderer failed: ${gl.getProgramInfoLog(program)}`);
    }
    for (const shader of shaders) gl.deleteShader(shader);
    gl.useProgram(program);
    this.program = program;
    this.attributes = Object.fromEntries(
      ["positionA", "positionB", "normalA", "normalB", "restPosition"].map(name => [name,gl.getAttribLocation(program,name)]),
    );
    this.uniforms = Object.fromEntries(
      ["blend", "quantization", "aspect", "yaw", "zoom", "pointSize", "color", "points", "center", "scale", "material", "pass"]
        .map((name) => [name, gl.getUniformLocation(program, name)]),
    );
    if (binary.byteLength !== meta.bytes || meta.edgeOffset % 4 || meta.triangleOffset % 4) {
      throw new Error("Face mesh byte count/alignment does not match its contract.");
    }
    this.neutralData = new Int16Array(binary, 0, meta.vertices * 3);
    this.triangleData = new Uint32Array(binary, meta.triangleOffset, meta.triangles * 3);
    this.neutral = this.buffer(gl.ARRAY_BUFFER, this.neutralData);
    this.neutralNormals = this.buffer(gl.ARRAY_BUFFER, surfaceNormals(this.neutralData,this.triangleData));
    this.normalSlots = [0,1].map(() => ({frame:-1,buffer:gl.createBuffer()}));
    this.edges = this.buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(binary, meta.edgeOffset, meta.edges * 2));
    this.triangles = this.buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(binary, meta.triangleOffset, meta.triangles * 3));
    const hair = meta.hair;
    this.hair = {
      positions: this.buffer(gl.ARRAY_BUFFER, new Int16Array(binary, hair.positionOffset, hair.vertices * 3)),
      edges: this.buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(binary, hair.edgeOffset, hair.edges * 2)),
      triangles: this.buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(binary, hair.triangleOffset, hair.triangles * 3)),
    };
    const hairData = new Int16Array(binary,hair.positionOffset,hair.vertices*3);
    this.hair.normals = this.buffer(gl.ARRAY_BUFFER,surfaceNormals(hairData,
      new Uint32Array(binary,hair.triangleOffset,hair.triangles*3)));
    const eyes = meta.eyes;
    const eyeData = new Int16Array(binary,eyes.positionOffset,eyes.vertices*3);
    this.eyes = {
      positions:this.buffer(gl.ARRAY_BUFFER,eyeData),
      triangles:this.buffer(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(binary,eyes.triangleOffset,eyes.triangles*3)),
      normals:this.buffer(gl.ARRAY_BUFFER,surfaceNormals(eyeData,new Uint32Array(binary,eyes.triangleOffset,eyes.triangles*3))),
    };
    this.motion = null;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      audio.pause();
      preview.pause();
      failure(new Error("Graphics context was lost. Reload Verona to rebuild the face."));
    });
    canvas.addEventListener("webglcontextrestored", () => {
      failure(new Error("Graphics returned; reload Verona to restore verified buffers."));
    });
  }

  buffer(target, data) {
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(target, buffer);
    this.gl.bufferData(target, data, this.gl.STATIC_DRAW);
    return buffer;
  }

  setClip(binary, metadata) {
    const expected = metadata.frames * this.meta.vertices * 3 * 2;
    if (binary.byteLength !== expected || metadata.vertices !== this.meta.vertices
        || metadata.quantization !== this.meta.quantization || metadata.fps !== 30) {
      throw new Error("Face motion does not match the loaded mesh/audio clock.");
    }
    this.clearClip();
    this.motion = this.buffer(this.gl.ARRAY_BUFFER, new Int16Array(binary));
    this.motionData = new Int16Array(binary);
    this.frames = metadata.frames;
  }

  clearClip() {
    if (this.motion) this.gl.deleteBuffer(this.motion);
    this.motion = null;
    this.frames = 0;
    this.motionData = null;
    for (const slot of this.normalSlots) slot.frame = -1;
  }

  attribute(name, buffer, type, offset = 0) {
    const gl=this.gl, location=this.attributes[name];
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location,3,type,false,0,offset);
  }

  normalBuffer(frame) {
    if (!this.motion) return this.neutralNormals;
    let slot=this.normalSlots.find(item=>item.frame===frame);
    if (!slot) {
      slot=this.normalSlots[frame%2];
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER,slot.buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER,
        surfaceNormals(this.motionData,this.triangleData,frame*this.meta.vertices*3,this.meta.vertices),
        this.gl.DYNAMIC_DRAW);
      slot.frame=frame;
    }
    return slot.buffer;
  }

  staticSurface(surface) {
    const gl=this.gl;
    for (const name of ["positionA","positionB","restPosition"]) this.attribute(name,surface.positions,gl.SHORT);
    for (const name of ["normalA","normalB"]) this.attribute(name,surface.normals,gl.FLOAT);
    gl.uniform1f(this.uniforms.blend,0);
  }

  draw(seconds) {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.016, 0.025, 0.038, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    const frame = this.frames ? Math.min(this.frames - 1, Math.max(0, seconds * 30)) : 0;
    const left = Math.floor(frame);
    const right = this.frames ? Math.min(this.frames - 1, left + 1) : 0;
    this.attribute("positionA",this.motion||this.neutral,gl.SHORT,this.motion?left*this.meta.vertices*6:0);
    this.attribute("positionB",this.motion||this.neutral,gl.SHORT,this.motion?right*this.meta.vertices*6:0);
    this.attribute("restPosition",this.neutral,gl.SHORT);
    this.attribute("normalA",this.normalBuffer(left),gl.FLOAT);
    this.attribute("normalB",this.normalBuffer(right),gl.FLOAT);
    const u = this.uniforms;
    gl.uniform1f(u.blend, frame - left);
    gl.uniform1f(u.quantization, this.meta.quantization);
    gl.uniform3fv(u.center,this.meta.center);
    gl.uniform1f(u.scale,this.meta.scale);
    gl.uniform1f(u.aspect, width / height);
    gl.uniform1f(u.yaw, Number($("yaw").value));
    gl.uniform1f(u.zoom, Number($("zoom").value) * 0.91);
    gl.uniform1f(u.pointSize, 1.15 * ratio);
    gl.uniform1i(u.material,0);
    gl.uniform1i(u.pass,0);
    gl.uniform1i(u.points, 0);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);
    gl.uniform3f(u.color, 0.49, 0.275, 0.195);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triangles);
    gl.drawElements(gl.TRIANGLES, this.meta.triangles * 3, gl.UNSIGNED_INT, 0);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    if ($("edges").checked) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1i(u.pass,1);
      gl.uniform3f(u.color, 0.35, 0.18, 0.13);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.edges);
      gl.drawElements(gl.LINES, this.meta.edges * 2, gl.UNSIGNED_INT, 0);
    }
    if ($("points").checked) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1i(u.pass,1);
      gl.uniform1i(u.points, 1);
      gl.uniform3f(u.color, 0.59, 0.98, 0.85);
      gl.drawArrays(gl.POINTS, 0, this.meta.vertices);
    }
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.uniform1i(u.pass,0);
    gl.uniform1i(u.points,0);
    gl.uniform1i(u.material,2);
    this.staticSurface(this.eyes);
    gl.uniform3f(u.color,0.72,0.68,0.58);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.eyes.triangles);
    gl.drawElements(gl.TRIANGLES,this.meta.eyes.triangles*3,gl.UNSIGNED_INT,0);
    if ($("hair").checked) {
      this.staticSurface(this.hair);
      gl.uniform1i(u.points, 0);
      gl.uniform1i(u.material,1);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.uniform3f(u.color, 0.052, 0.016, 0.008);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.hair.triangles);
      gl.drawElements(gl.TRIANGLES, this.meta.hair.triangles * 3, gl.UNSIGNED_INT, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1i(u.pass,1);
      gl.uniform3f(u.color, 0.31, 0.13, 0.048);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.hair.edges);
      gl.drawElements(gl.LINES, this.meta.hair.edges * 2, gl.UNSIGNED_INT, 0);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }
    $("frame").textContent = this.frames ? `FRAME ${left + 1} / ${this.frames}` : "NEUTRAL";
  }
}

function draw() {
  if (renderer) renderer.draw(audio.currentTime);
  const duration = clip ? clip.duration : 0;
  $("time").textContent = `${audio.currentTime.toFixed(2)} / ${duration.toFixed(2)} s`;
  $("seek").value = String(audio.currentTime);
}

function animate() {
  draw();
  if (!audio.paused && !audio.ended) raf = requestAnimationFrame(animate);
}

function clearClip() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;
  clip = null;
  renderer.clearClip();
  for (const id of controls) $(id).disabled = true;
  $("spoken").textContent = "No generated speech yet.";
  $("details").textContent = "";
  delete $("details").dataset.readySeconds;
  draw();
}

function voiceSettings() {
  return Object.fromEntries([...settingNames.map((name) => [name, Number($(name).value)]),
    ["emphasis", $("emphasis").value]]);
}

function clearPreview() {
  preview.pause();
  preview.removeAttribute("src");
  preview.load();
  preview.hidden = true;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
}

function refreshSettings() {
  for (const name of settingNames) {
    const value = Number($(name).value);
    const unit = name === "pitch" ? " st" : name === "rate" ? "" : " dB";
    $(`${name}-value`).textContent = `${value > 0 ? "+" : ""}${value}${unit}`;
  }
  clearPreview();
}

async function previewVoice() {
  if (busy) return;
  $("error").hidden = true;
  const text = $("text").value.trim();
  if (!text || text.length > 280) { failure(new Error("Enter 1-280 characters of plain text.")); return; }
  busy = true;
  audio.pause();
  clearPreview();
  for (const id of editing) $(id).disabled = true;
  $("status").textContent = "Synthesizing local voice preview without neural face generation.";
  try {
    const response = await request("/api/preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: $("voice").value, voiceSettings: voiceSettings(),
        expression: $("expression").value, intensity: Number($("intensity").value) }),
    });
    previewUrl = URL.createObjectURL(await response.blob());
    preview.src = previewUrl;
    preview.hidden = false;
    $("status").textContent = "Voice preview ready. Press its Play control; Generate face applies this voice to the mesh.";
  } catch (error) {
    $("status").textContent = "Voice preview failed. Correct the settings, then retry.";
    failure(error);
  } finally {
    busy = false;
    for (const id of editing) $(id).disabled = false;
  }
}

async function generate() {
  if (busy) return;
  $("error").hidden = true;
  const text = $("text").value.trim();
  if (!text || text.length > 280) {
    failure(new Error("Enter 1-280 characters of plain text."));
    return;
  }
  busy = true;
  clearPreview();
  clearClip();
  const started = performance.now();
  for (const id of editing) $(id).disabled = true;
  $("status").textContent = "Generating local speech and complete neural motion. No audio is uploaded.";
  try {
    const response = await request("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text, voice: $("voice").value, expression: $("expression").value,
        intensity: Number($("intensity").value),
        voiceSettings: voiceSettings(),
      }),
    });
    const metadata = await response.json();
    const [motion, voice] = await Promise.all([
      request(`/api/clip/${metadata.id}/motion`).then((r) => r.arrayBuffer()),
      request(`/api/clip/${metadata.id}/audio`).then((r) => r.arrayBuffer()),
    ]);
    renderer.setClip(motion, metadata);
    audioUrl = URL.createObjectURL(new Blob([voice], { type: "audio/wav" }));
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error("Local audio did not load within 15 seconds.")), 15000);
      const finish = (error) => {
        clearTimeout(timeout);
        audio.removeEventListener("loadedmetadata", loaded);
        audio.removeEventListener("error", failed);
        error ? reject(error) : resolve();
      };
      const loaded = () => finish();
      const failed = () => finish(new Error("The browser could not decode the local speech WAV."));
      audio.addEventListener("loadedmetadata", loaded, { once: true });
      audio.addEventListener("error", failed, { once: true });
      audio.src = audioUrl;
      audio.load();
    });
    if (!Number.isFinite(audio.duration) || Math.abs(audio.duration - metadata.duration) > 0.01) {
      throw new Error("Loaded audio duration does not match its face timeline.");
    }
    clip = metadata;
    const readySeconds = (performance.now() - started) / 1000;
    $("details").dataset.readySeconds = String(readySeconds);
    $("seek").max = String(clip.duration);
    for (const id of controls) $(id).disabled = false;
    $("spoken").textContent = text;
    const settings = metadata.voiceSettings;
    $("details").textContent = `${metadata.voice} | pitch ${settings.pitch} st, speed ${settings.rate}, `
      + `bass ${settings.bass} dB, treble ${settings.treble} dB, ${settings.emphasis} emphasis | `
      + `${metadata.duration.toFixed(2)} s | ${metadata.frames} frames | `
      + `${metadata.cacheHit ? "reused complete clip" : metadata.speechCacheHit ? "reused speech" : "new speech"} | `
      + `${readySeconds.toFixed(2)} s ready (${metadata.requestSeconds.toFixed(2)} s server; excludes startup)`;
    $("status").textContent = "Ready. Press Play; the mesh follows the audio clock.";
    draw();
  } catch (error) {
    clearClip();
    $("status").textContent = "Generation failed. Correct the input or check the local terminal, then retry.";
    failure(error);
  } finally {
    busy = false;
    for (const id of editing) $(id).disabled = false;
  }
}

$("generate").addEventListener("click", generate);
$("preview").addEventListener("click", previewVoice);
$("reset-voice").addEventListener("click", () => {
  $("voice").value = defaultVoice;
  for (const name of settingNames) $(name).value = "0";
  $("emphasis").value = "none";
  refreshSettings();
});
for (const name of settingNames) $(name).addEventListener("input", refreshSettings);
for (const id of ["text", "voice", "emphasis"]) $(id).addEventListener("input", clearPreview);
preview.addEventListener("play", () => audio.pause());
$("play").addEventListener("click", async () => {
  $("error").hidden = true;
  if (!clip) return;
  preview.pause();
  if (!audio.paused) { audio.pause(); return; }
  if (audio.ended) audio.currentTime = 0;
  try { await audio.play(); } catch (error) { failure(error); }
});
$("restart").addEventListener("click", () => {
  audio.pause();
  audio.currentTime = 0;
  draw();
});
$("seek").addEventListener("input", () => {
  audio.currentTime = Number($("seek").value);
  draw();
});
$("volume").addEventListener("input", () => { audio.volume = preview.volume = Number($("volume").value); });
$("intensity").addEventListener("input", () => { $("strength").textContent = Number($("intensity").value).toFixed(2); });
for (const id of ["edges", "points", "hair", "yaw", "zoom"]) $(id).addEventListener("input", draw);
for (const button of document.querySelectorAll("[data-example]")) {
  button.addEventListener("click", () => {
    if (!busy) { $("text").value = button.dataset.example; clearPreview(); $("text").focus(); }
  });
}
audio.volume = preview.volume = Number($("volume").value);
audio.addEventListener("play", () => {
  cancelAnimationFrame(raf);
  $("play").textContent = "Pause";
  animate();
});
audio.addEventListener("pause", () => {
  cancelAnimationFrame(raf);
  $("play").textContent = "Play";
  draw();
});
audio.addEventListener("seeked", draw);
audio.addEventListener("ended", () => { $("play").textContent = "Play"; draw(); });
audio.addEventListener("error", () => {
  if (clip) { audio.pause(); failure(new Error("Speech playback failed. Generate the clip again.")); }
});
window.addEventListener("pagehide", (event) => {
  audio.pause();
  preview.pause();
  if (!event.persisted && audioUrl) URL.revokeObjectURL(audioUrl);
  if (!event.persisted && previewUrl) URL.revokeObjectURL(previewUrl);
});

try {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new Error("Open the full local URL printed by the Verona terminal, including its #session part.");
  }
  const session = await (await request("/api/session")).json();
  for (const voice of session.voices) {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.culture})`;
    $("voice").append(option);
  }
  defaultVoice = session.defaultVoice;
  $("voice").value = defaultVoice;
  $("voice-notice").textContent = defaultVoice === "Microsoft Hazel Desktop"
    ? "Default: Hazel, installed locally." : `Hazel is not installed. Using ${defaultVoice}; choose another installed voice if preferred.`;
  const binary = await (await request("/api/mesh")).arrayBuffer();
  renderer = new FaceRenderer($("face"), session.mesh, binary);
  new ResizeObserver(draw).observe($("face"));
  $("voice").disabled = false;
  $("generate").disabled = false;
  $("preview").disabled = false;
  $("reset-voice").disabled = false;
  $("status").textContent = `Ready. Verona styling / ${session.mesh.identity} motion; ${session.mesh.vertices.toLocaleString()} connected face points.`;
  draw();
} catch (error) {
  $("status").textContent = "The local face could not start.";
  failure(error);
}

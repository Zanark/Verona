const $ = (id) => document.getElementById(id);
const audio = $("audio");
const controls = ["play", "restart", "seek"];
let token = window.location.hash.slice(1);
let renderer, clip, audioUrl, raf = 0, busy = false;

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
      uniform float blend, quantization, aspect, yaw, zoom, pointSize;
      out float depth;
      void main() {
        vec3 p = mix(positionA, positionB, blend) / quantization;
        p = vec3(cos(yaw)*p.x + sin(yaw)*p.z, p.y, -sin(yaw)*p.x + cos(yaw)*p.z);
        gl_Position = vec4(p.x * zoom / aspect, p.y * zoom, -p.z * 0.35, 1.0);
        gl_PointSize = pointSize;
        depth = clamp((p.z + 1.0) * 0.5, 0.0, 1.0);
      }`;
    const fragment = `#version 300 es
      precision highp float;
      uniform vec3 color;
      uniform bool points;
      in float depth;
      out vec4 outputColor;
      void main() {
        if (points && distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;
        outputColor = vec4(color * (0.50 + depth * 0.50), 1.0);
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
    this.attributes = ["positionA", "positionB"].map((name) => gl.getAttribLocation(program, name));
    this.uniforms = Object.fromEntries(
      ["blend", "quantization", "aspect", "yaw", "zoom", "pointSize", "color", "points"]
        .map((name) => [name, gl.getUniformLocation(program, name)]),
    );
    if (binary.byteLength !== meta.bytes || meta.edgeOffset % 4 || meta.triangleOffset % 4) {
      throw new Error("Face mesh byte count/alignment does not match its contract.");
    }
    this.neutral = this.buffer(gl.ARRAY_BUFFER, new Int16Array(binary, 0, meta.vertices * 3));
    this.edges = this.buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(binary, meta.edgeOffset, meta.edges * 2));
    this.triangles = this.buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(binary, meta.triangleOffset, meta.triangles * 3));
    this.motion = null;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      audio.pause();
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
    this.frames = metadata.frames;
  }

  clearClip() {
    if (this.motion) this.gl.deleteBuffer(this.motion);
    this.motion = null;
    this.frames = 0;
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
    gl.clearColor(0.02, 0.059, 0.09, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    const frame = this.frames ? Math.min(this.frames - 1, Math.max(0, seconds * 30)) : 0;
    const left = Math.floor(frame);
    const right = this.frames ? Math.min(this.frames - 1, left + 1) : 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.motion || this.neutral);
    for (const [i, location] of this.attributes.entries()) {
      gl.enableVertexAttribArray(location);
      const offset = this.motion ? (i ? right : left) * this.meta.vertices * 6 : 0;
      gl.vertexAttribPointer(location, 3, gl.SHORT, false, 0, offset);
    }
    const u = this.uniforms;
    gl.uniform1f(u.blend, frame - left);
    gl.uniform1f(u.quantization, this.meta.quantization);
    gl.uniform1f(u.aspect, width / height);
    gl.uniform1f(u.yaw, Number($("yaw").value));
    gl.uniform1f(u.zoom, Number($("zoom").value) * 0.91);
    gl.uniform1f(u.pointSize, 1.7 * ratio);
    gl.uniform1i(u.points, 0);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);
    gl.uniform3f(u.color, 0.025, 0.07, 0.10);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triangles);
    gl.drawElements(gl.TRIANGLES, this.meta.triangles * 3, gl.UNSIGNED_INT, 0);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    if ($("edges").checked) {
      gl.uniform3f(u.color, 0.20, 0.68, 0.66);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.edges);
      gl.drawElements(gl.LINES, this.meta.edges * 2, gl.UNSIGNED_INT, 0);
    }
    if ($("points").checked) {
      gl.uniform1i(u.points, 1);
      gl.uniform3f(u.color, 0.59, 0.98, 0.85);
      gl.drawArrays(gl.POINTS, 0, this.meta.vertices);
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
  draw();
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
  clearClip();
  for (const id of ["generate", "text", "voice", "expression", "intensity"]) $(id).disabled = true;
  $("status").textContent = "Generating local speech and complete neural motion. No audio is uploaded.";
  try {
    const response = await request("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text, voice: $("voice").value, expression: $("expression").value,
        intensity: Number($("intensity").value),
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
    $("seek").max = String(clip.duration);
    for (const id of controls) $(id).disabled = false;
    $("spoken").textContent = text;
    $("details").textContent = `${metadata.voice} | ${metadata.duration.toFixed(2)} s | `
      + `${metadata.frames} frames | ${metadata.generationSeconds.toFixed(2)} s motion generation `
      + `(excludes voice synthesis/startup)`;
    $("status").textContent = "Ready. Press Play; the mesh follows the audio clock.";
    draw();
  } catch (error) {
    clearClip();
    $("status").textContent = "Generation failed. Correct the input or check the local terminal, then retry.";
    failure(error);
  } finally {
    busy = false;
    for (const id of ["generate", "text", "voice", "expression", "intensity"]) $(id).disabled = false;
  }
}

$("generate").addEventListener("click", generate);
$("play").addEventListener("click", async () => {
  $("error").hidden = true;
  if (!clip) return;
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
$("volume").addEventListener("input", () => { audio.volume = Number($("volume").value); });
$("intensity").addEventListener("input", () => { $("strength").textContent = Number($("intensity").value).toFixed(2); });
for (const id of ["edges", "points", "yaw", "zoom"]) $(id).addEventListener("input", draw);
for (const button of document.querySelectorAll("[data-example]")) {
  button.addEventListener("click", () => {
    if (!busy) { $("text").value = button.dataset.example; $("text").focus(); }
  });
}
audio.volume = Number($("volume").value);
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
  if (!event.persisted && audioUrl) URL.revokeObjectURL(audioUrl);
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
  const binary = await (await request("/api/mesh")).arrayBuffer();
  renderer = new FaceRenderer($("face"), session.mesh, binary);
  new ResizeObserver(draw).observe($("face"));
  $("voice").disabled = false;
  $("generate").disabled = false;
  $("status").textContent = `Ready. ${session.mesh.vertices.toLocaleString()} connected face points; enter text and generate.`;
  draw();
} catch (error) {
  $("status").textContent = "The local face could not start.";
  failure(error);
}

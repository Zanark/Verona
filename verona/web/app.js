import { rotationMatrix, cursorGaze } from "/orientation.mjs";
import { JAW_CROP, trimJawTopology } from "/framing.mjs";
import { PRESENTATIONS, presentation, frontFaceTopology, topologyEdges, presentationFit } from "/presentations.mjs";

const $ = (id) => document.getElementById(id);
const desktop = window.veronaDesktop;
let cursor = null;
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
  $("overlay-error").textContent = $("error").textContent;
  $("overlay-error").hidden = false;
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

function surfaceNormals(positions, triangles, offset = 0, count = positions.length / 3,
  normals = new Float32Array(count * 3), vertexIds = null) {
  normals.fill(0);
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
  for (let j = 0; j < (vertexIds ? vertexIds.length : count); j++) {
    const i = (vertexIds ? vertexIds[j] : j) * 3;
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
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: Boolean(desktop), premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL2 is unavailable. Use a current Edge or Chrome with graphics enabled.");
    this.gl = gl;
    const vertex = `#version 300 es
      in vec3 positionA;
      in vec3 positionB;
      in vec3 normalA;
      in vec3 normalB;
      in vec3 restPosition;
      uniform float blend, quantization, aspect, zoom, pointSize;
      uniform mat3 rotation;
      uniform vec3 center;
      uniform float scale, viewScale;
      uniform vec3 viewCenter;
      out vec3 viewNormal, rest;
      void main() {
        vec3 p = mix(positionA, positionB, blend) / quantization;
        p = rotation * ((p - viewCenter) * viewScale);
        gl_Position = vec4(p.x * zoom / aspect, p.y * zoom, -p.z * 0.35, 1.0);
        gl_PointSize = pointSize;
        viewNormal = rotation * mix(normalA, normalB, blend);
        rest = restPosition / quantization * scale + center;
      }`;
    const fragment = `#version 300 es
      precision highp float;
      uniform vec3 color;
      uniform bool points, polygonView;
      uniform float neckDepth;
      uniform vec2 gaze;
      uniform int material, pass, presentationStyle;
      in vec3 viewNormal, rest;
      out vec4 outputColor;
      float square(float value) { return value*value; }
      void main() {
        if (neckDepth >= 0.0 && rest.y < ${JAW_CROP.chin}
          + ${JAW_CROP.curve} * rest.x * rest.x
          + ${JAW_CROP.rearRise.toFixed(1)} * clamp((${JAW_CROP.rearStart.toFixed(1)} - rest.z)
            / ${JAW_CROP.rearSpan.toFixed(1)}, 0.0, 1.0) - neckDepth) discard;
        if (points && distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;
        if (presentationStyle > 0) {
          if (pass == 2) { outputColor = vec4(0.0); return; }
          float alpha = 0.92;
          if (presentationStyle == 3) {
            vec2 grid = vec2(atan(rest.x, rest.z + 4.0) * 12.0, rest.y * 2.7);
            vec2 distanceToLine = abs(fract(grid - 0.5) - 0.5) / max(fwidth(grid), vec2(0.0001));
            alpha *= 1.0 - smoothstep(0.35, 1.1, min(distanceToLine.x, distanceToLine.y));
            if (alpha < 0.01) discard;
          }
          vec3 ink = color;
          if (material == 2) {
            vec3 eyeCenter = rest.x < 0.0 ? vec3(-2.9485,147.5517,2.2364) : vec3(3.1021,147.4944,2.2830);
            float radius = length((rest - eyeCenter).xy - gaze);
            ink *= 0.45 + 0.55 * smoothstep(0.18, 0.35, radius);
          }
          outputColor = vec4(ink, alpha);
          return;
        }
        vec3 n = normalize(viewNormal);
        vec3 key = normalize(polygonView?vec3(-0.65,0.8,1.2):vec3(-0.55,0.65,1.5));
        float diffuse = polygonView?max(dot(n,key),0.0):clamp((dot(n,key)+0.22)/1.22,0.0,1.0);
        float rim = pow(1.0 - abs(n.z), 3.0);
        float fill = max(dot(n, normalize(vec3(0.9,0.15,0.6))),0.0);
        if (pass == 1) {
          float facing = smoothstep(-0.05,0.55,n.z);
          outputColor = polygonView
            ? vec4(color*(0.42+diffuse*0.48+rim*0.35),facing*0.38)
            : vec4(color*(0.65+diffuse*0.35),facing*(material==1?0.12:0.105));
          return;
        }
        vec3 base = color;
        float polish = 0.10;
        if (material == 0) {
          float x = abs(rest.x - 0.08);
          float lipCenter = 140.15 - 0.10 * square(x / 2.5);
          float lip = (1.0-smoothstep(0.70,1.0,square(x/2.65)+square((rest.y-lipCenter)/0.70)))
            * smoothstep(2.6,3.2,rest.z);
          if (polygonView) {
            base=mix(base,vec3(0.37,0.16,0.20),lip*0.8);
            float cavity=(1.0-smoothstep(0.65,1.0,square(x/2.3)+square((rest.y-140.1)/0.62)))
              *(1.0-smoothstep(3.0,3.35,rest.z));
            base=mix(base,vec3(0.025,0.018,0.024),cavity);
            float browY=149.18+0.42*(1.0-square((x-3.1)/1.8));
            float brow=(1.0-smoothstep(0.12,0.23,abs(rest.y-browY)))
              *smoothstep(1.3,1.8,x)*(1.0-smoothstep(4.5,4.9,x))*smoothstep(1.6,2.5,rest.z);
            base=mix(base,vec3(0.055,0.068,0.08),brow*0.8);
          } else {
          base = mix(base,vec3(0.32,0.095,0.105),lip * 0.86);
          polish += lip*0.11;
          float blush = exp(-square((x-3.9)/1.7)-square((rest.y-144.4)/1.6))
            * smoothstep(1.5,2.8,rest.z);
          base = mix(base,vec3(0.49,0.19,0.17),blush*0.16);
          float cavity = (1.0-smoothstep(0.65,1.0,square(x/2.3)+square((rest.y-140.1)/0.62)))
            * (1.0-smoothstep(3.0,3.35,rest.z));
          base = mix(base,vec3(0.008,0.003,0.006),cavity);
          float browY = 149.25 + 0.46 * exp(-square((x-3.65)/1.4));
          float browWidth=mix(0.18,0.035,smoothstep(2.5,4.9,x));
          float brow = (1.0-smoothstep(browWidth,browWidth+0.07,abs(rest.y-browY)))
            * smoothstep(1.3,1.8,x)*(1.0-smoothstep(4.5,4.9,x))*smoothstep(1.6,2.5,rest.z);
          float detail=1.0-smoothstep(0.35,1.0,max(fwidth(rest.x*75.0),fwidth(rest.y*75.0)));
          float grain=sin(rest.x*75.0+sin(rest.y*61.0))*sin(rest.y*75.0+rest.z*39.0);
          base*=1.0+0.018*grain*detail;
          float strands=0.96+0.04*sin(rest.x*75.0+rest.y*21.0)*detail;
          base = mix(base,vec3(0.018,0.010,0.006),brow*strands*0.96);
          float eyeX=(x-3.02)/1.65;
          float upper=147.53+0.80*sqrt(max(0.0,1.0-eyeX*eyeX))+0.075*eyeX;
          float liner=(1.0-smoothstep(0.035,0.10,abs(rest.y-upper)))
            *smoothstep(1.25,1.6,x)*(1.0-smoothstep(4.5,4.85,x))
            *smoothstep(2.1,2.8,rest.z);
          float shadow=exp(-square((rest.y-upper-0.27)/0.31))
            *smoothstep(1.4,1.9,x)*(1.0-smoothstep(4.5,4.9,x))*smoothstep(2.0,2.8,rest.z);
          float wingY=147.82+0.36*(x-4.1);
          float wing=(1.0-smoothstep(0.02,0.065,abs(rest.y-wingY)))
            *smoothstep(4.05,4.3,x)*(1.0-smoothstep(4.55,4.9,x))*smoothstep(2.1,2.8,rest.z);
          base=mix(base,vec3(0.21,0.12,0.08),shadow*0.30);
          base=mix(base,vec3(0.024,0.012,0.008),max(liner,wing)*0.82);
          }
        } else if (material == 1 && !polygonView) {
          float ribbon=0.5+0.5*sin(rest.y*1.65+rest.x*0.28+rest.z*0.42);
          float fiber=pow(0.5+0.5*cos(atan(rest.x+1.5,rest.z+5.7)*150.0+rest.y*0.18),8.0);
          base*=0.84+0.06*ribbon+0.10*fiber;
          float partX=-1.65+0.13*(rest.z-2.0);
          float part=(1.0-smoothstep(0.045,0.10,abs(rest.x-partX)))
            *smoothstep(153.7,155.0,rest.y)*smoothstep(-6.0,-4.5,rest.z);
          base=mix(base,vec3(0.10,0.055,0.03),part*0.45);
          polish=0.08+0.03*ribbon;
        } else if (material == 2) {
          vec3 eyeCenter = rest.x < 0.0 ? vec3(-2.9485,147.5517,2.2364) : vec3(3.1021,147.4944,2.2830);
          vec3 local = rest-eyeCenter;
          local.xy -= gaze;
          float radius = length(local.xy-(polygonView?vec2(0.0):vec2(0.0,0.08)));
          float front = smoothstep(0.9,1.2,local.z);
          float iris = (1.0-smoothstep(polygonView?0.48:0.53,polygonView?0.55:0.59,radius))*front;
          float pupil = (1.0-smoothstep(0.20,0.25,radius))*front;
          vec3 hazel=mix(vec3(0.055,0.15,0.07),vec3(0.29,0.17,0.045),
            1.0-smoothstep(0.25,0.43,radius));
          float fibers=0.82+0.18*sin(atan(local.y,local.x)*62.0);
          float limbus=0.54+0.46*(1.0-smoothstep(0.43,0.57,radius));
          hazel*=fibers*limbus;
          vec3 irisColor=polygonView
            ?vec3(0.10,0.28,0.29)*(0.8+0.2*sin(atan(local.y,local.x)*30.0)):hazel;
          base = mix(base,irisColor,iris);
          base = mix(base,polygonView?vec3(0.012,0.021,0.027):vec3(0.003,0.002,0.002),pupil);
          if (!polygonView) {
            base*=1.0-0.18*smoothstep(0.0,0.75,local.y);
            float catchlight=(1.0-smoothstep(0.035,0.065,length(local.xy-vec2(-0.15,0.22))))*iris;
            base=mix(base,vec3(0.85,0.88,0.80),catchlight*0.8);
          }
          polish=0.7;
        }
        float specular = pow(max(dot(n,normalize(key+vec3(0,0,1))),0.0),material==2?80.0:36.0);
        if (polygonView) {
          vec3 lit=base*(0.16+0.70*diffuse+0.18*fill)+vec3(0.12,0.17,0.20)*rim;
          lit+=vec3(0.64,0.77,0.83)*specular*(material==2?0.65:0.14);
          outputColor=vec4(lit,1.0);
          return;
        }
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
      ["blend", "quantization", "aspect", "rotation", "gaze", "zoom", "pointSize", "color", "points", "center", "scale", "material", "pass", "polygonView", "neckDepth", "presentationStyle", "viewCenter", "viewScale"]
        .map((name) => [name, gl.getUniformLocation(program, name)]),
    );
    if (binary.byteLength !== meta.bytes || meta.edgeOffset % 4 || meta.triangleOffset % 4) {
      throw new Error("Face mesh byte count/alignment does not match its contract.");
    }
    this.neutralData = new Int16Array(binary, 0, meta.vertices * 3);
    this.triangleData = new Uint32Array(binary, meta.triangleOffset, meta.triangles * 3);
    this.neutral = this.buffer(gl.ARRAY_BUFFER, this.neutralData);
    this.neutralNormals = this.buffer(gl.ARRAY_BUFFER, surfaceNormals(this.neutralData,this.triangleData));
    this.normalScratch = new Float32Array(meta.vertices * 3);
    this.normalSlots = [0,1].map(() => ({
      frame:-1, buffer:this.buffer(gl.ARRAY_BUFFER,this.normalScratch,gl.DYNAMIC_DRAW),
    }));
    this.edges = this.buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(binary, meta.edgeOffset, meta.edges * 2));
    this.triangles = this.buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(binary, meta.triangleOffset, meta.triangles * 3));
    this.fullSkin = {
      triangles: this.triangles, edges: this.edges, triangleData: this.triangleData,
      triangleCount: meta.triangles, edgeCount: meta.edges, vertices: null,
    };
    this.skinEdges = new Uint32Array(binary, meta.edgeOffset, meta.edges * 2);
    const hair = meta.hair;
    this.hair = {
      positions: this.buffer(gl.ARRAY_BUFFER, new Int16Array(binary, hair.positionOffset, hair.vertices * 3)),
      edges: this.buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(binary, hair.edgeOffset, hair.edges * 2)),
      triangles: this.buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(binary, hair.triangleOffset, hair.triangles * 3)),
      triangleCount: hair.triangles, edgeCount: hair.edges,
    };
    const hairData = new Int16Array(binary,hair.positionOffset,hair.vertices*3);
    this.hairData = hairData;
    this.hairEdges = new Uint32Array(binary, hair.edgeOffset, hair.edges * 2);
    this.hairTriangles = new Uint32Array(binary, hair.triangleOffset, hair.triangles * 3);
    this.hair.normals = this.buffer(gl.ARRAY_BUFFER,surfaceNormals(hairData,
      new Uint32Array(binary,hair.triangleOffset,hair.triangles*3)));
    const eyes = meta.eyes;
    const eyeData = new Int16Array(binary,eyes.positionOffset,eyes.vertices*3);
    this.eyes = {
      positions:this.buffer(gl.ARRAY_BUFFER,eyeData),
      triangles:this.buffer(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(binary,eyes.triangleOffset,eyes.triangles*3)),
      normals:this.buffer(gl.ARRAY_BUFFER,surfaceNormals(eyeData,new Uint32Array(binary,eyes.triangleOffset,eyes.triangles*3))),
    };
    this.eyeTriangles = new Uint32Array(binary, eyes.triangleOffset, eyes.triangles * 3);
    this.presentationId = "claire";
    this.view = presentation("claire");
    this.framings = Object.fromEntries(Object.entries(PRESENTATIONS).map(([id, view]) => [id, view.framing]));
    this.neckDepths = Object.fromEntries(Object.keys(PRESENTATIONS).map(id => [id, JAW_CROP.defaultNeck]));
    this.detail = 5;
    this.fit = { center: [0, 0, 0], scale: 1 };
    this.motion = null;
    this.headOnly = false;
    this.skin = this.fullSkin;
    this.activeHair = this.hair;
    this.gaze = [0, 0];
    this.lastDraw = performance.now();
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

  buffer(target, data, usage = this.gl.STATIC_DRAW) {
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(target, buffer);
    this.gl.bufferData(target, data, usage);
    return buffer;
  }

  setFraming(value, depth = this.neckDepths[this.presentationId]) {
    if (value !== "full" && value !== "head-neck") throw new Error("Choose a supported face framing.");
    const headOnly = value === "head-neck";
    if (headOnly && this.neck?.depth !== depth) {
      const skin = trimJawTopology(this.neutralData, this.skinEdges, this.triangleData, this.meta, depth);
      const hair = trimJawTopology(this.hairData, this.hairEdges, this.hairTriangles, this.meta, depth);
      const upload = (surface) => ({
        triangles: this.buffer(this.gl.ELEMENT_ARRAY_BUFFER, surface.triangles),
        edges: this.buffer(this.gl.ELEMENT_ARRAY_BUFFER, surface.edges),
        triangleCount: surface.triangles.length / 3, edgeCount: surface.edges.length / 2,
      });
      const next = {
        depth,
        skin: { ...upload(skin), triangleData: skin.triangles, vertices: skin.vertices,
          points: this.buffer(this.gl.ELEMENT_ARRAY_BUFFER, skin.vertices) },
        hair: { ...this.hair, ...upload(hair) },
      };
      if (this.neck) {
        for (const surface of [this.neck.skin, this.neck.hair]) {
          for (const name of ["triangles", "edges"]) this.gl.deleteBuffer(surface[name]);
        }
        this.gl.deleteBuffer(this.neck.skin.points);
      }
      this.neck = next;
    }
    this.headOnly = headOnly;
    this.skin = headOnly ? this.neck.skin : this.fullSkin;
    this.activeHair = headOnly ? this.neck.hair : this.hair;
    for (const slot of this.normalSlots) slot.frame = -1;
    this.updateFit();
  }

  setNeckDepth(depth) {
    if (!this.headOnly || this.view.style === 1) throw new Error("Choose Head and neck to adjust the jawline crop.");
    this.setFraming("head-neck", depth);
    this.neckDepths[this.presentationId] = depth;
  }

  updateFit() {
    if (this.view.style === 0) this.fit = { center: [0, 0, 0], scale: 1 };
    else if (this.view.style === 1) this.fit = this.frontFit;
    else {
      this.allVertices ||= Uint32Array.from({ length: this.meta.vertices }, (_, i) => i);
      if (this.headOnly) {
        if (!this.neckFit) {
          const maximum = trimJawTopology(this.neutralData, this.skinEdges, this.triangleData, this.meta, JAW_CROP.maximumNeck);
          this.neckFit = presentationFit(this.neutralData, maximum.vertices, this.meta.quantization);
        }
        this.fit = this.neckFit;
      } else {
        this.fullSkin.fit ||= presentationFit(this.neutralData, this.allVertices, this.meta.quantization);
        this.fit = this.fullSkin.fit;
      }
    }
  }

  setDetail(detail) {
    if (detail === this.detail && this.front) return;
    const topology = frontFaceTopology(this.neutralData, this.skinEdges, this.triangleData, this.meta, detail);
    const native = this.frontFit ? null : detail === 5 ? topology
      : frontFaceTopology(this.neutralData, this.skinEdges, this.triangleData, this.meta, 5);
    const fit = this.frontFit || presentationFit(this.neutralData, native.vertices, this.meta.quantization);
    const gl = this.gl;
    const next = {
      triangles: this.buffer(gl.ELEMENT_ARRAY_BUFFER, topology.triangles),
      edges: this.buffer(gl.ELEMENT_ARRAY_BUFFER, topology.edges),
      points: this.buffer(gl.ELEMENT_ARRAY_BUFFER, topology.vertices),
      triangleData: topology.triangles, vertices: topology.vertices,
      triangleCount: topology.triangles.length / 3, edgeCount: topology.edges.length / 2,
    };
    if (this.front) for (const name of ["triangles", "edges", "points"]) gl.deleteBuffer(this.front[name]);
    this.front = next;
    this.frontFit = fit;
    this.detail = detail;
    if (this.view.style === 1) { this.skin = next; this.updateFit(); }
  }

  setPresentation(id) {
    const view = presentation(id);
    if (view.style === 1) {
      this.setDetail(this.detail);
      this.skin = this.front;
      this.headOnly = false;
    } else this.setFraming(this.framings[id], this.neckDepths[id]);
    this.presentationId = id;
    this.view = view;
    this.updateFit();
    for (const slot of this.normalSlots) slot.frame = -1;
  }

  drawPresentation(ratio) {
    const gl = this.gl, u = this.uniforms, skin = this.skin, style = this.view.style;
    gl.uniform1i(u.points, 0);
    gl.uniform1i(u.pass, 2);
    gl.uniform1i(u.material, 0);
    gl.colorMask(false, false, false, false);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skin.triangles);
    gl.drawElements(gl.TRIANGLES, skin.triangleCount * 3, gl.UNSIGNED_INT, 0);
    this.staticSurface(this.eyes);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eyes.triangles);
    gl.drawElements(gl.TRIANGLES, this.meta.eyes.triangles * 3, gl.UNSIGNED_INT, 0);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.colorMask(true, true, true, true);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(u.pass, 1);
    gl.uniform1i(u.points, style === 2);
    gl.uniform1f(u.pointSize, 1.9 * ratio);
    gl.uniform3f(u.color, 0.30, 0.91, 0.86);
    const surface = (skinSurface) => {
      if (style === 2) {
        if (skinSurface) {
          if (skin.points) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skin.points);
            gl.drawElements(gl.POINTS, skin.vertices.length, gl.UNSIGNED_INT, 0);
          } else gl.drawArrays(gl.POINTS, 0, this.meta.vertices);
        } else gl.drawArrays(gl.POINTS, 0, this.meta.eyes.vertices);
      } else if (style === 1) {
        if (!skinSurface && !this.eyes.edges) {
          const edges = topologyEdges(this.eyeTriangles);
          this.eyes.edges = this.buffer(gl.ELEMENT_ARRAY_BUFFER, edges);
          this.eyes.edgeCount = edges.length / 2;
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skinSurface ? skin.edges : this.eyes.edges);
        gl.drawElements(gl.LINES, (skinSurface ? skin.edgeCount : this.eyes.edgeCount) * 2, gl.UNSIGNED_INT, 0);
      } else {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skinSurface ? skin.triangles : this.eyes.triangles);
        gl.drawElements(gl.TRIANGLES, (skinSurface ? skin.triangleCount : this.meta.eyes.triangles) * 3, gl.UNSIGNED_INT, 0);
      }
    };
    for (const name of ["positionA", "positionB"]) {
      this.attribute(name, this.motion || this.neutral, gl.SHORT,
        this.motion ? (name === "positionA" ? this.leftFrame : this.rightFrame) * this.meta.vertices * 6 : 0);
    }
    this.attribute("restPosition", this.neutral, gl.SHORT);
    for (const name of ["normalA", "normalB"]) this.attribute(name, this.neutralNormals, gl.FLOAT);
    gl.uniform1f(u.blend, this.frameBlend);
    gl.uniform1i(u.material, 0);
    surface(true);
    this.staticSurface(this.eyes);
    gl.uniform1i(u.material, 2);
    surface(false);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.uniform1i(u.points, 0);
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
      this.gl.bufferSubData(this.gl.ARRAY_BUFFER,0,
        surfaceNormals(this.motionData,this.skin.triangleData,frame*this.meta.vertices*3,
          this.meta.vertices,this.normalScratch,this.skin.vertices));
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
    if (gl.isContextLost()) { this.gazeMoving = false; return; }
    const polygonView = this.view.style > 0 || $("appearance").value === "polygon";
    const ratio = Math.min(window.devicePixelRatio || 1, polygonView ? 2 : 1.5);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    if (document.documentElement.classList.contains("overlay")) gl.clearColor(0, 0, 0, 0);
    else gl.clearColor(0.016, 0.025, 0.038, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    const frame = this.frames ? Math.min(this.frames - 1, Math.max(0, seconds * 30)) : 0;
    const left = Math.floor(frame);
    const right = this.frames ? Math.min(this.frames - 1, left + 1) : 0;
    this.leftFrame = left; this.rightFrame = right; this.frameBlend = frame - left;
    this.attribute("positionA",this.motion||this.neutral,gl.SHORT,this.motion?left*this.meta.vertices*6:0);
    this.attribute("positionB",this.motion||this.neutral,gl.SHORT,this.motion?right*this.meta.vertices*6:0);
    this.attribute("restPosition",this.neutral,gl.SHORT);
    this.attribute("normalA",this.view.style ? this.neutralNormals : this.normalBuffer(left),gl.FLOAT);
    this.attribute("normalB",this.view.style ? this.neutralNormals : this.normalBuffer(right),gl.FLOAT);
    const u = this.uniforms;
    const skin = this.skin, hair = this.activeHair;
    gl.uniform1f(u.neckDepth, this.headOnly ? this.neck.depth : -1);
    gl.uniform1i(u.polygonView,polygonView);
    gl.uniform1i(u.presentationStyle, this.view.style);
    gl.uniform3fv(u.viewCenter, this.fit.center);
    gl.uniform1f(u.viewScale, this.fit.scale);
    gl.uniform1f(u.blend, frame - left);
    gl.uniform1f(u.quantization, this.meta.quantization);
    gl.uniform3fv(u.center,this.meta.center);
    gl.uniform1f(u.scale,this.meta.scale);
    gl.uniform1f(u.aspect, width / height);
    const rotation = rotationMatrix(Number($("tilt").value), Number($("yaw").value), Number($("roll").value));
    gl.uniformMatrix3fv(u.rotation, false, rotation);
    const target = $("follow-eyes").checked && cursor
      ? cursorGaze(cursor.x, cursor.y, this.canvas.getBoundingClientRect(), rotation,
        Number($("zoom").value), this.meta.center.map((value, i) => value + this.fit.center[i] * this.meta.scale),
        this.meta.scale / this.fit.scale) : [0, 0];
    const now = performance.now(), smoothing = 1 - Math.exp(-Math.min(.1, (now - this.lastDraw) / 1000) / .075);
    this.lastDraw = now;
    this.gaze = this.gaze.map((value, i) => Math.abs(target[i] - value) < .0001
      ? target[i] : value + (target[i] - value) * smoothing);
    this.gazeMoving = this.gaze.some((value, i) => Math.abs(target[i] - value) >= .0001);
    gl.uniform2fv(u.gaze, this.gaze);
    this.canvas.dataset.gaze = this.gaze.join(",");
    gl.uniform1f(u.zoom, Number($("zoom").value) * 0.91);
    gl.uniform1f(u.pointSize, 1.15 * ratio);
    $("frame").textContent = this.frames ? `FRAME ${left + 1} / ${this.frames}` : "NEUTRAL";
    if (this.view.style) {
      this.drawPresentation(ratio);
      const description = `${this.view.name}: ${skin.triangleCount.toLocaleString()} skin depth triangles; `
        + (this.view.style === 1 ? `${skin.edgeCount.toLocaleString()} triangle edges, detail ${this.detail}/5. Front face only.`
          : this.view.style === 2 ? "Visible surface dots only; hair off." : "Surface-space rectangular grid; hair off.")
        + " Same Claire speech motion; no animated-normal updates.";
      if ($("geometry-details").textContent !== description) $("geometry-details").textContent = description;
      this.geometryKey = null;
      this.canvas.dataset.presentation = this.presentationId;
      return;
    }
    this.canvas.dataset.presentation = "claire";
    gl.uniform1i(u.material,0);
    gl.uniform1i(u.pass,0);
    gl.uniform1i(u.points, 0);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);
    gl.uniform3f(u.color,...(polygonView?[0.41,0.46,0.50]:[0.43,0.30,0.205]));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skin.triangles);
    gl.drawElements(gl.TRIANGLES, skin.triangleCount * 3, gl.UNSIGNED_INT, 0);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    if ($("edges").checked) {
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1i(u.pass,1);
      gl.uniform3f(u.color,...(polygonView?[0.68,0.88,0.89]:[0.35,0.18,0.13]));
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skin.edges);
      gl.drawElements(gl.LINES, skin.edgeCount * 2, gl.UNSIGNED_INT, 0);
    }
    if ($("points").checked) {
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1i(u.pass,1);
      gl.uniform1i(u.points, 1);
      gl.uniform3f(u.color, 0.59, 0.98, 0.85);
      if (skin.points) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skin.points);
        gl.drawElements(gl.POINTS, skin.vertices.length, gl.UNSIGNED_INT, 0);
      } else gl.drawArrays(gl.POINTS, 0, this.meta.vertices);
    }
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.uniform1i(u.pass,0);
    gl.uniform1i(u.points,0);
    gl.uniform1i(u.material,2);
    this.staticSurface(this.eyes);
    gl.uniform3f(u.color,...(polygonView?[0.65,0.72,0.72]:[0.80,0.77,0.69]));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.eyes.triangles);
    gl.drawElements(gl.TRIANGLES,this.meta.eyes.triangles*3,gl.UNSIGNED_INT,0);
    if ($("hair").checked) {
      this.staticSurface(hair);
      gl.uniform1i(u.points, 0);
      gl.uniform1i(u.material,1);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.uniform3f(u.color,...(polygonView?[0.055,0.065,0.09]:[0.025,0.013,0.009]));
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, hair.triangles);
      gl.drawElements(gl.TRIANGLES, hair.triangleCount * 3, gl.UNSIGNED_INT, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1i(u.pass,1);
      gl.uniform3f(u.color,...(polygonView?[0.40,0.49,0.68]:[0.20,0.105,0.06]));
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, hair.edges);
      gl.drawElements(gl.LINES, hair.edgeCount * 2, gl.UNSIGNED_INT, 0);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }
    $("frame").textContent = this.frames ? `FRAME ${left + 1} / ${this.frames}` : "NEUTRAL";
    const geometryKey = `${this.headOnly}:${this.neck?.depth}:${$("hair").checked}`;
    if (geometryKey !== this.geometryKey) {
      this.geometryKey = geometryKey;
      $("geometry-details").textContent = `${this.headOnly ? "Head and neck" : "Full bust"}: `
        + `${skin.triangleCount.toLocaleString()} skin triangles`
        + ($("hair").checked ? ` + ${hair.triangleCount.toLocaleString()} hair triangles` : "")
        + (this.headOnly ? `; jaw-following cut, ${this.neck.depth.toFixed(1)} cm neck.` : ".")
        + " Framing changes rendering only, not speech generation.";
    }
  }
}

function draw() {
  if (renderer) renderer.draw(audio.currentTime);
  const duration = clip ? clip.duration : 0;
  $("time").textContent = `${audio.currentTime.toFixed(2)} / ${duration.toFixed(2)} s`;
  $("seek").value = String(audio.currentTime);
  if ((!audio.paused && !audio.ended || renderer?.gazeMoving) && !raf) raf = requestAnimationFrame(animate);
}

function animate() {
  raf = 0;
  draw();
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
  $("overlay-error").hidden = true;
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
  $("overlay-error").hidden = true;
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
  $("overlay-error").hidden = true;
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
for (const id of ["appearance", "edges", "points", "hair", "yaw", "tilt", "roll", "zoom"]) {
  $(id).addEventListener("input", () => { updateAngles(); draw(); });
}
$("framing").addEventListener("input", () => {
  try {
    if (renderer.view.style === 1) throw new Error("FaceMesh uses front-face framing only.");
    renderer.setFraming($("framing").value);
    renderer.framings[renderer.presentationId] = $("framing").value;
    syncPresentationControls();
    draw();
  }
  catch (error) {
    syncPresentationControls();
    failure(error);
  }
});
function syncPresentationControls() {
  const claire = renderer.view.style === 0, mesh = renderer.view.style === 1;
  for (const label of document.querySelectorAll("[data-claire-control]")) label.hidden = !claire;
  $("mesh-detail-control").hidden = !mesh;
  $("mesh-detail").value = String(renderer.detail);
  $("mesh-detail-value").value = `${renderer.detail} / 5`;
  $("framing").value = mesh ? "front" : renderer.framings[renderer.presentationId];
  $("framing").disabled = mesh;
  $("neck-depth-control").hidden = !renderer.headOnly || mesh;
  $("neck-depth").value = String(renderer.neckDepths[renderer.presentationId]);
  $("neck-depth-value").value = `${renderer.neckDepths[renderer.presentationId].toFixed(1)} cm`;
  $("presentation").value = renderer.presentationId;
}
$("presentation").addEventListener("input", () => {
  try { renderer.setPresentation($("presentation").value); syncPresentationControls(); draw(); }
  catch (error) { syncPresentationControls(); failure(error); }
});
$("mesh-detail").addEventListener("input", () => {
  try { renderer.setDetail(Number($("mesh-detail").value)); syncPresentationControls(); draw(); }
  catch (error) { syncPresentationControls(); failure(error); }
});
$("neck-depth").addEventListener("input", () => {
  try { renderer.setNeckDepth(Number($("neck-depth").value)); syncPresentationControls(); draw(); }
  catch (error) { syncPresentationControls(); failure(error); }
});
function updateAngles() {
  for (const id of ["tilt", "yaw", "roll"]) $(`${id}-angle`).value = `${Math.round(Number($(id).value) * 180 / Math.PI)} deg`;
}
$("reset-view").addEventListener("click", () => {
  for (const id of ["tilt", "yaw", "roll"]) $(id).value = "0";
  $("zoom").value = "1";
  updateAngles();
  draw();
});
$("follow-eyes").addEventListener("input", async () => {
  try { if (desktop) await desktop.command("follow", $("follow-eyes").checked); }
  catch (error) { failure(error); }
  draw();
});
window.addEventListener("mousemove", (event) => {
  if (!$("follow-eyes").checked || desktop) return;
  cursor = { x: event.clientX, y: event.clientY };
  if (!raf) raf = requestAnimationFrame(animate);
});
document.documentElement.addEventListener("mouseleave", () => {
  if (!desktop) { cursor = null; draw(); }
});
if (desktop) {
  document.documentElement.classList.add("desktop");
  $("desktop-bar").hidden = false;
  $("desktop-actions").hidden = false;
  $("follow-eyes").checked = true;
  desktop.onCursor((position) => {
    cursor = position;
    if (!raf) raf = requestAnimationFrame(animate);
  });
  desktop.onMode(({ overlay }) => {
    document.documentElement.classList.toggle("overlay", overlay);
    draw();
  });
  for (const button of document.querySelectorAll("[data-desktop]")) {
    button.addEventListener("click", async () => {
      try { await desktop.command(button.dataset.desktop); }
      catch (error) { failure(error); }
    });
  }
  $("pin-overlay").addEventListener("input", async () => {
    try { await desktop.command("pin", $("pin-overlay").checked); }
    catch (error) { failure(error); }
  });
}
for (const button of document.querySelectorAll("[data-example]")) {
  button.addEventListener("click", () => {
    if (!busy) { $("text").value = button.dataset.example; clearPreview(); $("text").focus(); }
  });
}
audio.volume = preview.volume = Number($("volume").value);
audio.addEventListener("play", () => {
  cancelAnimationFrame(raf);
  raf = 0;
  $("play").textContent = "Pause";
  animate();
});
audio.addEventListener("pause", () => {
  cancelAnimationFrame(raf);
  raf = 0;
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
  for (const [id, view] of Object.entries(PRESENTATIONS)) {
    const option = document.createElement("option");
    option.value = id; option.textContent = view.name;
    $("presentation").append(option);
  }
  $("presentation").disabled = false;
  syncPresentationControls();
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

export function createStudyRenderer(canvas, model, shaded, finish = true, transparent = false) {
  const gl = canvas.getContext("webgl2", {alpha: transparent, antialias: true, preserveDrawingBuffer: true});
  if (!gl) throw new Error("WebGL2 is required for the local head study.");
  const vertex = `#version 300 es
    in vec3 position; in vec3 normal; in vec3 restPosition;
    uniform vec3 center; uniform vec2 angle; uniform float scale; uniform float bias;
    out vec3 n; out vec3 rest;
    void main(){
      float c=cos(angle.x),s=sin(angle.x),a=cos(angle.y),b=sin(angle.y);
      mat3 yaw=mat3(c,0.,-s,0.,1.,0.,s,0.,c);
      mat3 pitch=mat3(1.,0.,0.,0.,a,b,0.,-b,a);
      mat3 rotation=pitch*yaw;
      vec3 p=rotation*(position-center)*scale;
      n=rotation*normal;
      rest=restPosition;
      gl_Position=vec4(p.x,p.y,-p.z*.4+bias,1.);
      gl_PointSize=8.;
    }`;
  const fragment = `#version 300 es
    precision highp float; in vec3 n; in vec3 rest;
    uniform vec3 color, lipColor, browColor, faceOrigin;
    uniform float eyeSpan;
    uniform bool customLips, customBrows;
    uniform int mode, feature; out vec4 pixel;
    void main(){
      if(mode==2){
        float r=length(gl_PointCoord-.5)*2.;
        if(r>1.) discard;
        pixel=vec4(mix(color,vec3(1.,.9,.85),exp(-r*r*22.)),exp(-r*r*3.));
      }else{
        float light=mode==1?.3+.7*max(0.,dot(normalize(n),normalize(vec3(-.4,.6,1.)))):1.;
        vec3 base=color;
        if(feature==0){
          vec3 local=(rest-faceOrigin)/eyeSpan;
          float lip=(1.-smoothstep(.75,1.,pow(local.x/.43,2.)+pow((local.y+1.10)/.12,2.)))
            *smoothstep(-.05,.08,local.z);
          float browY=.26+.07*(1.-pow((abs(local.x)-.5)/.3,2.));
          float brow=(1.-smoothstep(.035,.065,abs(local.y-browY)))
            *smoothstep(.18,.28,abs(local.x))*(1.-smoothstep(.72,.82,abs(local.x)))
            *smoothstep(-.12,.03,local.z);
          if(customLips) base=mix(base,lipColor,lip);
          if(customBrows) base=mix(base,browColor,brow);
        }
        pixel=vec4(base*light,1.);
      }
    }`;
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader); gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const uniforms = Object.fromEntries(["center","angle","scale","bias","color","mode",
    "lipColor","browColor","faceOrigin","eyeSpan","customLips","customBrows","feature"]
    .map(name => [name, gl.getUniformLocation(program, name)]));
  const triangles = [], lines = [], seen = new Set();
  for (const face of model.polygons) {
    for (let i=1;i<face.length-1;i++) triangles.push(face[0],face[i],face[i+1]);
    face.forEach((v,i) => {
      const w=face[(i+1)%face.length], key=v<w?`${v}:${w}`:`${w}:${v}`;
      if (!seen.has(key)) {seen.add(key);lines.push(v,w);}
    });
  }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const positions = gl.createBuffer(), normals = gl.createBuffer(), indices = gl.createBuffer();
  for (const [name, buffer] of [["position",positions],["normal",normals]]) {
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,model.rest.length*4,gl.DYNAMIC_DRAW);
    const attribute=gl.getAttribLocation(program,name);
    gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,3,gl.FLOAT,false,0,0);
  }
  const restBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,restBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,Float32Array.from(model.rest),gl.STATIC_DRAW);
  const restAttribute=gl.getAttribLocation(program,"restPosition");
  gl.enableVertexAttribArray(restAttribute);gl.vertexAttribPointer(restAttribute,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);
  const allIndices = Uint16Array.from([...triangles,...lines]);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,allIndices,gl.STATIC_DRAW);
  const bounds = [0,1,2].map(axis => {
    const values=model.rest.filter((_,i)=>i%3===axis);
    return [Math.min(...values),Math.max(...values)];
  });
  gl.uniform3fv(uniforms.center,bounds.map(([a,b])=>(a+b)/2));
  gl.uniform1f(uniforms.scale,1.65/(bounds[1][1]-bounds[1][0]));
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  const origin=[0,1,2].map(axis=>(model.eyeCenters[0][axis]+model.eyeCenters[1][axis])/2);
  const span=Math.abs(model.eyeCenters[1][0]-model.eyeCenters[0][0]);
  gl.uniform3fv(uniforms.faceOrigin,origin);gl.uniform1f(uniforms.eyeSpan,span);

  const eyeVao=gl.createVertexArray();gl.bindVertexArray(eyeVao);
  const eyes=[],spokes=[],centers=[];
  model.eyeCenters.forEach((center,i)=>{
    const radius=model.eyeRadii[i].map(r=>r*.96);
    const start=eyes.length/3, rows=16, columns=32;
    for(let y=0;y<rows;y++) for(let x=0;x<columns;x++){
      const point=(u,v)=>{
        const latitude=(v/rows-.5)*Math.PI,longitude=u/columns*2*Math.PI;
        return [center[0]+radius[0]*Math.cos(latitude)*Math.sin(longitude),
          center[1]+radius[1]*Math.sin(latitude),
          center[2]+radius[2]*Math.cos(latitude)*Math.cos(longitude)];
      };
      for(const [u,v] of [[x,y],[x+1,y],[x+1,y+1],[x,y],[x+1,y+1],[x,y+1]])
        eyes.push(...point(u,v));
    }
    if(eyes.length/3<=start) throw new Error("Missing optical geometry.");
    const iris=radius[0]*.37,z=center[2]+radius[2]+.006;
    centers.push(center[0],center[1],z+.008);
    for(let k=0;k<24;k++){
      const angle=k/24*Math.PI*2;
      for(const r of [.13,1]) spokes.push(center[0]+Math.cos(angle)*iris*r,
        center[1]+Math.sin(angle)*iris*r,z);
    }
  });
  // Optional static scalp cap: original MPFB study has no imported hair.
  const hair=[],top=bounds[1][1]+span*.04,cy=top-span*.98;
  const scalp=(u,v)=>{
    const longitude=u/32*Math.PI*2;
    const latitude=v/10*(1.35-.35*Math.cos(longitude));
    return [origin[0]+Math.sin(latitude)*Math.sin(longitude)*(bounds[0][1]-bounds[0][0])*.51,
      cy+Math.cos(latitude)*span*.98,
      origin[2]-span*.45+Math.sin(latitude)*Math.cos(longitude)*span*1.08];
  };
  for(let y=0;y<10;y++) for(let x=0;x<32;x++)
    for(const [u,v] of [[x,y],[x+1,y],[x+1,y+1],[x,y],[x+1,y+1],[x,y+1]]) hair.push(...scalp(u,v));
  const eyeBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,eyeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,Float32Array.from([...eyes,...spokes,...centers,...hair]),gl.STATIC_DRAW);
  const attribute=gl.getAttribLocation(program,"position");
  gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,3,gl.FLOAT,false,0,0);
  gl.disableVertexAttribArray(gl.getAttribLocation(program,"normal"));
  gl.bindVertexArray(vao);
  const normalData=new Float32Array(model.rest.length);
  const keys=["mesh","eyes","hair","lips","eyebrows"];
  let colors=Object.fromEntries(keys.map(key=>[key,null])),rgb={};

  const draw = (pose,yaw) => {
    if(transparent)gl.clearColor(0,0,0,0);
    else gl.clearColor(.031,.063,.094,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);gl.uniform2f(uniforms.angle,yaw*Math.PI/180,-.035);
    gl.uniform1f(uniforms.bias,0);gl.bindVertexArray(vao);
    gl.uniform1i(uniforms.feature,0);
    gl.uniform1i(uniforms.customLips,colors.lips!==null);
    gl.uniform1i(uniforms.customBrows,colors.eyebrows!==null);
    gl.uniform3fv(uniforms.lipColor,rgb.lips||[0,0,0]);
    gl.uniform3fv(uniforms.browColor,rgb.eyebrows||[0,0,0]);
    if(shaded){
      normalData.fill(0);
      for(let i=0;i<triangles.length;i+=3){
        const a=triangles[i]*3,b=triangles[i+1]*3,c=triangles[i+2]*3;
        const ux=pose[b]-pose[a],uy=pose[b+1]-pose[a+1],uz=pose[b+2]-pose[a+2];
        const vx=pose[c]-pose[a],vy=pose[c+1]-pose[a+1],vz=pose[c+2]-pose[a+2];
        const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
        for(const index of [a,b,c]){
          normalData[index]+=nx;normalData[index+1]+=ny;normalData[index+2]+=nz;
        }
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,positions);gl.bufferSubData(gl.ARRAY_BUFFER,0,pose);
    gl.bindBuffer(gl.ARRAY_BUFFER,normals);gl.bufferSubData(gl.ARRAY_BUFFER,0,normalData);
    gl.uniform1i(uniforms.mode,shaded?1:0);
    gl.uniform3fv(uniforms.color,rgb.mesh||[.67,.72,.74]);
    gl.colorMask(shaded,shaded,shaded,shaded);
    gl.drawElements(gl.TRIANGLES,triangles.length,gl.UNSIGNED_SHORT,0);
    gl.colorMask(true,true,true,true);
    gl.bindVertexArray(eyeVao);gl.uniform1i(uniforms.mode,0);gl.uniform1i(uniforms.feature,2);
    gl.uniform3f(uniforms.color,.025,.04,.05);
    gl.drawArrays(gl.TRIANGLES,0,eyes.length/3);
    if(!shaded){
      gl.bindVertexArray(vao);gl.uniform3fv(uniforms.color,rgb.mesh||[.30,.91,.86]);
      gl.uniform1i(uniforms.feature,0);
      gl.uniform1f(uniforms.bias,-.00015);gl.depthMask(false);
      gl.drawElements(gl.LINES,lines.length,gl.UNSIGNED_SHORT,triangles.length*2);
      gl.depthMask(true);gl.uniform1f(uniforms.bias,0);
    }
    gl.bindVertexArray(eyeVao);gl.uniform3fv(uniforms.color,rgb.eyes||[1,.025,.04]);
    gl.uniform1i(uniforms.feature,2);
    gl.drawArrays(gl.LINES,eyes.length/3,spokes.length/3);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(uniforms.mode,2);
    gl.drawArrays(gl.POINTS,(eyes.length+spokes.length)/3,centers.length/3);
    gl.disable(gl.BLEND);
    if(rgb.hair){
      gl.uniform1i(uniforms.mode,0);gl.uniform1i(uniforms.feature,1);
      gl.uniform3fv(uniforms.color,rgb.hair);
      gl.drawArrays(gl.TRIANGLES,(eyes.length+spokes.length+centers.length)/3,hair.length/3);
    }
    if(finish)gl.finish();
    const error=gl.getError();if(error!==gl.NO_ERROR) throw new Error(`WebGL error ${error}`);
  };
  draw.setColors = patch => {
    if(!patch||typeof patch!=="object"||Array.isArray(patch)) throw new Error("Colors must be an object.");
    const next={...colors};
    for(const [key,value] of Object.entries(patch)){
      if(!keys.includes(key)||(value!==null&&(typeof value!=="string"||!/^#[\da-f]{6}$/i.test(value))))
        throw new Error("Use mesh, eyes, hair, lips or eyebrows with #RRGGBB or null.");
      next[key]=value===null?null:value.toUpperCase();
    }
    colors=next;
    rgb=Object.fromEntries(keys.map(key=>[key,colors[key]===null?null:
      [1,3,5].map(i=>parseInt(colors[key].slice(i,i+2),16)/255)]));
    return {...colors};
  };
  return draw;
}

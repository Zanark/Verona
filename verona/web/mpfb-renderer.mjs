export function createStudyRenderer(canvas, model, shaded, finish = true) {
  const gl = canvas.getContext("webgl2", {alpha: false, antialias: true, preserveDrawingBuffer: true});
  if (!gl) throw new Error("WebGL2 is required for the local head study.");
  const vertex = `#version 300 es
    in vec3 position; in vec3 normal;
    uniform vec3 center; uniform vec2 angle; uniform float scale; uniform float bias;
    out vec3 n;
    void main(){
      float c=cos(angle.x),s=sin(angle.x),a=cos(angle.y),b=sin(angle.y);
      mat3 yaw=mat3(c,0.,-s,0.,1.,0.,s,0.,c);
      mat3 pitch=mat3(1.,0.,0.,0.,a,b,0.,-b,a);
      mat3 rotation=pitch*yaw;
      vec3 p=rotation*(position-center)*scale;
      n=rotation*normal;
      gl_Position=vec4(p.x,p.y,-p.z*.4+bias,1.);
      gl_PointSize=8.;
    }`;
  const fragment = `#version 300 es
    precision highp float; in vec3 n;
    uniform vec3 color; uniform int mode; out vec4 pixel;
    void main(){
      if(mode==2){
        float r=length(gl_PointCoord-.5)*2.;
        if(r>1.) discard;
        pixel=vec4(mix(color,vec3(1.,.9,.85),exp(-r*r*22.)),exp(-r*r*3.));
      }else{
        float light=mode==1?.3+.7*max(0.,dot(normalize(n),normalize(vec3(-.4,.6,1.)))):1.;
        pixel=vec4(color*light,1.);
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
  const uniforms = Object.fromEntries(["center","angle","scale","bias","color","mode"]
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
  const eyeBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,eyeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,Float32Array.from([...eyes,...spokes,...centers]),gl.STATIC_DRAW);
  const attribute=gl.getAttribLocation(program,"position");
  gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,3,gl.FLOAT,false,0,0);
  gl.disableVertexAttribArray(gl.getAttribLocation(program,"normal"));
  gl.bindVertexArray(vao);
  const normalData=new Float32Array(model.rest.length);

  return (pose,yaw) => {
    gl.clearColor(.031,.063,.094,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);gl.uniform2f(uniforms.angle,yaw*Math.PI/180,-.035);
    gl.uniform1f(uniforms.bias,0);gl.bindVertexArray(vao);
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
    gl.uniform3f(uniforms.color,.67,.72,.74);
    gl.colorMask(shaded,shaded,shaded,shaded);
    gl.drawElements(gl.TRIANGLES,triangles.length,gl.UNSIGNED_SHORT,0);
    gl.colorMask(true,true,true,true);
    gl.bindVertexArray(eyeVao);gl.uniform1i(uniforms.mode,0);
    gl.uniform3f(uniforms.color,.025,.04,.05);
    gl.drawArrays(gl.TRIANGLES,0,eyes.length/3);
    if(!shaded){
      gl.bindVertexArray(vao);gl.uniform3f(uniforms.color,.30,.91,.86);
      gl.uniform1f(uniforms.bias,-.00015);gl.depthMask(false);
      gl.drawElements(gl.LINES,lines.length,gl.UNSIGNED_SHORT,triangles.length*2);
      gl.depthMask(true);gl.uniform1f(uniforms.bias,0);
    }
    gl.bindVertexArray(eyeVao);gl.uniform3f(uniforms.color,1,.025,.04);
    gl.drawArrays(gl.LINES,eyes.length/3,spokes.length/3);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(uniforms.mode,2);
    gl.drawArrays(gl.POINTS,(eyes.length+spokes.length)/3,centers.length/3);
    gl.disable(gl.BLEND);if(finish)gl.finish();
    const error=gl.getError();if(error!==gl.NO_ERROR) throw new Error(`WebGL error ${error}`);
  };
}

const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function initAmbientVisuals() {
  const backdrop = document.querySelector(".backdrop");
  if (!backdrop || reducedMotion || !("requestAnimationFrame" in window)) return;
  const canvas = document.createElement("canvas");
  canvas.className = "ambient-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.width = Math.max(1, Math.floor(innerWidth * devicePixelRatio));
  canvas.height = Math.max(1, Math.floor(innerHeight * devicePixelRatio));
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", opacity: ".18" });
  backdrop.prepend(canvas);

  // Prefer WebGL2; gracefully fall back to Canvas 2D without affecting the chat UI.
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: false });
  if (gl) {
    const vertex = `#version 300 es\nin vec2 p; void main(){ gl_Position=vec4(p,0.0,1.0); }`;
    const fragment = `#version 300 es\nprecision mediump float; uniform float t; out vec4 color; void main(){ vec2 uv=gl_FragCoord.xy/vec2( max(1.0, float(1)), 1.0); float glow=0.5+0.5*sin(t*0.18+uv.x*5.0+uv.y*3.0); color=vec4(0.12,0.34,0.72,glow*0.10); }`;
    try {
      const compile = (type, source) => { const shader=gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader); if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error("shader compile"); return shader; };
      const program=gl.createProgram(); gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex)); gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment)); gl.linkProgram(program);
      if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error("shader link");
      const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      gl.useProgram(program); const loc=gl.getAttribLocation(program,"p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
      const timeLoc=gl.getUniformLocation(program,"t"); let frame=0;
      const draw=(now)=>{ if(document.documentElement.dataset.motion!=="advanced") { frame=requestAnimationFrame(draw); return; } gl.viewport(0,0,canvas.width,canvas.height); gl.uniform1f(timeLoc,now/1000); gl.drawArrays(gl.TRIANGLE_STRIP,0,4); frame=requestAnimationFrame(draw); };
      frame=requestAnimationFrame(draw);
      document.addEventListener("visibilitychange",()=>{ if(document.hidden) cancelAnimationFrame(frame); else frame=requestAnimationFrame(draw); });
      return;
    } catch { /* Fall through to 2D. */ }
  }
  const ctx=canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  const draw=()=>{ if(document.documentElement.dataset.motion==="advanced"){ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle="rgba(80,223,252,.035)"; for(let i=0;i<12;i++){const x=(i*173+performance.now()*.012)%canvas.width;ctx.beginPath();ctx.arc(x,(i*97)%canvas.height,2*devicePixelRatio,0,Math.PI*2);ctx.fill();} } requestAnimationFrame(draw); };
  let frame=requestAnimationFrame(draw);
  document.addEventListener("visibilitychange",()=>{ if(document.hidden) cancelAnimationFrame(frame); else frame=requestAnimationFrame(draw); });
}

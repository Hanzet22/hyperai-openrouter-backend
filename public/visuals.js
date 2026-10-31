const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function makeCanvas(backdrop) {
  const canvas = document.createElement("canvas");
  canvas.className = "ambient-canvas";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", opacity: ".18" });
  backdrop.prepend(canvas);
  return canvas;
}

function resize(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.max(1, Math.floor(innerWidth * dpr));
  canvas.height = Math.max(1, Math.floor(innerHeight * dpr));
}

export function initAmbientVisuals() {
  const backdrop = document.querySelector(".backdrop");
  if (!backdrop || reducedMotion || !("requestAnimationFrame" in window)) return;
  let canvas = makeCanvas(backdrop);
  resize(canvas);
  let renderer = null;

  const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, powerPreference: "low-power" });
  if (gl) {
    try {
      const vertexSource = "#version 300 es\\nin vec2 position; void main(){ gl_Position=vec4(position,0.0,1.0); }";
      const fragmentSource = "#version 300 es\\nprecision mediump float; uniform float time; uniform vec2 resolution; out vec4 color; void main(){ vec2 uv=gl_FragCoord.xy/max(resolution,vec2(1.0)); float wave=0.5+0.5*sin(time*0.16+uv.x*5.0+uv.y*3.0); color=vec4(0.12,0.34,0.72,wave*0.10); }";
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation failed");
        return shader;
      };
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Shader link failed");
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      renderer = (now) => {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform1f(gl.getUniformLocation(program, "time"), now / 1000);
        gl.uniform2f(gl.getUniformLocation(program, "resolution"), canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };
    } catch {
      // A canvas cannot switch context types; replace it before using the 2D fallback.
      canvas.remove();
      canvas = makeCanvas(backdrop);
      resize(canvas);
    }
  }

  if (!renderer) {
    const ctx = canvas.getContext("2d");
    if (!ctx) { canvas.remove(); return; }
    renderer = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(80,223,252,.07)";
      for (let i = 0; i < 12; i++) {
        const x = (i * 173 + performance.now() * .012) % canvas.width;
        const y = (i * 97) % canvas.height;
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
    };
  }

  let frame = 0;
  const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
  const tick = (now) => {
    frame = 0;
    if (document.hidden || document.documentElement.dataset.motion !== "advanced") return;
    renderer(now);
    frame = requestAnimationFrame(tick);
  };
  const start = () => { if (!frame && !document.hidden && document.documentElement.dataset.motion === "advanced") frame = requestAnimationFrame(tick); };
  const observer = new MutationObserver(() => document.documentElement.dataset.motion === "advanced" ? start() : stop());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  window.addEventListener("resize", () => { resize(canvas); if (renderer && canvas.getContext("webgl2")) { const context=canvas.getContext("webgl2"); context.viewport(0,0,canvas.width,canvas.height); } }, { passive: true });
  start();
}

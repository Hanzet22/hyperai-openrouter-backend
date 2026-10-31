import { VERTEX_SHADER, FRAGMENT_SHADER } from "./shaders.js";

const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
const MAX_DPR = 1.5;
const FRAME_INTERVAL = 1000 / 30;

function makeCanvas(backdrop) {
  const canvas = document.createElement("canvas");
  canvas.className = "ambient-canvas";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    opacity: ".18"
  });
  backdrop.prepend(canvas);
  return canvas;
}

function resize(canvas, gl = null) {
  const bounds = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const width = Math.max(1, Math.floor((bounds.width || window.innerWidth) * dpr));
  const height = Math.max(1, Math.floor((bounds.height || window.innerHeight) * dpr));
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
  if (gl) gl.viewport(0, 0, width, height);
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to allocate WebGL shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "WebGL shader compilation failed.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createWebGLRenderer(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power"
  });
  if (!gl) return null;

  let vertexShader;
  let fragmentShader;
  let program;
  let buffer;
  try {
    vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    program = gl.createProgram();
    if (!program) throw new Error("Unable to allocate WebGL program.");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "WebGL program linking failed.");
    }

    buffer = gl.createBuffer();
    if (!buffer) throw new Error("Unable to allocate WebGL buffer.");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const position = gl.getAttribLocation(program, "position");
    const time = gl.getUniformLocation(program, "time");
    const resolution = gl.getUniformLocation(program, "resolution");
    if (position < 0 || !time || !resolution) {
      throw new Error("Required WebGL shader inputs were not found.");
    }

    gl.useProgram(program);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    return {
      kind: "webgl2",
      render(now) {
        if (gl.isContextLost()) return;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform1f(time, now / 1000);
        gl.uniform2f(resolution, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };
  } catch (error) {
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    throw error;
  } finally {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
  }
}

function createCanvas2DRenderer(canvas) {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return null;
  return {
    kind: "canvas2d",
    render(now) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(80, 223, 252, 0.07)";
      for (let index = 0; index < 12; index += 1) {
        const x = (index * 173 + now * 0.012) % canvas.width;
        const y = (index * 97) % canvas.height;
        context.beginPath();
        context.arc(x, y, 2, 0, Math.PI * 2);
        context.fill();
      }
    }
  };
}

export function initAmbientVisuals() {
  const backdrop = document.querySelector(".backdrop");
  if (!backdrop || !("requestAnimationFrame" in window)) return;

  let canvas = makeCanvas(backdrop);
  let renderer = null;
  let frame = 0;
  let lastFrameAt = 0;
  let disposed = false;

  const useCanvasFallback = () => {
    canvas.remove();
    canvas = makeCanvas(backdrop);
    resize(canvas);
    renderer = createCanvas2DRenderer(canvas);
    bindContextLoss();
  };

  const bindContextLoss = () => {
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      stop();
      if (!disposed) useCanvasFallback();
      start();
    }, { once: true });
  };

  try {
    renderer = createWebGLRenderer(canvas);
  } catch {
    renderer = null;
  }
  if (!renderer) useCanvasFallback();
  else bindContextLoss();

  if (!renderer) {
    canvas.remove();
    return;
  }

  resize(canvas, renderer.kind === "webgl2" ? canvas.getContext("webgl2") : null);

  function stop() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  }

  function shouldAnimate() {
    return !disposed &&
      !document.hidden &&
      !motionPreference?.matches &&
      document.documentElement.dataset.motion === "advanced";
  }

  function tick(now) {
    frame = 0;
    if (!shouldAnimate()) return;
    if (now - lastFrameAt >= FRAME_INTERVAL) {
      renderer.render(now);
      lastFrameAt = now;
    }
    frame = window.requestAnimationFrame(tick);
  }

  function start() {
    if (!frame && shouldAnimate()) frame = window.requestAnimationFrame(tick);
  }

  const motionObserver = new MutationObserver(() => {
    if (shouldAnimate()) start();
    else stop();
  });
  motionObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-motion"]
  });

  const handleVisibility = () => {
    if (document.hidden) stop();
    else start();
  };
  const handlePreference = () => {
    if (motionPreference?.matches) stop();
    else start();
  };
  const handleResize = () => {
    const gl = renderer?.kind === "webgl2" ? canvas.getContext("webgl2") : null;
    resize(canvas, gl);
  };
  const cleanup = () => {
    disposed = true;
    stop();
    motionObserver.disconnect();
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("pagehide", handlePageHide);
    window.removeEventListener("pageshow", handlePageShow);
    motionPreference?.removeEventListener?.("change", handlePreference);
  };
  const handlePageHide = (event) => {
    if (event.persisted) stop();
    else cleanup();
  };
  const handlePageShow = () => start();

  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pageshow", handlePageShow);
  motionPreference?.addEventListener?.("change", handlePreference);
  start();
}

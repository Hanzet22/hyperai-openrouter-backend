/**
 * HyperAI WebGPU capability indicator.
 * Progressive enhancement only: no GPU device, shaders, model downloads,
 * prompt processing, or telemetry. OpenRouter inference remains provider-side.
 */
const modelInfo = document.querySelector(".model-info");

if (modelInfo && !document.querySelector(".webgpu-status")) {
  const badge = document.createElement("span");
  badge.className = "webgpu-status";
  badge.setAttribute("role", "status");
  badge.setAttribute("aria-live", "polite");
  badge.dataset.state = "checking";
  badge.textContent = "WebGPU: memeriksa…";
  modelInfo.append(badge);

  const setStatus = (state, message) => {
    badge.dataset.state = state;
    badge.textContent = message;
    badge.title = state === "available"
      ? "Browser exposes WebGPU. HyperAI does not currently use it for model inference."
      : "WebGPU is not available in this browser context.";
  };

  if (!globalThis.isSecureContext || !("gpu" in navigator)) {
    setStatus("unavailable", "WebGPU: tidak tersedia");
  } else {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      setStatus(adapter ? "available" : "unavailable",
        adapter ? "WebGPU: tersedia" : "WebGPU: tidak tersedia");
    } catch {
      setStatus("unavailable", "WebGPU: tidak tersedia");
    }
  }
}

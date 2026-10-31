const workletUrl = "/worklets/hyperai-grid.js";
export function initHoudini() {
  if (!("paintWorklet" in CSS) || !("registerProperty" in CSS)) return;
  CSS.paintWorklet.addModule(workletUrl)
    .then(() => document.documentElement.classList.add("houdini-ready"))
    .catch(() => { /* Native CSS backdrop remains available. */ });
}

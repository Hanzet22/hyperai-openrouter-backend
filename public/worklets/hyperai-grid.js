class HyperAIGrid {
  static get inputProperties() { return ["--accent"]; }
  paint(ctx, size) {
    const gap = 54;
    ctx.strokeStyle = "rgba(117, 173, 255, 0.12)";
    ctx.lineWidth = 1;
    for (let x = 0; x < size.width; x += gap) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size.height); ctx.stroke();
    }
    for (let y = 0; y < size.height; y += gap) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size.width, y); ctx.stroke();
    }
  }
}
registerPaint("hyperai-grid", HyperAIGrid);

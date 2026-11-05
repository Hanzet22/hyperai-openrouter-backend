import { randomUUID } from "node:crypto";

const ALLOWED_FIELDS = new Set([
  "request_id", "route", "method", "status", "duration_ms", "environment",
  "code", "outcome", "provider_key", "retry_after_seconds", "global_count",
  "route_count", "prompt_tokens", "completion_tokens", "total_tokens",
  "reported_cost", "model", "generation_id"
]);

function safeValue(key, value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const max = key === "generation_id" ? 160 : key === "model" || key === "provider_key" ? 120 : 80;
  return value.replace(/[\r\n\t]/g, " ").slice(0, max);
}

/** Emit allowlisted, structured operational telemetry. Never pass prompts, bodies, IPs, or secrets. */
export function emitTelemetry(event, fields = {}) {
  if (typeof event !== "string" || !/^hyperai\.[a-z0-9_.-]{1,80}$/.test(event)) return;
  const record = { event, timestamp: new Date().toISOString() };
  for (const [key, value] of Object.entries(fields || {})) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    const safe = safeValue(key, value);
    if (safe !== undefined) record[key] = safe;
  }
  try { console.info(JSON.stringify(record)); }
  catch { /* observability must never break application work */ }
}

/** Attach one completion/abort event to an API response without reading request content. */
export function startRequestTelemetry(req, res, route) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let completed = false;
  try { res.setHeader("X-Request-Id", requestId); } catch { /* mock or already-sent response */ }

  const finish = (outcome) => {
    if (completed) return;
    completed = true;
    emitTelemetry(outcome === "aborted" ? "hyperai.request.aborted" : "hyperai.request.completed", {
      request_id: requestId,
      route,
      method: String(req?.method || "unknown").toUpperCase(),
      status: Number(res?.statusCode) || 0,
      duration_ms: Math.max(0, Date.now() - startedAt),
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown"
    });
  };

  res.once?.("finish", () => finish("completed"));
  res.once?.("close", () => {
    if (!res.writableEnded) finish("aborted");
  });
  return requestId;
}

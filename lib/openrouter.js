import { enforceRateLimit } from "./rate-limit.js";
import { withUpstreamGuard } from "./concurrency.js";
import { fetchWithResilience, recordResilienceOutcome } from "./resilience.js";
export { withUpstreamGuard, fetchWithResilience, recordResilienceOutcome };

export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const MAX_ERROR_CHARS = 1000;
const MAX_REQUEST_BODY_BYTES = 256 * 1024;

export function sendJson(res, status, body) {
  if (res.destroyed || res.writableEnded) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function fail(res, status, message, code) {
  sendJson(res, status, { error: { message, ...(code ? { code } : {}) } });
}

function parseOrigins() {
  return String(process.env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function applyOriginPolicy(req, res) {
  const origins = parseOrigins();
  const origin = req.headers.origin;
  if (!origins.length) return { allowed: true, configured: false };
  if (!origin) return { allowed: true, configured: true };
  const normalized = String(origin).replace(/\/$/, "");
  if (!origins.includes(normalized)) return { allowed: false, configured: true };
  res.setHeader("Access-Control-Allow-Origin", normalized);
  res.setHeader("Vary", "Origin");
  return { allowed: true, configured: true };
}

function parseBody(raw) {
  let body = raw;
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  if (typeof body === "string") {
    try { body = JSON.parse(body); }
    catch { return { ok: false, error: "Invalid JSON request body." }; }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  return { ok: true, value: body };
}

/** Returns parsed request JSON, or null after it has already sent an HTTP response. */
export async function preparePost(req, res, route) {
  const policy = applyOriginPolicy(req, res);
  if (!policy.allowed) {
    fail(res, 403, "Origin not allowed.", "ORIGIN_NOT_ALLOWED");
    return null;
  }

  if (req.method === "OPTIONS") {
    if (policy.configured) {
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    res.statusCode = 204;
    res.setHeader("Cache-Control", "no-store");
    res.end();
    return null;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", policy.configured ? "POST, OPTIONS" : "POST");
    fail(res, 405, "Method not allowed.", "METHOD_NOT_ALLOWED");
    return null;
  }

  const aiEnabled = String(process.env.HYPERAI_AI_ENABLED ?? "true").trim().toLowerCase();
  if (["false", "0", "off", "no"].includes(aiEnabled)) {
    fail(res, 503, "HyperAI AI requests are temporarily disabled by the server.", "AI_SERVICE_DISABLED");
    return null;
  }

  if (!process.env.OPENROUTER_API_KEY) {
    fail(res, 500, "OPENROUTER_API_KEY is not configured on the server.", "MISSING_API_KEY");
    return null;
  }

  if (!(await enforceRateLimit(req, res, route))) return null;

  const parsed = parseBody(req.body);
  if (!parsed.ok) {
    fail(res, 400, parsed.error, "INVALID_BODY");
    return null;
  }
  if (jsonSize(parsed.value) > MAX_REQUEST_BODY_BYTES) {
    fail(res, 413, "Request body exceeds the 256 KiB server limit.", "REQUEST_BODY_TOO_LARGE");
    return null;
  }
  return parsed.value;
}

export function openRouterHeaders(req) {
  const headers = {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "X-OpenRouter-Title": String(process.env.OPENROUTER_APP_TITLE || "HyperAI").slice(0, 128)
  };

  const configuredUrl = String(process.env.PUBLIC_APP_URL || "").trim();
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) {
        headers["HTTP-Referer"] = url.href;
      }
    } catch { /* ignore malformed attribution URL; use a sanitized host fallback */ }
  }

  if (!headers["HTTP-Referer"]) {
    const host = String(req.headers.host || "localhost").replace(/[^a-zA-Z0-9.:[\]-]/g, "");
    headers["HTTP-Referer"] = `https://${host || "localhost"}`;
  }

  return headers;
}

export function extractUpstreamMessage(text, status) {
  let message = `OpenRouter request failed (HTTP ${status}).`;
  try {
    const parsed = JSON.parse(text);
    const value = parsed?.error;
    const candidate = typeof value === "string" ? value : value?.message || parsed?.message;
    if (typeof candidate === "string" && candidate.trim()) message = candidate.trim();
  } catch {
    if (typeof text === "string" && text.trim()) message = text.trim();
  }
  return message.slice(0, MAX_ERROR_CHARS);
}

export function recordUsage(route, model, usage, generationId) {
  if (!usage || typeof usage !== "object") return;
  const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens);
  const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens);
  const totalTokens = Number(usage.total_tokens);
  const reportedCost = Number(usage.cost);
  const event = {
    event: "hyperai.openrouter.usage",
    route,
    model: typeof model === "string" ? model.slice(0, 160) : "unknown",
    ...(typeof generationId === "string" ? { generation_id: generationId.slice(0, 160) } : {}),
    ...(Number.isFinite(promptTokens) ? { prompt_tokens: promptTokens } : {}),
    ...(Number.isFinite(completionTokens) ? { completion_tokens: completionTokens } : {}),
    ...(Number.isFinite(totalTokens) ? { total_tokens: totalTokens } : {}),
    ...(Number.isFinite(reportedCost) ? { reported_cost: reportedCost } : {})
  };
  if (Object.keys(event).length > 3) console.info(JSON.stringify(event));
}

export async function forwardJson(req, res, path, payload, route) {
  return withUpstreamGuard(req, res, route, 25_000, async (signal) => {
    let upstream;
    try {
      const targetUrl = /^https:\/\//i.test(path) ? path : `${OPENROUTER_BASE}${path}`;
      upstream = await fetchWithResilience(targetUrl, {
        method: "POST",
        headers: openRouterHeaders(req),
        body: JSON.stringify(payload),
        signal
      }, { key: payload?.model || route, retryRateLimit: true });
    } catch (error) {
      if (res.destroyed || res.writableEnded) return;
      const timedOut = signal.aborted && String(signal.reason?.message || "").includes("timed out");
      const status = Number(error?.status) || (timedOut ? 504 : 502);
      const code = error?.code || (timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_CONNECTION_FAILED");
      fail(res, status, String(error?.message || (timedOut ? "The upstream request exceeded its time limit." : "OpenRouter connection failed.")).slice(0, 400), code);
      return;
    }

    try {
      const text = await upstream.text();
      if (!upstream.ok) {
        fail(res, upstream.status, extractUpstreamMessage(text, upstream.status), `OPENROUTER_${upstream.status}`);
        return;
      }
      const responseBody = JSON.parse(text);
      recordUsage(route, responseBody?.model || payload?.model, responseBody?.usage, responseBody?.id);
      sendJson(res, upstream.status, responseBody);
    } catch (error) {
      if (res.destroyed || res.writableEnded) return;
      if (signal.aborted) {
        fail(res, 504, "The upstream request exceeded its time limit.", "UPSTREAM_TIMEOUT");
      } else {
        await recordResilienceOutcome(payload?.model || route, "failure");
        fail(res, 502, "OpenRouter returned an invalid response for a JSON endpoint.", "INVALID_UPSTREAM_RESPONSE");
      }
    }
  });
}

export function jsonSize(value) {
  try { return Buffer.byteLength(JSON.stringify(value), "utf8"); }
  catch { return Infinity; }
}

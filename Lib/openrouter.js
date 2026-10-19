export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const MAX_ERROR_CHARS = 1000;

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
export function preparePost(req, res) {
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

  if (!process.env.OPENROUTER_API_KEY) {
    fail(res, 500, "OPENROUTER_API_KEY is not configured on the server.", "MISSING_API_KEY");
    return null;
  }

  const parsed = parseBody(req.body);
  if (!parsed.ok) {
    fail(res, 400, parsed.error, "INVALID_BODY");
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

export async function forwardJson(req, res, path, payload) {
  let upstream;
  try {
    const targetUrl = /^https:\/\//i.test(path) ? path : `${OPENROUTER_BASE}${path}`;
    upstream = await fetch(targetUrl, {
      method: "POST",
      headers: openRouterHeaders(req),
      body: JSON.stringify(payload)
    });
  } catch (error) {
    fail(res, 502, `OpenRouter connection failed: ${String(error?.message || "network error").slice(0, 400)}`, "UPSTREAM_CONNECTION_FAILED");
    return;
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    fail(res, upstream.status, extractUpstreamMessage(text, upstream.status), `OPENROUTER_${upstream.status}`);
    return;
  }

  try {
    sendJson(res, upstream.status, JSON.parse(text));
  } catch {
    fail(res, 502, "OpenRouter returned a non-JSON response for a JSON endpoint.", "INVALID_UPSTREAM_RESPONSE");
  }
}

export function jsonSize(value) {
  try { return Buffer.byteLength(JSON.stringify(value), "utf8"); }
  catch { return Infinity; }
}

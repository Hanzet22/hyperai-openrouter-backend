import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { enforceRateLimit } from "./rate-limit.js";

const COOKIE_NAME = "__Host-hyperai_session";
const SESSION_SECONDS = 12 * 60 * 60;

function sendJson(res, status, body) {
  if (res.destroyed || res.writableEnded) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function productionLike() {\n  const env = String(process.env.VERCEL_ENV || "").toLowerCase();\n  return env === "production" || env === "preview" || (!env && process.env.NODE_ENV === "production");\n}\n\nfunction enabled() {
  return String(process.env.HYPERAI_AUTH_REQUIRED || "").trim().toLowerCase() === "true";
}

function configuration() {
  const password = String(process.env.HYPERAI_ACCESS_PASSWORD || "");
  const secret = String(process.env.HYPERAI_SESSION_SECRET || "");
  if (password.length < 12 || secret.length < 32) return null;
  return { password, secret };
}

function equalSecret(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function signature(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function cookieValue(req) {
  const header = String(req.headers?.cookie || "");
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === COOKIE_NAME) return part.slice(index + 1).trim();
  }
  return "";
}

export function hasValidSession(req, secret) {
  const token = cookieValue(req);
  const separator = token.lastIndexOf(".");
  if (!token || separator <= 0) return false;
  const payload = token.slice(0, separator);
  const supplied = token.slice(separator + 1);
  if (!equalSecret(signature(payload, secret), supplied)) return false;
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const expiry = Number(decoded.split(".", 1)[0]);
    return Number.isSafeInteger(expiry) && expiry > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function sameOrigin(req) {
  const origin = String(req.headers?.origin || "");
  if (!origin) return false;
  let parsed;
  try { parsed = new URL(origin); } catch { return false; }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const configured = String(process.env.ALLOWED_ORIGIN || "").split(",").map((value) => value.trim().replace(/\\/$/, "")).filter(Boolean);
  if (productionLike() && parsed.protocol !== "https:") return false;
  if (configured.length) return configured.includes(parsed.origin);
  const host = String(req.headers?.host || "").toLowerCase();
  const forwarded = String(req.headers?.["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  const expectedProtocol = forwarded === "https" || process.env.NODE_ENV === "production" ? "https:" : parsed.protocol;
  return parsed.host.toLowerCase() === host && parsed.protocol === expectedProtocol;
}

function setSessionCookie(res, value, maxAge) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}

function parseBody(req) {
  let body = req.body;
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  if (typeof body === "string") {
    if (Buffer.byteLength(body, "utf8") > 4096) return null;
    try { body = JSON.parse(body); } catch { return null; }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (Buffer.byteLength(JSON.stringify(body), "utf8") > 4096) return null;
  return body;
}

export async function requireSession(req, res) {
  if (!enabled()) return true;
  const config = configuration();
  if (!config) {
    sendJson(res, 503, { error: { code: "AUTH_NOT_CONFIGURED", message: "Access protection is not configured on the server." } });
    return false;
  }
  if (hasValidSession(req, config.secret)) return true;
  sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Sign in is required to use HyperAI." } });
  return false;
}

export async function handleSession(req, res) {
  if (!enabled()) return sendJson(res, 200, { required: false, authenticated: true });
  const config = configuration();
  if (!config) return sendJson(res, 503, { error: { code: "AUTH_NOT_CONFIGURED", message: "Access protection is not configured on the server." } });

  if (req.method === "GET") {
    return sendJson(res, 200, { required: true, authenticated: hasValidSession(req, config.secret) });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } });
  }
  if (!sameOrigin(req)) return sendJson(res, 403, { error: { code: "ORIGIN_NOT_ALLOWED", message: "Request origin is not allowed." } });
  if (!(await enforceRateLimit(req, res, "session"))) return;

  const body = parseBody(req);
  if (!body) return sendJson(res, 400, { error: { code: "INVALID_BODY", message: "A small JSON object is required." } });

  if (body.action === "logout") {
    setSessionCookie(res, "", 0);
    return sendJson(res, 200, { authenticated: false });
  }
  if (typeof body.password !== "string" || body.password.length > 512 || !equalSecret(body.password, config.password)) {
    return sendJson(res, 401, { error: { code: "INVALID_ACCESS_PASSWORD", message: "Access password is incorrect." } });
  }

  const expiry = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = Buffer.from(`${expiry}.${randomUUID()}`).toString("base64url");
  const token = `${payload}.${signature(payload, config.secret)}`;
  setSessionCookie(res, token, SESSION_SECONDS);
  return sendJson(res, 200, { authenticated: true, expiresIn: SESSION_SECONDS });
}

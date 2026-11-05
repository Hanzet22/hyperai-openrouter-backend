import { emitTelemetry } from "./observability.js";
import { createHash, randomUUID } from "node:crypto";

const FAILURE_THRESHOLD = 5;
const FAILURE_WINDOW_MS = 30_000;
const OPEN_DURATION_MS = 30_000;
const PROBE_LEASE_MS = 10_000;
const REDIS_TIMEOUT_MS = 2_000;
const MAX_RETRIES = 1;
const MAX_RETRY_AFTER_MS = 1_000;

export const CHECK_SCRIPT = `
local nowParts = redis.call("TIME")
local now = (tonumber(nowParts[1]) * 1000) + math.floor(tonumber(nowParts[2]) / 1000)
local openUntil = tonumber(redis.call("HGET", KEYS[1], "open_until") or "0")
if openUntil > now then
  return {0, math.max(1, math.ceil((openUntil - now) / 1000))}
end
if openUntil > 0 then
  local acquired = redis.call("SET", KEYS[2], ARGV[1], "NX", "PX", ARGV[2])
  if not acquired then return {0, 5} end
  return {1, 1}
end
return {1, 0}
`;

export const SUCCESS_SCRIPT = `
redis.call("DEL", KEYS[1])
redis.call("DEL", KEYS[2])
redis.call("DEL", KEYS[3])
return 1
`;

export const FAILURE_SCRIPT = `
local nowParts = redis.call("TIME")
local now = (tonumber(nowParts[1]) * 1000) + math.floor(tonumber(nowParts[2]) / 1000)
local wasProbe = redis.call("EXISTS", KEYS[3]) == 1
local count = redis.call("INCR", KEYS[2])
if count == 1 then redis.call("PEXPIRE", KEYS[2], ARGV[1]) end
if count >= tonumber(ARGV[2]) or wasProbe then
  redis.call("HSET", KEYS[1], "open_until", now + tonumber(ARGV[3]))
  redis.call("PEXPIRE", KEYS[1], tonumber(ARGV[3]) * 2)
end
redis.call("DEL", KEYS[3])
return count
`;

export const NEUTRAL_SCRIPT = `
redis.call("DEL", KEYS[3])
return 1
`;

function productionLike() {
  const env = String(process.env.VERCEL_ENV || "").toLowerCase();
  return env === "production" || env === "preview" || (!env && process.env.NODE_ENV === "production");
}

function redisConfig() {
  const rawUrl = String(process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!rawUrl || !token) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return { url: url.href.replace(/\/$/, ""), token };
  } catch {
    return null;
  }
}

async function redisEval(config, script, keys, args = []) {
  const response = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["EVAL", script, String(keys.length), ...keys, ...args.map(String)]),
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error("Resilience store unavailable");
  const payload = await response.json();
  if (payload?.error || payload?.result === undefined) throw new Error("Invalid resilience store response");
  return payload.result;
}

function circuitKeys(key) {
  const digest = createHash("sha256").update(String(key)).digest("hex").slice(0, 32);
  const prefix = `hyperai:resilience:v1:circuit:${digest}`;
  return [`${prefix}:state`, `${prefix}:failures`, `${prefix}:probe`];
}

function abortError(signal) {
  return signal?.reason instanceof Error ? signal.reason : new Error("Request aborted");
}

function parseRetryAfter(value, now = Date.now()) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Math.max(0, Math.ceil(Number(trimmed) * 1000));
  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : null;
}

function wait(ms, signal) {
  if (signal?.aborted) return Promise.reject(abortError(signal));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, ms);
    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
    function done() { cleanup(); resolve(); }
    function onAbort() { cleanup(); reject(abortError(signal)); }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function isTransientStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function settleCircuit(config, keys, outcome) {
  if (outcome === "success") {
    await redisEval(config, SUCCESS_SCRIPT, keys);
  } else if (outcome === "failure") {
    await redisEval(config, FAILURE_SCRIPT, keys, [FAILURE_WINDOW_MS, FAILURE_THRESHOLD, OPEN_DURATION_MS]);
  } else {
    await redisEval(config, NEUTRAL_SCRIPT, keys);
  }
}

/**
 * Performs one upstream request with a shared provider/model circuit breaker.
 * Only a single, bounded 429 retry is permitted, and only before response
 * consumption. Callers must keep streaming retries disabled after stream start.
 */
export async function fetchWithResilience(url, init, options = {}) {
  const key = options.key || "openrouter:default";
  const retryRateLimit = options.retryRateLimit === true;
  const signal = init?.signal;
  const config = productionLike() ? redisConfig() : null;
  const keys = circuitKeys(key);
  const probeToken = randomUUID();
  let gate = null;

  if (productionLike()) {
    if (!config) throw Object.assign(new Error("Upstream resilience protection is unavailable."), { code: "RESILIENCE_UNAVAILABLE", status: 503 });
    try {
      gate = await redisEval(config, CHECK_SCRIPT, [keys[0], keys[2]], [probeToken, PROBE_LEASE_MS]);
    } catch {
      throw Object.assign(new Error("Upstream resilience protection is temporarily unavailable."), { code: "RESILIENCE_UNAVAILABLE", status: 503 });
    }
    if (!Array.isArray(gate) || Number(gate[0]) !== 1) {
      emitTelemetry("hyperai.resilience.circuit_open", { provider_key: key, retry_after_seconds: Number(gate?.[1]) || 5 });
      throw Object.assign(new Error("The upstream provider is temporarily cooling down. Please retry later."), {
        code: "UPSTREAM_CIRCUIT_OPEN", status: 503, retryAfter: Number(gate?.[1]) || 5
      });
    }
  }

  let outcome = "neutral";
  if (config && Array.isArray(gate) && Number(gate[1]) === 1) emitTelemetry("hyperai.resilience.half_open_probe", { provider_key: key });
  try {
    let response;
    for (let attempt = 0; attempt <= (retryRateLimit ? MAX_RETRIES : 0); attempt += 1) {
      if (signal?.aborted) throw abortError(signal);
      try {
        response = await fetch(url, init);
      } catch (error) {
        outcome = "failure";
        throw error;
      }

      if (response.ok) {
        outcome = "success";
        return response;
      }
      if (isTransientStatus(response.status)) outcome = "failure";

      if (response.status !== 429 || !retryRateLimit || attempt >= MAX_RETRIES) return response;
      const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
      if (retryAfter === null || retryAfter > MAX_RETRY_AFTER_MS) return response;

      try { await response.body?.cancel(); } catch { /* discard the unconsumed throttling response */ }
      const jitter = Math.floor(Math.random() * 101);
      await wait(Math.min(MAX_RETRY_AFTER_MS, retryAfter + jitter), signal);
    }
    return response;
  } finally {
    if (config) {
      emitTelemetry("hyperai.resilience.outcome", { provider_key: key, outcome });
      if (signal?.aborted && String(signal.reason?.message || "").toLowerCase().includes("client disconnected")) outcome = "neutral";
      try { await settleCircuit(config, keys, outcome); }
      catch (error) {
        // A failed state write must not turn a successful provider response into an unhandled request.
        emitTelemetry("hyperai.resilience.store_error", { provider_key: key, code: "REDIS_STATE_WRITE_FAILED" });
      }
    }
  }
}

export const resiliencePolicy = Object.freeze({
  failureThreshold: FAILURE_THRESHOLD,
  failureWindowMs: FAILURE_WINDOW_MS,
  openDurationMs: OPEN_DURATION_MS,
  maxRetries: MAX_RETRIES,
  maxRetryAfterMs: MAX_RETRY_AFTER_MS
});

export { parseRetryAfter };


/** Records failures discovered after upstream response headers have been received. */
export async function recordResilienceOutcome(key, outcome) {
  if (!productionLike()) return;
  const config = redisConfig();
  if (!config) return;
  try {
    await settleCircuit(config, circuitKeys(key || "openrouter:default"), outcome === "failure" ? "failure" : "neutral");
  } catch (error) {
    emitTelemetry("hyperai.resilience.store_error", { provider_key: key, code: "REDIS_STATE_WRITE_FAILED" });
  }
}

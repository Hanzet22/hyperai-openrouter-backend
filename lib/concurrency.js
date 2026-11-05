import { randomUUID } from "node:crypto";

const LEASE_MS = 70_000;
const GLOBAL_CONCURRENCY = 24;
const ROUTE_CONCURRENCY = Object.freeze({
  chat: 8,
  decisions: 8,
  embeddings: 8,
  moderate: 8,
  rerank: 6,
  speech: 3
});

const ACQUIRE_SCRIPT = `
local nowParts = redis.call("TIME")
local now = (tonumber(nowParts[1]) * 1000) + math.floor(tonumber(nowParts[2]) / 1000)
local expires = now + tonumber(ARGV[1])
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", now)
redis.call("ZREMRANGEBYSCORE", KEYS[2], "-inf", now)
local globalCount = redis.call("ZCARD", KEYS[1])
local routeCount = redis.call("ZCARD", KEYS[2])
if globalCount >= tonumber(ARGV[2]) or routeCount >= tonumber(ARGV[3]) then
  return {0, globalCount, routeCount}
end
redis.call("ZADD", KEYS[1], expires, ARGV[4])
redis.call("ZADD", KEYS[2], expires, ARGV[4])
redis.call("PEXPIRE", KEYS[1], tonumber(ARGV[1]) * 2)
redis.call("PEXPIRE", KEYS[2], tonumber(ARGV[1]) * 2)
return {1, globalCount + 1, routeCount + 1}
`;

const RELEASE_SCRIPT = `
redis.call("ZREM", KEYS[1], ARGV[1])
redis.call("ZREM", KEYS[2], ARGV[1])
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

async function redisEval(config, script, keys, args) {
  const response = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["EVAL", script, String(keys.length), ...keys, ...args.map(String)]),
    signal: AbortSignal.timeout(2000)
  });
  if (!response.ok) throw new Error("Concurrency store unavailable");
  const payload = await response.json();
  if (payload?.error || !Array.isArray(payload?.result)) throw new Error("Invalid concurrency response");
  return payload.result;
}

function sendGuardError(res, status, code, message, retryAfter) {
  if (res.destroyed || res.writableEnded) return;
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  if (retryAfter) res.setHeader("Retry-After", String(retryAfter));
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: { code, message } }));
}

/**
 * Holds a distributed concurrency lease only while upstream work is active.
 * The lease expires automatically if a function instance disappears.
 */
export async function withUpstreamGuard(req, res, route, timeoutMs, operation) {
  const routeLimit = ROUTE_CONCURRENCY[route];
  if (!routeLimit) {
    sendGuardError(res, 503, "CONCURRENCY_GUARD_UNAVAILABLE", "Request protection is unavailable.");
    return;
  }

  let release = async () => {};
  if (productionLike()) {
    const config = redisConfig();
    if (!config) {
      sendGuardError(res, 503, "CONCURRENCY_GUARD_UNAVAILABLE", "Request protection is temporarily unavailable.", 30);
      return;
    }
    const token = randomUUID();
    const globalKey = "hyperai:concurrency:v1:global";
    const routeKey = `hyperai:concurrency:v1:${route}`;
    try {
      const result = await redisEval(config, ACQUIRE_SCRIPT, [globalKey, routeKey], [
        LEASE_MS, GLOBAL_CONCURRENCY, routeLimit, token
      ]);
      if (Number(result[0]) !== 1) {
        sendGuardError(res, 429, "CONCURRENCY_LIMITED", "Too many requests are currently being processed. Retry shortly.", 5);
        return;
      }
    } catch {
      sendGuardError(res, 503, "CONCURRENCY_GUARD_UNAVAILABLE", "Request protection is temporarily unavailable.", 30);
      return;
    }
    release = async () => {
      try { await redisEval(config, RELEASE_SCRIPT, [globalKey, routeKey], [token]); }
      catch { /* lease TTL is the crash-safe cleanup fallback */ }
    };
  }

  const controller = new AbortController();
  const abortForDisconnect = () => {
    if (!res.writableEnded && !controller.signal.aborted) controller.abort(new Error("Client disconnected"));
  };
  const onRequestAborted = () => abortForDisconnect();
  const onRequestError = (error) => {
    if (error?.message === "aborted") abortForDisconnect();
  };
  const onResponseClose = () => abortForDisconnect();
  const timer = setTimeout(() => {
    if (!controller.signal.aborted) controller.abort(new Error("Upstream request timed out"));
  }, timeoutMs);
  timer.unref?.();

  res.on?.("close", onResponseClose);
  req.on?.("aborted", onRequestAborted);
  req.on?.("error", onRequestError);

  try {
    await operation(controller.signal);
  } finally {
    clearTimeout(timer);
    res.off?.("close", onResponseClose);
    req.off?.("aborted", onRequestAborted);
    req.off?.("error", onRequestError);
    await release();
  }
}

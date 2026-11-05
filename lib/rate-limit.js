import { createHash } from "node:crypto";

const WINDOW_MS = 60_000;
const GLOBAL_LIMIT = 120;
const ROUTE_LIMITS = Object.freeze({
  chat: 8,
  decisions: 12,
  embeddings: 20,
  moderate: 20,
  rerank: 10,
  speech: 4
});

const RATE_LIMIT_SCRIPT = `
local ipCount = tonumber(redis.call("GET", KEYS[1]) or "0")
local globalCount = tonumber(redis.call("GET", KEYS[2]) or "0")
local ipLimit = tonumber(ARGV[1])
local globalLimit = tonumber(ARGV[2])
local windowMs = tonumber(ARGV[3])

if ipCount >= ipLimit then
  return {0, ipCount, globalCount, redis.call("PTTL", KEYS[1])}
end
if globalCount >= globalLimit then
  return {0, ipCount, globalCount, redis.call("PTTL", KEYS[2])}
end

ipCount = redis.call("INCR", KEYS[1])
if ipCount == 1 then redis.call("PEXPIRE", KEYS[1], windowMs) end
globalCount = redis.call("INCR", KEYS[2])
if globalCount == 1 then redis.call("PEXPIRE", KEYS[2], windowMs) end

return {1, ipCount, globalCount, windowMs}
`;

function getClientIp(req) {
  const value = req.headers?.["x-real-ip"];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (process.env.NODE_ENV !== "production") return "local-development";
  return null;
}

function redisConfiguration() {
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

function unavailable(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Retry-After", "30");
  res.statusCode = 503;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({
    error: {
      code: "RATE_LIMIT_UNAVAILABLE",
      message: "API protection is temporarily unavailable. Please retry later."
    }
  }));
  return false;
}

export async function enforceRateLimit(req, res, route) {
  if (process.env.NODE_ENV !== "production") return true;

  const routeLimit = ROUTE_LIMITS[route];
  const ip = getClientIp(req);
  const config = redisConfiguration();
  if (!routeLimit || !ip || !config) return unavailable(res);

  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const ipKey = `hyperai:rl:v1:${route}:${ipHash}`;
  const globalKey = "hyperai:rl:v1:global";
  let result;

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([
        "EVAL",
        RATE_LIMIT_SCRIPT,
        "2",
        ipKey,
        globalKey,
        String(routeLimit),
        String(GLOBAL_LIMIT),
        String(WINDOW_MS)
      ]),
      signal: AbortSignal.timeout(2500)
    });

    if (!response.ok) throw new Error("Redis request failed");
    const payload = await response.json();
    if (payload?.error || !Array.isArray(payload?.result) || payload.result.length !== 4) {
      throw new Error("Redis returned an invalid rate-limit result");
    }
    result = payload.result.map(Number);
    if (!result.every(Number.isFinite)) throw new Error("Redis returned non-numeric rate-limit data");
  } catch {
    return unavailable(res);
  }

  const [allowed, ipCount, globalCount, ttl] = result;
  const limit = routeLimit;
  const remaining = Math.max(0, limit - ipCount);
  const resetSeconds = Math.max(1, Math.ceil(Math.max(0, ttl) / 1000));

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("RateLimit-Limit", String(limit));
  res.setHeader("RateLimit-Remaining", String(remaining));
  res.setHeader("RateLimit-Reset", String(resetSeconds));
  res.setHeader("RateLimit-Policy", `${limit};w=60`);

  if (allowed !== 1) {
    const retryAfter = Math.max(1, resetSeconds);
    res.setHeader("Retry-After", String(retryAfter));
    res.statusCode = 429;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({
      error: {
        code: "RATE_LIMITED",
        message: "Request limit reached. Please wait before trying again."
      }
    }));
    return false;
  }

  return true;
}

import { emitTelemetry } from "./observability.js";

const DAY_SECONDS = 48 * 60 * 60;

function productionLike() {
  const env = String(process.env.VERCEL_ENV || "").toLowerCase();
  return env === "production" || env === "preview" || (!env && process.env.NODE_ENV === "production");
}

function settings() {
  const requestRaw = String(process.env.HYPERAI_DAILY_REQUEST_LIMIT || "").trim();
  const costRaw = String(process.env.HYPERAI_DAILY_REPORTED_COST_USD || "").trim();
  if (!requestRaw && !costRaw) return { enabled: false };
  const requestLimit = requestRaw ? Number(requestRaw) : 0;
  const costUsd = costRaw ? Number(costRaw) : 0;
  if ((requestRaw && (!Number.isSafeInteger(requestLimit) || requestLimit < 1 || requestLimit > 1_000_000)) ||
      (costRaw && (!Number.isFinite(costUsd) || costUsd <= 0 || costUsd > 100_000))) return null;
  return { enabled: true, requestLimit, costLimitCents: costRaw ? Math.ceil(costUsd * 100) : 0 };
}

function redisConfig() {
  const rawUrl = String(process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!rawUrl || !token) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return { url: url.href.replace(/\/$/, ""), token };
  } catch { return null; }
}

async function command(config, args) {
  const response = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(2000)
  });
  if (!response.ok) throw new Error("Budget store unavailable");
  const payload = await response.json();
  if (payload?.error || payload?.result === undefined) throw new Error("Invalid budget store response");
  return payload.result;
}

function keys() {
  const day = new Date().toISOString().slice(0, 10);
  return {
    requests: `hyperai:budget:v1:requests:${day}`,
    cost: `hyperai:budget:v1:reported-cost-cents:${day}`
  };
}

const RESERVE_SCRIPT = `
local requests = tonumber(redis.call("GET", KEYS[1]) or "0")
local cost = tonumber(redis.call("GET", KEYS[2]) or "0")
local requestLimit = tonumber(ARGV[1])
local costLimit = tonumber(ARGV[2])
if requestLimit > 0 and requests >= requestLimit then return {0, requests, cost, "daily_request_limit"} end
if costLimit > 0 and cost >= costLimit then return {0, requests, cost, "reported_cost_limit"} end
requests = redis.call("INCR", KEYS[1])
redis.call("EXPIRE", KEYS[1], ARGV[3])
return {1, requests, cost, "ok"}
`;

const COST_SCRIPT = `
local total = redis.call("INCRBY", KEYS[1], ARGV[1])
redis.call("EXPIRE", KEYS[1], ARGV[2])
return total
`;

export async function reserveDailyBudget(route) {
  if (!productionLike()) return { allowed: true, enabled: false };
  const config = settings();
  if (config?.enabled === false) return { allowed: true, enabled: false };
  const redis = redisConfig();
  if (!config || !redis) {
    emitTelemetry("hyperai.budget.unavailable", { route, code: "budget_not_configured" });
    return { allowed: false, status: 503, code: "BUDGET_GUARD_UNAVAILABLE" };
  }
  try {
    const { requests, cost } = keys();
    const result = await command(redis, [
      "EVAL", RESERVE_SCRIPT, "2", requests, cost,
      String(config.requestLimit), String(config.costLimitCents), String(DAY_SECONDS)
    ]);
    if (!Array.isArray(result) || result.length < 4) throw new Error("Invalid budget result");
    if (Number(result[0]) !== 1) {
      const reason = String(result[3]);
      emitTelemetry("hyperai.budget.rejected", { route, code: reason });
      return { allowed: false, status: 429, code: reason === "reported_cost_limit" ? "DAILY_REPORTED_COST_LIMIT" : "DAILY_REQUEST_LIMIT" };
    }
    return { allowed: true, enabled: true, requests: Number(result[1]), reportedCostCents: Number(result[2]) };
  } catch {
    emitTelemetry("hyperai.budget.unavailable", { route, code: "redis_request_failed" });
    return { allowed: false, status: 503, code: "BUDGET_GUARD_UNAVAILABLE" };
  }
}

export async function recordReportedCost(costUsd, route) {
  if (!productionLike() || !Number.isFinite(costUsd) || costUsd <= 0) return false;
  const config = settings();
  if (!config || config.enabled === false || config.costLimitCents <= 0) return false;
  const redis = redisConfig();
  if (!redis) {
    emitTelemetry("hyperai.budget.unavailable", { route, code: "cost_store_not_configured" });
    return false;
  }
  try {
    const { cost } = keys();
    const cents = Math.max(1, Math.ceil(costUsd * 100));
    await command(redis, ["EVAL", COST_SCRIPT, "1", cost, String(cents), String(DAY_SECONDS)]);
    emitTelemetry("hyperai.budget.cost_recorded", { route, reported_cost: costUsd });
    return true;
  } catch {
    emitTelemetry("hyperai.budget.unavailable", { route, code: "cost_record_failed" });
    return false;
  }
}

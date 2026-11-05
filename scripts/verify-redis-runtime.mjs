import { randomUUID } from "node:crypto";
import process from "node:process";
import { RATE_LIMIT_SCRIPT } from "../lib/rate-limit.js";
import { ACQUIRE_SCRIPT, RELEASE_SCRIPT } from "../lib/concurrency.js";
import { CHECK_SCRIPT, FAILURE_SCRIPT, SUCCESS_SCRIPT } from "../lib/resilience.js";

const TIMEOUT_MS = 2_500;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateRedisConfig(redisUrl, redisToken) {
  assert(typeof redisUrl === "string" && redisUrl.trim(), "UPSTASH_REDIS_REST_URL is required.");
  assert(typeof redisToken === "string" && redisToken.trim(), "UPSTASH_REDIS_REST_TOKEN is required.");
  let url;
  try { url = new URL(redisUrl); }
  catch { throw new Error("Redis REST URL is invalid."); }
  assert(url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash,
    "Redis REST URL must be HTTPS without credentials, query, or fragment.");
  return { url: url.href.replace(/\/$/, ""), token: redisToken.trim() };
}

function assertArrayResult(result, expectedFirst, label) {
  assert(Array.isArray(result), `${label}: Redis returned an invalid result.`);
  assert(Number(result[0]) === expectedFirst, `${label}: unexpected state transition.`);
}

export async function runRedisRuntimeVerification({
  redisUrl,
  redisToken,
  fetchImpl = globalThis.fetch,
  onPass = () => {},
  timeoutMs = TIMEOUT_MS
} = {}) {
  const config = validateRedisConfig(redisUrl, redisToken);
  assert(typeof fetchImpl === "function", "A Fetch-compatible implementation is required.");

  async function command(parts) {
    const response = await fetchImpl(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(parts),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error(`Redis command returned HTTP ${response.status}.`);
    const payload = await response.json();
    if (payload?.error || payload?.result === undefined) throw new Error("Redis returned an invalid command response.");
    return payload.result;
  }

  const ping = await command(["PING"]);
  assert(ping === "PONG", "Redis PING did not return PONG.");
  onPass("Authenticated Redis REST connection");

  const prefix = `hyperai:security08:verify:${randomUUID()}`;
  const rateKeys = [`${prefix}:rate:ip`, `${prefix}:rate:global`];
  const concurrencyKeys = [`${prefix}:concurrency:global`, `${prefix}:concurrency:route`];
  const circuitKeys = [`${prefix}:circuit:state`, `${prefix}:circuit:failures`, `${prefix}:circuit:probe`];
  const cleanupKeys = [...rateKeys, ...concurrencyKeys, ...circuitKeys];
  const evalScript = (script, keys, args = []) =>
    command(["EVAL", script, String(keys.length), ...keys, ...args.map(String)]);

  let primaryError = null;
  try {
    const rateOne = await evalScript(RATE_LIMIT_SCRIPT, rateKeys, [2, 3, 5_000]);
    const rateTwo = await evalScript(RATE_LIMIT_SCRIPT, rateKeys, [2, 3, 5_000]);
    const rateBlocked = await evalScript(RATE_LIMIT_SCRIPT, rateKeys, [2, 3, 5_000]);
    assertArrayResult(rateOne, 1, "Rate-limit first request");
    assertArrayResult(rateTwo, 1, "Rate-limit second request");
    assertArrayResult(rateBlocked, 0, "Rate-limit ceiling");
    assert(Number(rateBlocked[1]) === 2, "Rate-limit counter did not reach its test ceiling.");
    onPass("Rate-limit Lua: atomic increments, TTL, and rejection");

    const leaseOne = randomUUID();
    const leaseBlocked = randomUUID();
    const leaseAfterRelease = randomUUID();
    const acquired = await evalScript(ACQUIRE_SCRIPT, concurrencyKeys, [5_000, 2, 1, leaseOne]);
    const rejected = await evalScript(ACQUIRE_SCRIPT, concurrencyKeys, [5_000, 2, 1, leaseBlocked]);
    const released = await evalScript(RELEASE_SCRIPT, concurrencyKeys, [leaseOne]);
    const reacquired = await evalScript(ACQUIRE_SCRIPT, concurrencyKeys, [5_000, 2, 1, leaseAfterRelease]);
    assertArrayResult(acquired, 1, "Concurrency acquire");
    assertArrayResult(rejected, 0, "Concurrency ceiling");
    assertArrayResult(released, 1, "Concurrency release");
    assertArrayResult(reacquired, 1, "Concurrency reacquire");
    await evalScript(RELEASE_SCRIPT, concurrencyKeys, [leaseAfterRelease]);
    onPass("Concurrency Lua: lease acquisition, ceiling, release, and reacquisition");

    const initial = await evalScript(CHECK_SCRIPT, [circuitKeys[0], circuitKeys[2]], [randomUUID(), 1_000]);
    assertArrayResult(initial, 1, "Circuit closed state");
    await evalScript(FAILURE_SCRIPT, circuitKeys, [5_000, 2, 30_000]);
    await evalScript(FAILURE_SCRIPT, circuitKeys, [5_000, 2, 30_000]);
    const opened = await evalScript(CHECK_SCRIPT, [circuitKeys[0], circuitKeys[2]], [randomUUID(), 1_000]);
    assertArrayResult(opened, 0, "Circuit open state");

    // Simulate elapsed cooldown without waiting on a live service.
    await command(["HSET", circuitKeys[0], "open_until", "1"]);
    const probe = await evalScript(CHECK_SCRIPT, [circuitKeys[0], circuitKeys[2]], [randomUUID(), 1_000]);
    const probeBlocked = await evalScript(CHECK_SCRIPT, [circuitKeys[0], circuitKeys[2]], [randomUUID(), 1_000]);
    assertArrayResult(probe, 1, "Circuit half-open probe");
    assertArrayResult(probeBlocked, 0, "Single half-open probe");
    await evalScript(SUCCESS_SCRIPT, circuitKeys);
    const reset = await evalScript(CHECK_SCRIPT, [circuitKeys[0], circuitKeys[2]], [randomUUID(), 1_000]);
    assertArrayResult(reset, 1, "Circuit reset");
    assert(Number(reset[1]) === 0, "Circuit did not return to its closed state.");
    onPass("Circuit-breaker Lua: threshold, open state, single probe, and reset");

    return { ok: true, checks: 4 };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await command(["DEL", ...cleanupKeys]);
      onPass("Temporary verification keys cleaned up");
    } catch {
      if (!primaryError) throw new Error("Redis verification passed but temporary-key cleanup failed.");
    }
  }
}

const invokedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).href : "";
if (invokedPath === import.meta.url) {
  try {
    const result = await runRedisRuntimeVerification({
      redisUrl: process.env.UPSTASH_REDIS_REST_URL,
      redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
      onPass: (label) => console.log(`PASS  ${label}`)
    });
    console.log(`\\nRedis runtime verification PASSED (${result.checks} groups).`);
  } catch (error) {
    console.error(`FAIL  Redis runtime verification: ${error?.message || "unknown error"}`);
    process.exitCode = 1;
  }
}

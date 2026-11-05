import test from "node:test";
import assert from "node:assert/strict";
import { fetchWithResilience, parseRetryAfter, resiliencePolicy } from "../lib/resilience.js";
import { withEnvironment, withFetch, jsonResponse } from "./helpers.js";

const redisEnv = {
  VERCEL_ENV: "production",
  NODE_ENV: "production",
  UPSTASH_REDIS_REST_URL: "https://redis.example",
  UPSTASH_REDIS_REST_TOKEN: "test-token"
};

function redisMock(commands) {
  return async (url, options) => {
    if (String(url).includes("redis.example")) {
      const command = JSON.parse(options.body);
      commands.push(command);
      if (command[1].includes('HGET')) return jsonResponse({ result: [1, 0] });
      return jsonResponse({ result: 1 });
    }
    throw new Error("Unexpected upstream call");
  };
}

test("resilience policy uses bounded retry and short circuit cooldown", () => {
  assert.equal(resiliencePolicy.maxRetries, 1);
  assert.equal(resiliencePolicy.failureThreshold, 5);
  assert.equal(resiliencePolicy.openDurationMs, 30_000);
});

test("Retry-After supports delta seconds and HTTP dates", () => {
  assert.equal(parseRetryAfter("0.5"), 500);
  assert.equal(parseRetryAfter("2"), 2000);
  assert.equal(parseRetryAfter("invalid"), null);
  assert.equal(parseRetryAfter("Wed, 21 Oct 2015 07:28:00 GMT", Date.parse("Wed, 21 Oct 2015 07:27:59 GMT")), 1000);
});

test("circuit breaker rejects an open provider before calling upstream", async () => {
  await withEnvironment(redisEnv, async () => {
    let upstreamCalls = 0;
    await withFetch(async (url, options) => {
      if (String(url).includes("redis.example")) return jsonResponse({ result: [0, 12] });
      upstreamCalls += 1;
      return jsonResponse({ ok: true });
    }, async () => {
      await assert.rejects(
        fetchWithResilience("https://openrouter.example/test", { method: "POST" }, { key: "model-a" }),
        (error) => error.status === 503 && error.code === "UPSTREAM_CIRCUIT_OPEN"
      );
      assert.equal(upstreamCalls, 0);
    });
  });
});

test("circuit breaker fails closed when Redis is not configured in production", async () => {
  await withEnvironment({ VERCEL_ENV: "production", NODE_ENV: "production", UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined }, async () => {
    let upstreamCalls = 0;
    await withFetch(async () => { upstreamCalls += 1; return jsonResponse({ ok: true }); }, async () => {
      await assert.rejects(
        fetchWithResilience("https://openrouter.example/test", { method: "POST" }, { key: "model-a" }),
        (error) => error.status === 503 && error.code === "RESILIENCE_UNAVAILABLE"
      );
      assert.equal(upstreamCalls, 0);
    });
  });
});

test("one bounded 429 retry honors Retry-After before reading response body", async () => {
  await withEnvironment(redisEnv, async () => {
    const commands = [];
    let upstreamCalls = 0;
    await withFetch(async (url, options) => {
      if (String(url).includes("redis.example")) {
        const command = JSON.parse(options.body);
        commands.push(command);
        if (command[1].includes("HGET")) return jsonResponse({ result: [1, 0] });
        return jsonResponse({ result: 1 });
      }
      upstreamCalls += 1;
      if (upstreamCalls === 1) return new Response("rate limited", { status: 429, headers: { "retry-after": "0" } });
      return jsonResponse({ ok: true });
    }, async () => {
      const response = await fetchWithResilience("https://openrouter.example/test", { method: "POST" }, { key: "model-a", retryRateLimit: true });
      assert.equal(response.status, 200);
      assert.equal(upstreamCalls, 2);
      assert.equal(commands.length, 2);
    });
  });
});

test("429 without a valid Retry-After is not retried", async () => {
  await withEnvironment(redisEnv, async () => {
    let upstreamCalls = 0;
    await withFetch(async (url, options) => {
      if (String(url).includes("redis.example")) {
        const command = JSON.parse(options.body);
        return command[1].includes("HGET") ? jsonResponse({ result: [1, 0] }) : jsonResponse({ result: 1 });
      }
      upstreamCalls += 1;
      return new Response("rate limited", { status: 429 });
    }, async () => {
      const response = await fetchWithResilience("https://openrouter.example/test", { method: "POST" }, { key: "model-a", retryRateLimit: true });
      assert.equal(response.status, 429);
      assert.equal(upstreamCalls, 1);
    });
  });
});

test("5xx responses are not automatically retried for POST operations", async () => {
  await withEnvironment(redisEnv, async () => {
    let upstreamCalls = 0;
    await withFetch(async (url, options) => {
      if (String(url).includes("redis.example")) {
        const command = JSON.parse(options.body);
        return command[1].includes("HGET") ? jsonResponse({ result: [1, 0] }) : jsonResponse({ result: 1 });
      }
      upstreamCalls += 1;
      return new Response("temporary failure", { status: 503, headers: { "retry-after": "0" } });
    }, async () => {
      const response = await fetchWithResilience("https://openrouter.example/test", { method: "POST" }, { key: "model-a", retryRateLimit: true });
      assert.equal(response.status, 503);
      assert.equal(upstreamCalls, 1);
    });
  });
});

test("local development bypasses distributed circuit coordination", async () => {
  await withEnvironment({ VERCEL_ENV: "development", NODE_ENV: "development", UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined }, async () => {
    let calls = 0;
    await withFetch(async () => { calls += 1; return jsonResponse({ ok: true }); }, async () => {
      const response = await fetchWithResilience("https://openrouter.example/test", { method: "POST" }, { key: "model-a" });
      assert.equal(response.status, 200);
      assert.equal(calls, 1);
    });
  });
});

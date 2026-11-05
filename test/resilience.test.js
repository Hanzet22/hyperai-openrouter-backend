import test from "node:test";
import assert from "node:assert/strict";
import { fetchWithResilience, parseRetryAfter, resiliencePolicy, recordResilienceOutcome } from "../lib/resilience.js";
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


test("five transient failures open the circuit and a failed half-open probe reopens it", async () => {
  await withEnvironment(redisEnv, async () => {
    let now = 100_000;
    let failures = 0;
    let openUntil = 0;
    let probeHeld = false;
    await withFetch(async (url, options) => {
      if (!String(url).includes("redis.example")) {
        return new Response("provider unavailable", { status: 503 });
      }
      const command = JSON.parse(options.body);
      const script = command[1];
      if (script.includes('HGET')) {
        if (openUntil > now) return jsonResponse({ result: [0, Math.ceil((openUntil - now) / 1000)] });
        if (openUntil > 0) {
          if (probeHeld) return jsonResponse({ result: [0, 5] });
          probeHeld = true;
          return jsonResponse({ result: [1, 1] });
        }
        return jsonResponse({ result: [1, 0] });
      }
      if (script.includes('INCR')) {
        failures += 1;
        const wasProbe = probeHeld;
        if (failures >= 5 || wasProbe) openUntil = now + 30_000;
        probeHeld = false;
        return jsonResponse({ result: failures });
      }
      if (script.includes('DEL')) {
        failures = 0;
        openUntil = 0;
        probeHeld = false;
        return jsonResponse({ result: 1 });
      }
      throw new Error("Unexpected Redis script");
    }, async () => {
      for (let i = 0; i < 5; i += 1) {
        const response = await fetchWithResilience("https://openrouter.example/test", { method: "POST" }, { key: "model-breaker" });
        assert.equal(response.status, 503);
      }
      await assert.rejects(
        fetchWithResilience("https://openrouter.example/test", { method: "POST" }, { key: "model-breaker" }),
        (error) => error.code === "UPSTREAM_CIRCUIT_OPEN"
      );

      now += 31_000;
      const probe = await fetchWithResilience("https://openrouter.example/test", { method: "POST" }, { key: "model-breaker" });
      assert.equal(probe.status, 503);
      await assert.rejects(
        fetchWithResilience("https://openrouter.example/test", { method: "POST" }, { key: "model-breaker" }),
        (error) => error.code === "UPSTREAM_CIRCUIT_OPEN"
      );
    });
  });
});


test("post-header stream failures can be recorded against the model circuit", async () => {
  await withEnvironment(redisEnv, async () => {
    let commandSeen = null;
    await withFetch(async (_url, options) => {
      commandSeen = JSON.parse(options.body);
      return jsonResponse({ result: 1 });
    }, async () => {
      await recordResilienceOutcome("model-stream", "failure");
      assert.match(commandSeen[1], /INCR/);
      assert.equal(commandSeen[2], "3");
      assert.equal(commandSeen[3], "hyperai:resilience:v1:circuit:" + commandSeen[3].split(":").at(-2) + ":state");
    });
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import moderate from "../api/moderate.js";
import { enforceRateLimit } from "../lib/rate-limit.js";
import { MockResponse, makeRequest, withEnvironment, withFetch } from "./helpers.js";

test("production rate limiting fails closed when Upstash is not configured", async () => {
  await withEnvironment({
    NODE_ENV: "production",
    UPSTASH_REDIS_REST_URL: undefined,
    UPSTASH_REDIS_REST_TOKEN: undefined
  }, async () => {
    const res = new MockResponse();
    const allowed = await enforceRateLimit(makeRequest({ headers: { "x-real-ip": "203.0.113.10" } }), res, "chat");
    assert.equal(allowed, false);
    assert.equal(res.statusCode, 503);
    assert.equal(res.json().error.code, "RATE_LIMIT_UNAVAILABLE");
  });
});

test("rate limiter sends an atomic EVAL request and stores only a hashed client IP", async () => {
  await withEnvironment({
    NODE_ENV: "production",
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io/",
    UPSTASH_REDIS_REST_TOKEN: "test-redis-token"
  }, async () => {
    let requestBody;
    let requestUrl;
    await withFetch(async (url, options) => {
      requestUrl = String(url);
      requestBody = JSON.parse(options.body);
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "Bearer test-redis-token");
      return new Response(JSON.stringify({ result: [1, 1, 1, 60000] }), {
        status: 200, headers: { "content-type": "application/json" }
      });
    }, async () => {
      const res = new MockResponse();
      const allowed = await enforceRateLimit(makeRequest({ headers: { "x-real-ip": "203.0.113.10" } }), res, "chat");
      assert.equal(allowed, true);
      assert.equal(res.getHeader("ratelimit-limit"), "8");
      assert.equal(res.getHeader("ratelimit-remaining"), "7");
    });

    assert.equal(requestUrl, "https://example.upstash.io");
    assert.equal(requestBody[0], "EVAL");
    assert.equal(requestBody[2], "2");
    assert.match(requestBody[3], /^hyperai:rl:v1:chat:[a-f0-9]{32}$/);
    assert.doesNotMatch(requestBody[3], /203\.0\.113\.10/);
    assert.equal(requestBody[4], "hyperai:rl:v1:global");
    assert.equal(requestBody[5], "8");
    assert.equal(requestBody[6], "120");
    assert.equal(requestBody[7], "60000");
  });
});

test("rate limiter returns 429 with Retry-After when a route limit is reached", async () => {
  await withEnvironment({
    NODE_ENV: "production",
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-redis-token"
  }, async () => {
    await withFetch(async () => new Response(JSON.stringify({ result: [0, 8, 1, 25000] }), {
      status: 200, headers: { "content-type": "application/json" }
    }), async () => {
      const res = new MockResponse();
      const allowed = await enforceRateLimit(makeRequest({ headers: { "x-real-ip": "203.0.113.11" } }), res, "chat");
      assert.equal(allowed, false);
      assert.equal(res.statusCode, 429);
      assert.equal(res.getHeader("retry-after"), "25");
      assert.equal(res.json().error.code, "RATE_LIMITED");
    });
  });
});

test("Redis errors fail closed instead of forwarding an unmetered request", async () => {
  await withEnvironment({
    NODE_ENV: "production",
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-redis-token"
  }, async () => {
    await withFetch(async () => new Response("unavailable", { status: 503 }), async () => {
      const res = new MockResponse();
      const allowed = await enforceRateLimit(makeRequest({ headers: { "x-real-ip": "203.0.113.12" } }), res, "chat");
      assert.equal(allowed, false);
      assert.equal(res.statusCode, 503);
      assert.equal(res.json().error.code, "RATE_LIMIT_UNAVAILABLE");
    });
  });
});

test("API route stops before contacting OpenRouter when the limiter blocks it", async () => {
  await withEnvironment({
    NODE_ENV: "production",
    OPENROUTER_API_KEY: "test-openrouter-key",
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-redis-token"
  }, async () => {
    let calls = 0;
    await withFetch(async () => {
      calls += 1;
      return new Response(JSON.stringify({ result: [0, 20, 120, 30000] }), {
        status: 200, headers: { "content-type": "application/json" }
      });
    }, async () => {
      const res = new MockResponse();
      await moderate(makeRequest({ body: { text: "neutral sample" }, headers: { "x-real-ip": "203.0.113.13" } }), res);
      assert.equal(res.statusCode, 429);
      assert.equal(res.json().error.code, "RATE_LIMITED");
      assert.equal(calls, 1);
    });
  });
});

test("production requests without Vercel's trusted client IP fail closed", async () => {
  await withEnvironment({
    NODE_ENV: "production",
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-redis-token"
  }, async () => {
    const res = new MockResponse();
    const allowed = await enforceRateLimit(makeRequest(), res, "chat");
    assert.equal(allowed, false);
    assert.equal(res.statusCode, 503);
    assert.equal(res.json().error.code, "RATE_LIMIT_UNAVAILABLE");
  });
});

test("Vercel Preview deployments enforce rate limiting even with development NODE_ENV", async () => {
  await withEnvironment({
    NODE_ENV: "development",
    VERCEL_ENV: "preview",
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-redis-token"
  }, async () => {
    await withFetch(async () => new Response(JSON.stringify({ result: [1, 1, 1, 60000] }), {
      status: 200, headers: { "content-type": "application/json" }
    }), async () => {
      const res = new MockResponse();
      const allowed = await enforceRateLimit(makeRequest({ headers: { "x-real-ip": "203.0.113.14" } }), res, "chat");
      assert.equal(allowed, true);
      assert.equal(res.getHeader("ratelimit-limit"), "8");
    });
  });
});

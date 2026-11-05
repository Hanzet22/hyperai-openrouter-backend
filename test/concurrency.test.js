import test from "node:test";
import assert from "node:assert/strict";
import { withUpstreamGuard } from "../lib/concurrency.js";
import { MockResponse, makeRequest, withEnvironment, withFetch, jsonResponse } from "./helpers.js";

const redisEnv = {
  VERCEL_ENV: "production",
  NODE_ENV: "production",
  UPSTASH_REDIS_REST_URL: "https://redis.example",
  UPSTASH_REDIS_REST_TOKEN: "test-token"
};

test("concurrency guard acquires and releases a distributed lease", async () => {
  await withEnvironment(redisEnv, async () => {
    const calls = [];
    await withFetch(async (_url, options) => {
      const command = JSON.parse(options.body);
      calls.push(command);
      return jsonResponse({ result: command[1].includes("ZREMRANGEBYSCORE") ? [1, 1, 1] : [1] });
    }, async () => {
      const res = new MockResponse();
      let observedSignal;
      await withUpstreamGuard(makeRequest(), res, "moderate", 1000, async (signal) => {
        observedSignal = signal;
        assert.equal(signal.aborted, false);
      });
      assert.equal(observedSignal.aborted, false);
      assert.equal(calls.length, 2);
      assert.match(calls[0][1], /ZREMRANGEBYSCORE/);
      assert.match(calls[1][1], /ZREM/);
    });
  });
});

test("concurrency guard rejects when the global or route ceiling is reached", async () => {
  await withEnvironment(redisEnv, async () => {
    let operationCalls = 0;
    await withFetch(async () => jsonResponse({ result: [0, 24, 8] }), async () => {
      const res = new MockResponse();
      await withUpstreamGuard(makeRequest(), res, "chat", 1000, async () => { operationCalls += 1; });
      assert.equal(res.statusCode, 429);
      assert.equal(res.json().error.code, "CONCURRENCY_LIMITED");
      assert.equal(res.getHeader("retry-after"), "5");
      assert.equal(operationCalls, 0);
    });
  });
});

test("concurrency guard fails closed when Redis configuration is missing", async () => {
  await withEnvironment({ VERCEL_ENV: "production", NODE_ENV: "production", UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined }, async () => {
    const res = new MockResponse();
    let operationCalls = 0;
    await withUpstreamGuard(makeRequest(), res, "chat", 1000, async () => { operationCalls += 1; });
    assert.equal(res.statusCode, 503);
    assert.equal(res.json().error.code, "CONCURRENCY_GUARD_UNAVAILABLE");
    assert.equal(operationCalls, 0);
  });
});

test("concurrency lease is released after upstream operation throws", async () => {
  await withEnvironment(redisEnv, async () => {
    let releaseCalls = 0;
    await withFetch(async (_url, options) => {
      const command = JSON.parse(options.body);
      if (command[1].includes("ZREMRANGEBYSCORE")) return jsonResponse({ result: [1, 1, 1] });
      releaseCalls += 1;
      return jsonResponse({ result: [1] });
    }, async () => {
      const res = new MockResponse();
      await assert.rejects(
        withUpstreamGuard(makeRequest(), res, "rerank", 1000, async () => { throw new Error("controlled failure"); }),
        /controlled failure/
      );
      assert.equal(releaseCalls, 1);
    });
  });
});

test("concurrency guard aborts upstream work when the client disconnects", async () => {
  await withEnvironment(redisEnv, async () => {
    await withFetch(async (_url, options) => {
      const command = JSON.parse(options.body);
      return jsonResponse({ result: command[1].includes("ZREMRANGEBYSCORE") ? [1, 1, 1] : [1] });
    }, async () => {
      const res = new MockResponse();
      let wasAborted = false;
      const pending = withUpstreamGuard(makeRequest(), res, "embeddings", 1000, async (signal) => {
        await new Promise((resolve) => signal.addEventListener("abort", () => { wasAborted = true; resolve(); }, { once: true }));
      });
      await new Promise((resolve) => setImmediate(resolve));
      res.destroy();
      await pending;
      assert.equal(wasAborted, true);
    });
  });
});

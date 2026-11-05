import test from "node:test";
import assert from "node:assert/strict";
import { runRedisRuntimeVerification } from "../scripts/verify-redis-runtime.mjs";

test("live Redis verifier validates credentials before network access", async () => {
  let calls = 0;
  await assert.rejects(
    runRedisRuntimeVerification({ redisUrl: "http://redis.example", redisToken: "test", fetchImpl: async () => { calls += 1; } }),
    /HTTPS/
  );
  await assert.rejects(
    runRedisRuntimeVerification({ redisUrl: "https://redis.example", redisToken: "", fetchImpl: async () => { calls += 1; } }),
    /TOKEN is required/
  );
  assert.equal(calls, 0);
});

test("live Redis verifier exercises every application Lua script and cleans up", async () => {
  const expected = [
    "PONG",
    [1, 1, 1, 5000], [1, 2, 2, 5000], [0, 2, 2, 4999],
    [1, 1, 1], [0, 1, 1], [1], [1, 1, 1],
    [1, 0], 1, 2, [0, 30], 0, [1, 1], [0, 5], 1, [1, 0], 7
  ];
  const calls = [];
  const passed = [];
  const result = await runRedisRuntimeVerification({
    redisUrl: "https://redis.example/",
    redisToken: "test-redis-token",
    onPass: (label) => passed.push(label),
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options, body: JSON.parse(options.body) });
      const next = expected.shift();
      assert.notEqual(next, undefined, "unexpected extra Redis command");
      return new Response(JSON.stringify({ result: next }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  assert.deepEqual(result, { ok: true, checks: 4 });
  assert.equal(expected.length, 0);
  assert.equal(calls.length, 18);
  assert.ok(calls.every((call) => call.url === "https://redis.example"));
  assert.ok(calls.every((call) => call.options.headers.Authorization === "Bearer test-redis-token"));
  assert.equal(calls[0].body[0], "PING");
  assert.equal(calls.at(-1).body[0], "DEL");
  assert.equal(passed.length, 5);
  const allKeys = calls.flatMap((call) => call.body.slice(3).filter((value) => typeof value === "string"));
  assert.ok(allKeys.every((value) => !value.includes("test-redis-token")));
});

test("live Redis verifier rejects Redis command errors without exposing credentials", async () => {
  await assert.rejects(
    runRedisRuntimeVerification({
      redisUrl: "https://redis.example",
      redisToken: "private-test-token",
      fetchImpl: async () => new Response(JSON.stringify({ error: "NOAUTH" }), { status: 200 })
    }),
    /invalid command response/i
  );
});

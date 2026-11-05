import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const ROUTES = ["chat", "decisions", "embeddings", "moderate", "rerank", "speech"];

test("release gate inventories exactly the six deployed API handlers", async () => {
  const files = await Promise.all(ROUTES.map((route) => read("../api/" + route + ".js")));
  for (const [index, source] of files.entries()) {
    assert.ok(source.includes('preparePost(req, res, "' + ROUTES[index] + '")'));
  }
  const config = JSON.parse(await read("../vercel.json"));
  const configured = Object.keys(config.functions).filter((path) => path !== "api/session.js").map((path) => path.slice(4, -3)).sort();
  assert.deepEqual(configured, [...ROUTES].sort());
  assert.equal(config.functions["api/session.js"].maxDuration, 10);
});

test("shared request boundary enforces method, AI kill switch, rate limit and body cap", async () => {
  const source = await read("../lib/openrouter.js");
  for (const fragment of [
    'req.method === "OPTIONS"', 'req.method !== "POST"', "METHOD_NOT_ALLOWED",
    "HYPERAI_AI_ENABLED", "AI_SERVICE_DISABLED", "MAX_REQUEST_BODY_BYTES = 256 * 1024",
    "REQUEST_BODY_TOO_LARGE", "enforceRateLimit(req, res, route)"
  ]) assert.ok(source.includes(fragment), "missing shared boundary: " + fragment);
});

test("all API routes keep upstream destinations server-controlled", async () => {
  const sources = await Promise.all(ROUTES.map((route) => read("../api/" + route + ".js")));
  for (const source of sources) {
    assert.ok(!source.includes("body.url"));
    assert.ok(!source.includes("body.targetUrl"));
    assert.ok(!source.includes("body.upstreamUrl"));
  }
  const shared = await read("../lib/openrouter.js");
  assert.ok(shared.includes('OPENROUTER_BASE = "https://openrouter.ai/api/v1"'));
  assert.ok(shared.includes("const targetUrl ="));
  const decisions = await read("../api/decisions.js");
  assert.ok(decisions.includes("https://openrouter.ai/api/alpha/decisions"));
});

test("rate limiting hashes client identifiers and fails closed", async () => {
  const source = await read("../lib/rate-limit.js");
  for (const fragment of ['createHash("sha256")', "hyperai:rl:v1:", "RATE_LIMIT_UNAVAILABLE", "res.statusCode = 503", "AbortSignal.timeout(2500)"]) {
    assert.ok(source.includes(fragment), "missing rate-limit control: " + fragment);
  }
  for (const route of ROUTES) assert.ok(source.includes(route + ":"));
});

test("distributed concurrency protection fails closed and uses expiring leases", async () => {
  const source = await read("../lib/concurrency.js");
  for (const fragment of ["withUpstreamGuard", "CONCURRENCY_GUARD_UNAVAILABLE", "LEASE_MS = 70_000", "ZREMRANGEBYSCORE", "PEXPIRE"]) {
    assert.ok(source.includes(fragment), "missing concurrency control: " + fragment);
  }
  for (const route of ROUTES) assert.ok(source.includes(route + ":"));
});

test("upstream resilience has bounded retry and circuit-breaker controls", async () => {
  const source = await read("../lib/resilience.js");
  for (const fragment of ["FAILURE_THRESHOLD = 5", "FAILURE_WINDOW_MS = 30_000", "OPEN_DURATION_MS = 30_000", "MAX_RETRIES = 1", "MAX_RETRY_AFTER_MS = 1_000", "UPSTREAM_CIRCUIT_OPEN", "RESILIENCE_UNAVAILABLE"]) {
    assert.ok(source.includes(fragment), "missing resilience control: " + fragment);
  }
});

test("chat request limits and output-token ceiling remain bounded", async () => {
  const source = await read("../api/chat.js");
  for (const fragment of ["MAX_MESSAGES = 80", "MAX_MESSAGE_CHARS = 30_000", "MAX_TOTAL_CHARS = 120_000", "MAX_CHAT_OUTPUT_TOKENS = 2048", "CHAT_MODELS = new Map", "MODEL_NOT_ALLOWLISTED"]) {
    assert.ok(source.includes(fragment), "missing chat control: " + fragment);
  }
});

test("specialized routes retain bounded payload contracts", async () => {
  const decisions = await read("../api/decisions.js");
  const embeddings = await read("../api/embeddings.js");
  const moderate = await read("../api/moderate.js");
  const rerank = await read("../api/rerank.js");
  for (const [source, fragments] of [
    [decisions, ["entries.length > 20", "60_000", "90_000"]],
    [embeddings, ["inputs.length > 16", "20_000", "60_000"]],
    [moderate, ["text.length > 20_000"]],
    [rerank, ["documents.length > 40", "20_000", "100_000"]]
  ]) for (const fragment of fragments) assert.ok(source.includes(fragment), "missing route limit: " + fragment);
});

test("speech endpoint caps input and buffered audio response", async () => {
  const source = await read("../api/speech.js");
  for (const fragment of ["input.length > 4000", "MAX_AUDIO_RESPONSE_BYTES = 8 * 1024 * 1024", "reader.cancel()", 'contentType.startsWith("audio/")']) {
    assert.ok(source.includes(fragment), "missing speech limit: " + fragment);
  }
});

test("deployment configuration retains the security header baseline", async () => {
  const config = JSON.parse(await read("../vercel.json"));
  const headers = config.headers.flatMap((entry) => entry.headers);
  const values = Object.fromEntries(headers.map(({ key, value }) => [key.toLowerCase(), value]));
  assert.equal(values["x-content-type-options"], "nosniff");
  assert.equal(values["x-frame-options"], "DENY");
  assert.equal(values["referrer-policy"], "strict-origin-when-cross-origin");
  assert.ok(values["strict-transport-security"].includes("max-age=31536000"));
  assert.ok(values["permissions-policy"]);
});

test("deployment verifier inventories six OPTIONS routes and Redis PING", async () => {
  const source = await read("../scripts/verify-deployment.mjs");
  for (const route of ROUTES) assert.ok(source.includes('"' + route + '"'));
  assert.ok(source.includes('method: "OPTIONS"'));
  assert.ok(source.includes('"PING"'));
  assert.ok(source.includes("X-Request-Id"));
  assert.ok(source.includes("strict-transport-security"));
});

test("release gate retains dependency-free and SHA-pinned CI baseline", async () => {
  const manifest = JSON.parse(await read("../package.json"));
  assert.deepEqual(Object.keys(manifest.dependencies || {}), []);
  assert.deepEqual(Object.keys(manifest.devDependencies || {}), []);
  const workflow = await read("../.github/workflows/baseline-tests.yml");
  const refs = workflow.split("\n").filter((line) => line.includes("uses:")).map((line) => line.trim().split("uses:")[1].split("#")[0].trim());
  assert.ok(refs.length >= 2);
  for (const ref of refs) {
    const at = ref.lastIndexOf("@");
    assert.ok(at > 0 && /^[a-f0-9]{40}$/.test(ref.slice(at + 1)), "action must be pinned to a full SHA: " + ref);
  }
  assert.ok(workflow.includes("node-version: 22"));
  assert.ok(workflow.includes("npm test"));
});

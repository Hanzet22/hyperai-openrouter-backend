import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const ROUTES = ["chat", "decisions", "embeddings", "moderate", "rerank", "speech"];

test("release gate inventories exactly the six deployed API handlers", async () => {
  const files = await Promise.all(ROUTES.map((route) => read("../api/" + route + ".js")));
  for (const [index, source] of files.entries()) {
    const route = ROUTES[index];
    assert.match(source, new RegExp("preparePost\\\\(req, res, \\"" + route + "\\"\\\\)"), route + " must use shared request policy");
  }
  const config = JSON.parse(await read("../vercel.json"));
  const configured = Object.keys(config.functions).map((path) => path.replace(/^api\\\\//, "").replace(/\\\\.js$/, "")).sort();
  assert.deepEqual(configured, [...ROUTES].sort(), "Vercel function inventory must match the API route inventory");
});

test("shared request boundary enforces POST, OPTIONS preflight, AI kill switch and request body cap", async () => {
  const source = await read("../lib/openrouter.js");
  assert.match(source, /req\\\\.method === "OPTIONS"/);
  assert.match(source, /req\\\\.method !== "POST"/);
  assert.match(source, /"METHOD_NOT_ALLOWED"/);
  assert.match(source, /HYPERAI_AI_ENABLED/);
  assert.match(source, /"AI_SERVICE_DISABLED"/);
  assert.match(source, /MAX_REQUEST_BODY_BYTES = 256 \\\\* 1024/);
  assert.match(source, /"REQUEST_BODY_TOO_LARGE"/);
  assert.match(source, /enforceRateLimit\\\\(req, res, route\\\\)/);
});

test("all API routes keep upstream destinations server-controlled", async () => {
  const sources = await Promise.all(ROUTES.map((route) => read("../api/" + route + ".js")));
  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(source, /body\\\\.(?:url|targetUrl|upstreamUrl)\\\\b/, ROUTES[index] + " must not accept an upstream URL");
  }
  const shared = await read("../lib/openrouter.js");
  assert.match(shared, /https:\\\\/\\\\/openrouter\\\\.ai\\\\/api\\\\/v1/);
  assert.match(shared, /const targetUrl =/);
  const decisions = await read("../api/decisions.js");
  assert.match(decisions, /https:\\\\/\\\\/openrouter\\\\.ai\\\\/api\\\\/alpha\\\\/decisions/);
});

test("rate limiting uses hashed client identifiers and fails closed", async () => {
  const source = await read("../lib/rate-limit.js");
  assert.match(source, /createHash\\\\("sha256"\\\\)/);
  assert.match(source, /hyperai:rl:v1:/);
  assert.match(source, /RATE_LIMIT_UNAVAILABLE/);
  assert.match(source, /res\\\\.statusCode = 503/);
  assert.match(source, /AbortSignal\\\\.timeout\\\\(2500\\\\)/);
  for (const route of ROUTES) assert.match(source, new RegExp("\\\\b" + route + ":\\\\s*\\\\d+"));
});

test("distributed concurrency protection fails closed and uses expiring leases", async () => {
  const source = await read("../lib/concurrency.js");
  assert.match(source, /withUpstreamGuard/);
  assert.match(source, /CONCURRENCY_GUARD_UNAVAILABLE/);
  assert.match(source, /LEASE_MS = 70_000/);
  assert.match(source, /ZREMRANGEBYSCORE/);
  assert.match(source, /PEXPIRE/);
  for (const route of ROUTES) assert.match(source, new RegExp("\\\\b" + route + ":\\\\s*\\\\d+"));
});

test("upstream resilience has bounded retry and circuit-breaker controls", async () => {
  const source = await read("../lib/resilience.js");
  assert.match(source, /FAILURE_THRESHOLD = 5/);
  assert.match(source, /FAILURE_WINDOW_MS = 30_000/);
  assert.match(source, /OPEN_DURATION_MS = 30_000/);
  assert.match(source, /MAX_RETRIES = 1/);
  assert.match(source, /MAX_RETRY_AFTER_MS = 1_000/);
  assert.match(source, /UPSTREAM_CIRCUIT_OPEN/);
  assert.match(source, /RESILIENCE_UNAVAILABLE/);
});

test("chat request limits and output-token ceiling remain bounded", async () => {
  const source = await read("../api/chat.js");
  assert.match(source, /MAX_MESSAGES = 80/);
  assert.match(source, /MAX_MESSAGE_CHARS = 30_000/);
  assert.match(source, /MAX_TOTAL_CHARS = 120_000/);
  assert.match(source, /MAX_CHAT_OUTPUT_TOKENS = 2048/);
  assert.match(source, /CHAT_MODELS = new Map/);
  assert.match(source, /MODEL_NOT_ALLOWLISTED/);
});

test("specialized routes retain bounded payload contracts", async () => {
  const decisions = await read("../api/decisions.js");
  const embeddings = await read("../api/embeddings.js");
  const moderate = await read("../api/moderate.js");
  const rerank = await read("../api/rerank.js");
  assert.match(decisions, /entries\\\\.length > 20/);
  assert.match(decisions, /60_000/);
  assert.match(decisions, /90_000/);
  assert.match(embeddings, /inputs\\\\.length > 16/);
  assert.match(embeddings, /20_000/);
  assert.match(embeddings, /60_000/);
  assert.match(moderate, /text\\\\.length > 20_000/);
  assert.match(rerank, /documents\\\\.length > 40/);
  assert.match(rerank, /20_000/);
  assert.match(rerank, /100_000/);
});

test("speech endpoint caps input and buffered audio response", async () => {
  const source = await read("../api/speech.js");
  assert.match(source, /input\\\\.length > 4000/);
  assert.match(source, /MAX_AUDIO_RESPONSE_BYTES = 8 \\\\* 1024 \\\\* 1024/);
  assert.match(source, /reader\\\\.cancel\\\\(\\\\)/);
  assert.match(source, /contentType\\\\.startsWith\\\\("audio\\\\/"\\\\)/);
});

test("deployment configuration retains the security header baseline", async () => {
  const config = JSON.parse(await read("../vercel.json"));
  const headers = config.headers.flatMap((entry) => entry.headers);
  const values = Object.fromEntries(headers.map(({ key, value }) => [key.toLowerCase(), value]));
  assert.equal(values["x-content-type-options"], "nosniff");
  assert.equal(values["x-frame-options"], "DENY");
  assert.equal(values["referrer-policy"], "strict-origin-when-cross-origin");
  assert.match(values["strict-transport-security"], /max-age=31536000/);
  assert.ok(values["permissions-policy"]);
});

test("deployment verifier checks six OPTIONS routes and Redis PING without API POST probes", async () => {
  const source = await read("../scripts/verify-deployment.mjs");
  for (const route of ROUTES) assert.ok(source.includes("\\"" + route + "\\""));
  assert.match(source, /method: "OPTIONS"/);
  assert.match(source, /\\\\["PING"\\\\]/);
  assert.match(source, /X-Request-Id/);
  assert.match(source, /strict-transport-security/);
});

test("release gate retains dependency-free and SHA-pinned CI baseline", async () => {
  const manifest = JSON.parse(await read("../package.json"));
  assert.deepEqual(Object.keys(manifest.dependencies || {}), []);
  assert.deepEqual(Object.keys(manifest.devDependencies || {}), []);
  const workflow = await read("../.github/workflows/baseline-tests.yml");
  const refs = [...workflow.matchAll(/^\\\\s+uses:\\\\s+([^\\\\s]+)$/gm)].map((match) => match[1]);
  assert.ok(refs.length >= 2);
  for (const ref of refs) assert.match(ref, /@[a-f0-9]{40}$/);
  assert.match(workflow, /node-version:\\\\s*22/);
  assert.match(workflow, /npm test/);
});

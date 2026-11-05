import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";
import { extractUpstreamMessage, mapUpstreamFailure } from "../lib/openrouter.js";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

function rendererSource() {
  const start = html.indexOf("function appendInline(parent, value)");
  const end = html.indexOf("function createMessage(", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return html.slice(start, end);
}

test("message rendering uses DOM nodes rather than HTML string sinks", () => {
  const source = rendererSource();
  assert.match(source, /document\.createElement/);
  assert.match(source, /document\.createTextNode/);
  assert.match(source, /textContent/);
  assert.match(source, /replaceChildren/);
  assert.doesNotMatch(html, /\.innerHTML\s*=/);
  assert.doesNotMatch(html, /insertAdjacentHTML|outerHTML\s*=/);
});

test("auto-links validate HTTP(S) URLs and reject credentials", () => {
  const source = rendererSource();
  assert.match(source, /parsedUrl\.protocol === "http:"/);
  assert.match(source, /parsedUrl\.protocol === "https:"/);
  assert.match(source, /!parsedUrl\.username && !parsedUrl\.password/);
  assert.match(source, /noopener noreferrer/);
});

test("code block language metadata is bounded and assigned as an attribute", () => {
  const source = rendererSource();
  assert.match(source, /slice\(0, 40\)/);
  assert.match(source, /setAttribute\("data-language", codeLanguage\)/);
  assert.match(source, /code\.textContent = codeLines\.join/);
});

test("dynamic error and abort messages are inserted as text", () => {
  const source = rendererSource();
  assert.match(source, /showErrorMessage/);
  assert.match(source, /showAbortMessage/);
  assert.match(source, /paragraph\.append\(strong, document\.createTextNode/);
});

test("API route upstream targets are not selected from request fields", async () => {
  const files = ["chat", "decisions", "embeddings", "moderate", "rerank", "speech"];
  for (const name of files) {
    const source = await readFile(new URL(`../api/${name}.js`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /body\.(?:url|targetUrl|upstreamUrl)\b/);
  }
});

test("inline browser JavaScript parses without syntax errors", () => {
  const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => !/\bsrc\s*=/.test(match[1]) && match[2].trim());
  assert.ok(blocks.length > 0, "expected at least one inline script");
  for (const [index, match] of blocks.entries()) {
    new Script(match[2], { filename: `public/index.html:inline-${index + 1}` });
  }
});

test("upstream error bodies are not reflected to API clients", () => {
  const secretLikePayload = JSON.stringify({
    error: { message: "provider internal trace with Authorization: Bearer example-secret-token" }
  });
  const message = extractUpstreamMessage(secretLikePayload, 429);
  assert.equal(message, "OpenRouter request failed (HTTP 429).");
  assert.doesNotMatch(message, /internal trace|Authorization|example-secret-token/);
});

test("transport failures map to a trusted public error allowlist", () => {
  const secretError = Object.assign(
    new Error("request failed for https://internal.example with Authorization: Bearer secret-token"),
    { status: 401, code: "UNTRUSTED_PROVIDER_ERROR" }
  );
  const mapped = mapUpstreamFailure(secretError);
  assert.deepEqual(mapped, {
    status: 502,
    message: "OpenRouter connection failed.",
    code: "UPSTREAM_CONNECTION_FAILED"
  });
  assert.doesNotMatch(JSON.stringify(mapped), /internal\.example|Authorization|secret-token|401/);
});

test("known internal resilience failures retain safe status and messages", () => {
  assert.deepEqual(mapUpstreamFailure({ code: "RESILIENCE_UNAVAILABLE", message: "secret" }), {
    status: 503,
    message: "Upstream resilience protection is temporarily unavailable.",
    code: "RESILIENCE_UNAVAILABLE"
  });
  assert.deepEqual(mapUpstreamFailure({ code: "UPSTREAM_CIRCUIT_OPEN", message: "secret" }), {
    status: 503,
    message: "The upstream provider is temporarily cooling down. Please retry later.",
    code: "UPSTREAM_CIRCUIT_OPEN"
  });
  assert.equal(mapUpstreamFailure({ code: "UPSTREAM_TIMEOUT" }).status, 504);
});

test("chat stream errors do not forward raw provider messages", async () => {
  const source = await readFile(new URL("../api/chat.js", import.meta.url), "utf8");
  assert.match(source, /OpenRouter stream failed\. Please retry later\./);
  assert.doesNotMatch(source, /String\(message\)\.slice\(0, 1000\)/);
  assert.doesNotMatch(source, /OpenRouter connection failed:.*error\?\.message/s);
});

test("supply-chain baseline has no undeclared runtime or development packages", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(manifest.dependencies || {}), []);
  assert.deepEqual(Object.keys(manifest.devDependencies || {}), []);
});

test("GitHub Actions third-party actions are pinned to full commit SHAs", async () => {
  const workflow = await readFile(new URL("../.github/workflows/baseline-tests.yml", import.meta.url), "utf8");
  const actionRefs = [...workflow.matchAll(/^\s+uses:\s+([^\s]+)$/gm)].map((match) => match[1]);
  assert.ok(actionRefs.length > 0, "expected at least one pinned workflow action");
  for (const ref of actionRefs) {
    assert.match(ref, /@[a-f0-9]{40}$/, `workflow action must be pinned to a full SHA: ${ref}`);
  }
});


test("all six API routes enter through the shared POST, origin, and rate-limit gate", async () => {
  const routes = ["chat", "decisions", "embeddings", "moderate", "rerank", "speech"];
  for (const route of routes) {
    const source = await readFile(new URL(`../api/${route}.js`, import.meta.url), "utf8");
    assert.match(source, new RegExp(`preparePost\\\\(req,\\\\s*res,\\\\s*["']${route}["']\\\\)`), `${route} must use preparePost`);
  }
});

test("every upstream route is protected by the shared concurrency guard", async () => {
  const directGuardRoutes = ["chat", "speech"];
  const forwardedRoutes = ["decisions", "embeddings", "moderate", "rerank"];
  for (const route of directGuardRoutes) {
    const source = await readFile(new URL(`../api/${route}.js`, import.meta.url), "utf8");
    assert.match(source, /withUpstreamGuard\\(/, `${route} must acquire a concurrency lease`);
  }
  for (const route of forwardedRoutes) {
    const source = await readFile(new URL(`../api/${route}.js`, import.meta.url), "utf8");
    assert.match(source, /forwardJson\\(/, `${route} must use the guarded JSON forwarder`);
  }
  const shared = await readFile(new URL("../lib/openrouter.js", import.meta.url), "utf8");
  assert.match(shared, /export async function forwardJson[\\s\\S]*?return withUpstreamGuard\\(/);
});

test("production rate limiting fails closed when Redis configuration is unavailable", async () => {
  const source = await readFile(new URL("../lib/rate-limit.js", import.meta.url), "utf8");
  assert.match(source, /deploymentEnvironment === "production" \\|\\| deploymentEnvironment === "preview"/);
  assert.match(source, /if \\(!routeLimit \\|\\| !ip \\|\\| !config\\) return unavailable/);
  assert.match(source, /RATE_LIMIT_UNAVAILABLE/);
});

test("deployment security headers are present in Vercel configuration", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const headers = config.headers.find((entry) => entry.source === "/(.*)")?.headers || [];
  const values = new Map(headers.map(({ key, value }) => [key.toLowerCase(), value]));
  assert.equal(values.get("x-content-type-options"), "nosniff");
  assert.equal(values.get("x-frame-options"), "DENY");
  assert.equal(values.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(values.get("strict-transport-security") || "", /max-age=31536000/);
  assert.match(values.get("permissions-policy") || "", /camera=\\(\\)/);
});

test("all six API routes have explicit Vercel function duration configuration", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  for (const route of ["chat", "decisions", "embeddings", "moderate", "rerank", "speech"]) {
    assert.ok(Number.isInteger(config.functions?.[`api/${route}.js`]?.maxDuration), `${route} maxDuration must be explicit`);
  }
});

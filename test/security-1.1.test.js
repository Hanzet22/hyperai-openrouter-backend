import test from "node:test";
import assert from "node:assert/strict";
import { handleSession, hasValidSession, requireSession } from "../lib/auth.js";
import { readUpstreamText } from "../lib/openrouter.js";
import { MockResponse, makeRequest, withEnvironment } from "./helpers.js";

const PASSWORD = "test-only-hyperai-passphrase";
const SECRET = "test-only-session-secret-at-least-32-bytes";

test("shared-password session issues an HttpOnly signed cookie and accepts it", async () => {
  await withEnvironment({
    HYPERAI_AUTH_REQUIRED: "true",
    HYPERAI_ACCESS_PASSWORD: PASSWORD,
    HYPERAI_SESSION_SECRET: SECRET,
    ALLOWED_ORIGIN: "https://hyperai.test",
    NODE_ENV: "test"
  }, async () => {
    const loginReq = makeRequest({
      method: "POST",
      body: { password: PASSWORD },
      headers: { origin: "https://hyperai.test", host: "hyperai.test" }
    });
    const loginRes = new MockResponse();
    await handleSession(loginReq, loginRes);
    assert.equal(loginRes.statusCode, 200);
    assert.equal(loginRes.json().authenticated, true);
    const cookie = String(loginRes.getHeader("set-cookie") || "");
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
    const token = cookie.split(";")[0];
    const sessionReq = makeRequest({ method: "GET", headers: { cookie: token } });
    assert.equal(hasValidSession(sessionReq, SECRET), true);
    const protectedRes = new MockResponse();
    assert.equal(await requireSession(sessionReq, protectedRes), true);
  });
});

test("invalid password, invalid origin, and tampered session fail closed", async () => {
  await withEnvironment({
    HYPERAI_AUTH_REQUIRED: "true",
    HYPERAI_ACCESS_PASSWORD: PASSWORD,
    HYPERAI_SESSION_SECRET: SECRET,
    ALLOWED_ORIGIN: "https://hyperai.test",
    NODE_ENV: "test"
  }, async () => {
    const badOrigin = new MockResponse();
    await handleSession(makeRequest({ method: "POST", body: { password: PASSWORD }, headers: { origin: "https://attacker.test", host: "hyperai.test" } }), badOrigin);
    assert.equal(badOrigin.statusCode, 403);

    const badPassword = new MockResponse();
    await handleSession(makeRequest({ method: "POST", body: { password: "incorrect-password" }, headers: { origin: "https://hyperai.test", host: "hyperai.test" } }), badPassword);
    assert.equal(badPassword.statusCode, 401);

    const denied = new MockResponse();
    const req = makeRequest({ method: "POST", headers: { cookie: "__Host-hyperai_session=not-a-valid-signature" } });
    assert.equal(await requireSession(req, denied), false);
    assert.equal(denied.statusCode, 401);
  });
});

test("auth-required mode fails closed when its secrets are missing or too short", async () => {
  await withEnvironment({ HYPERAI_AUTH_REQUIRED: "true", HYPERAI_ACCESS_PASSWORD: "short", HYPERAI_SESSION_SECRET: undefined }, async () => {
    const res = new MockResponse();
    assert.equal(await requireSession(makeRequest(), res), false);
    assert.equal(res.statusCode, 503);
    assert.equal(res.json().error.code, "AUTH_NOT_CONFIGURED");
  });
});

test("upstream response reader accepts bounded text and rejects oversized payloads", async () => {
  const ok = await readUpstreamText(new Response("small"), 16);
  assert.equal(ok, "small");
  await assert.rejects(
    () => readUpstreamText(new Response("this response is too large"), 8),
    (error) => error.code === "UPSTREAM_RESPONSE_TOO_LARGE"
  );
});

test("session endpoint is included in the Redis login-attempt rate-limit policy", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../lib/rate-limit.js", import.meta.url), "utf8");
  assert.match(source, /session:\s*6/);
});

test("auth and budget controls are connected to the shared upstream path", async () => {
  const auth = await readFile(new URL("../lib/auth.js", import.meta.url), "utf8");
  const shared = await readFile(new URL("../lib/openrouter.js", import.meta.url), "utf8");
  const concurrency = await readFile(new URL("../lib/concurrency.js", import.meta.url), "utf8");
  const budget = await readFile(new URL("../lib/budget.js", import.meta.url), "utf8");
  assert.match(shared, /requireSession\(req, res\)/);
  assert.match(auth, /createHmac/);
  assert.match(auth, /timingSafeEqual/);
  assert.match(auth, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(auth, /enforceRateLimit\(req, res, "session"\)/);
  assert.match(concurrency, /reserveDailyBudget\(route\)/);
  assert.match(shared, /recordReportedCost\(reportedCost, route\)/);
  assert.match(budget, /DAILY_REPORTED_COST_LIMIT/);
});

test("frontend provides a password input and obtains a session before chat requests", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /async function ensureAccessSession\(\)/);
  assert.match(html, /fetch\("\/api\/session"/);
  assert.match(html, /input\.type = "password"/);
  assert.match(html, /await ensureAccessSession\(\)/);
  assert.doesNotMatch(html, /localStorage\.setItem\([^\n]*(?:password|token)/i);
});

test("CSP is report-only while inline-script migration remains pending", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const headers = config.headers.find((entry) => entry.source === "/(.*)")?.headers || [];
  const csp = headers.find((entry) => entry.key.toLowerCase() === "content-security-policy-report-only");
  assert.ok(csp);
  assert.match(csp.value, /object-src 'none'/);
  assert.match(csp.value, /frame-ancestors 'none'/);
  assert.ok(!headers.some((entry) => entry.key.toLowerCase() === "content-security-policy"));
  assert.equal(config.functions["api/session.js"].maxDuration, 10);
});

test("budget guard is optional until explicitly configured and is fail-closed on Redis errors", async () => {
  const { reserveDailyBudget } = await import("../lib/budget.js");
  await withEnvironment({ NODE_ENV: "test", VERCEL_ENV: undefined, HYPERAI_DAILY_REQUEST_LIMIT: "50" }, async () => {
    const result = await reserveDailyBudget("chat");
    assert.equal(result.allowed, true);
    assert.equal(result.enabled, false);
  });
  const source = await readFile(new URL("../lib/budget.js", import.meta.url), "utf8");
  assert.match(source, /BUDGET_GUARD_UNAVAILABLE/);
  assert.match(source, /DAILY_REQUEST_LIMIT/);
});

import process from "node:process";

const BASE_URL = String(process.env.HYPERAI_BASE_URL || "").trim();
const REDIS_URL = String(process.env.UPSTASH_REDIS_REST_URL || "").trim();
const REDIS_TOKEN = String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
const TEST_ORIGIN = String(process.env.HYPERAI_TEST_ORIGIN || "").trim();
const ROUTES = ["chat", "decisions", "embeddings", "moderate", "rerank", "speech"];
const TIMEOUT_MS = 8_000;

function fail(message) {
  console.error(`FAIL  ${message}`);
  failures += 1;
}

function pass(message) {
  console.log(`PASS  ${message}`);
}

let failures = 0;

function validHttpsUrl(value, label) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      throw new Error("must be an HTTPS URL without credentials, query, or fragment");
    }
    return url;
  } catch (error) {
    fail(`${label}: ${error.message}`);
    return null;
  }
}

async function fetchWithTimeout(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "manual" });
}

async function checkRedis() {
  if (!REDIS_URL || !REDIS_TOKEN) {
    fail("Redis credentials are missing (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).");
    return;
  }

  const redis = validHttpsUrl(REDIS_URL, "Redis REST URL");
  if (!redis) return;

  try {
    const response = await fetchWithTimeout(redis, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(["PING"])
    });
    if (!response.ok) {
      fail(`Redis PING returned HTTP ${response.status}.`);
      return;
    }
    const payload = await response.json();
    if (payload?.error || payload?.result !== "PONG") {
      fail("Redis PING did not return PONG.");
      return;
    }
    pass("Upstash Redis REST authenticated and PING returned PONG.");
  } catch (error) {
    fail(`Redis PING failed: ${error.name || "Error"}.`);
  }
}

async function checkDeployment() {
  if (!BASE_URL) {
    fail("HYPERAI_BASE_URL is required (for example, the production HTTPS deployment URL).");
    return;
  }
  const base = validHttpsUrl(BASE_URL, "HyperAI base URL");
  if (!base) return;
  const origin = TEST_ORIGIN ? new URL(TEST_ORIGIN).origin : null;

  try {
    const response = await fetchWithTimeout(base, { method: "GET" });
    if (response.status !== 200) fail(`Homepage returned HTTP ${response.status}; expected 200.`);
    else pass("Homepage returned HTTP 200.");
    await response.body?.cancel();

    const requiredHeaders = [
      ["x-content-type-options", "nosniff"],
      ["x-frame-options", "DENY"],
      ["referrer-policy", "strict-origin-when-cross-origin"]
    ];
    for (const [name, expected] of requiredHeaders) {
      const actual = response.headers.get(name);
      if (actual?.toLowerCase() !== expected.toLowerCase()) fail(`Missing/incorrect ${name} header.`);
      else pass(`${name} is configured.`);
    }

    const hsts = response.headers.get("strict-transport-security") || "";
    if (!/max-age=31536000/i.test(hsts)) fail("HSTS max-age=31536000 was not found.");
    else pass("HSTS max-age is at least one year.");

    if (!response.headers.get("permissions-policy")) fail("Permissions-Policy header is missing.");
    else pass("Permissions-Policy header is present.");
  } catch (error) {
    fail(`Homepage check failed: ${error.name || "Error"}.`);
  }

  for (const route of ROUTES) {
    try {
      const headers = origin ? { Origin: origin } : {};
      const response = await fetchWithTimeout(new URL(`/api/${route}`, base), {
        method: "OPTIONS",
        headers
      });
      await response.body?.cancel();
      if (response.status !== 204) {
        fail(`/api/${route} OPTIONS returned HTTP ${response.status}; expected 204.`);
        continue;
      }
      if (!response.headers.get("x-request-id")) {
        fail(`/api/${route} did not return X-Request-Id.`);
        continue;
      }
      if (origin && response.headers.get("access-control-allow-origin") !== origin) {
        fail(`/api/${route} did not allow the configured test origin.`);
        continue;
      }
      pass(`/api/${route} preflight returned 204 with request ID.`);
    } catch (error) {
      fail(`/api/${route} preflight failed: ${error.name || "Error"}.`);
    }
  }
}

console.log("HyperAI Security 0.6 — Deployment Readiness Verification");
console.log("This check uses homepage GET, API OPTIONS, and Redis PING only.");
console.log("It does not submit prompts, invoke AI generation, or perform load testing.");

await checkRedis();
await checkDeployment();

if (failures > 0) {
  console.error(`\nReadiness check FAILED: ${failures} check(s) need attention.`);
  process.exitCode = 1;
} else {
  console.log("\nReadiness check PASSED.");
}

import test from "node:test";
import assert from "node:assert/strict";
import decisions from "../api/decisions.js";
import embeddings from "../api/embeddings.js";
import moderate from "../api/moderate.js";
import rerank from "../api/rerank.js";
import speech from "../api/speech.js";
import { MockResponse, makeRequest, withEnvironment, withFetch, jsonResponse } from "./helpers.js";

const routes = [["decisions", decisions], ["embeddings", embeddings], ["moderate", moderate], ["rerank", rerank], ["speech", speech]];

test("all JSON/audio routes reject methods other than POST", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key" }, async () => {
    for (const [name, handler] of routes) {
      const res = new MockResponse();
      await handler(makeRequest({ method: "GET" }), res);
      assert.equal(res.statusCode, 405, name);
      assert.equal(res.json().error.code, "METHOD_NOT_ALLOWED", name);
    }
  });
});

test("all routes fail closed when the server API key is missing", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: undefined }, async () => {
    const chat = (await import("../api/chat.js")).default;
    for (const [name, handler] of [...routes, ["chat", chat]]) {
      const body = name === "chat" ? { model: "liquid/lfm-2.5-2.6b:free", messages: [{ role: "user", content: "hello" }] } : {};
      const res = new MockResponse();
      await handler(makeRequest({ body }), res);
      assert.equal(res.statusCode, 500, name);
      assert.equal(res.json().error.code, "MISSING_API_KEY", name);
    }
  });
});

test("decisions validates required fields before calling upstream", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key" }, async () => {
    const res = new MockResponse();
    await decisions(makeRequest({ body: { model: "inception/mercury-decide:free" } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, "STATE_REQUIRED");
  });
});

test("embeddings validates its model before calling upstream", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key" }, async () => {
    const res = new MockResponse();
    await embeddings(makeRequest({ body: { model: "not-a-model", input: "hello" } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, "MODEL_NOT_ALLOWLISTED");
  });
});

test("moderation rejects empty text before calling upstream", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key" }, async () => {
    const res = new MockResponse();
    await moderate(makeRequest({ body: { text: "  " } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, "TEXT_REQUIRED");
  });
});

test("rerank rejects invalid top_n before calling upstream", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key" }, async () => {
    const res = new MockResponse();
    await rerank(makeRequest({ body: { query: "q", documents: ["a", "b"], top_n: 3 } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, "INVALID_TOP_N");
  });
});

test("speech rejects a missing voice before calling upstream", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key" }, async () => {
    const res = new MockResponse();
    await speech(makeRequest({ body: { input: "hello" } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, "VOICE_REQUIRED");
  });
});

test("decisions, embeddings, moderation, and rerank preserve successful JSON responses", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key" }, async () => {
    const cases = [
      { name: "decisions", handler: decisions, body: { model: "inception/mercury-decide:free", state: "ready", questions: { choice: { type: "choice", instructions: "Choose one." } } }, path: "/api/alpha/decisions" },
      { name: "embeddings", handler: embeddings, body: { model: "liquid/lfm-2.5-embedding-350m:free", input: ["alpha", "beta"] }, path: "/embeddings" },
      { name: "moderation", handler: moderate, body: { text: "A neutral sample." }, path: "/chat/completions" },
      { name: "rerank", handler: rerank, body: { query: "car", documents: ["sports car", "cooking recipe"], top_n: 1 }, path: "/rerank" }
    ];
    for (const item of cases) {
      let requestedUrl = "";
      const expected = { id: item.name, data: [1, 2, 3] };
      await withFetch(async (url, options) => {
        requestedUrl = String(url);
        assert.equal(options.method, "POST", item.name);
        assert.equal(options.headers.Authorization, "Bearer test-key", item.name);
        if (item.name === "moderation") assert.equal(JSON.parse(options.body).max_tokens, 256);
        return jsonResponse(expected);
      }, async () => {
        const res = new MockResponse();
        await item.handler(makeRequest({ body: item.body }), res);
        assert.equal(res.statusCode, 200, item.name);
        assert.deepEqual(res.json(), expected, item.name);
      });
      assert.ok(requestedUrl.endsWith(item.path), item.name);
    }
  });
});

test("speech returns non-empty audio bytes and no-store headers", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key" }, async () => {
    await withFetch(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "audio/mpeg" } }), async () => {
      const res = new MockResponse();
      await speech(makeRequest({ body: { input: "hello", voice: "test-voice" } }), res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.getHeader("content-type"), "audio/mpeg");
      assert.equal(res.getHeader("cache-control"), "no-store");
      assert.deepEqual([...res.body], [1, 2, 3]);
    });
  });
});

test("configured origin policy rejects an unlisted browser origin", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key", ALLOWED_ORIGIN: "https://allowed.example" }, async () => {
    const res = new MockResponse();
    await moderate(makeRequest({ body: { text: "hello" }, headers: { origin: "https://unlisted.example" } }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error.code, "ORIGIN_NOT_ALLOWED");
  });
});


test("server emergency kill switch blocks AI requests before upstream", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key", HYPERAI_AI_ENABLED: "false" }, async () => {
    let upstreamCalls = 0;
    await withFetch(async () => { upstreamCalls += 1; return jsonResponse({ ok: true }); }, async () => {
      const res = new MockResponse();
      await moderate(makeRequest({ body: { text: "hello" } }), res);
      assert.equal(res.statusCode, 503);
      assert.equal(res.json().error.code, "AI_SERVICE_DISABLED");
      assert.equal(upstreamCalls, 0);
    });
  });
});

test("shared request body ceiling rejects oversized JSON before route processing", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key", HYPERAI_AI_ENABLED: "true" }, async () => {
    const res = new MockResponse();
    await moderate(makeRequest({ body: { text: "x".repeat(262_145) } }), res);
    assert.equal(res.statusCode, 413);
    assert.equal(res.json().error.code, "REQUEST_BODY_TOO_LARGE");
  });
});

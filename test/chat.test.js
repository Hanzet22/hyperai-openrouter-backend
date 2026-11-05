import test from "node:test";
import assert from "node:assert/strict";
import chat from "../api/chat.js";
import { MockResponse, makeRequest, withEnvironment, withFetch } from "./helpers.js";

const CHAT_MODEL = "liquid/lfm-2.5-2.6b:free";
const RESPONSES_MODEL = "nvidia/nemotron-3.5-super-vl:free";

test("chat rejects models outside the server allowlist", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key" }, async () => {
    const res = new MockResponse();
    await chat(makeRequest({ body: { model: "provider/unknown:free", messages: [{ role: "user", content: "hello" }] } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, "MODEL_NOT_ALLOWLISTED");
  });
});

test("chat rejects invalid roles and empty message content", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key" }, async () => {
    for (const message of [{ role: "system", content: "not allowed from client" }, { role: "user", content: "   " }]) {
      const res = new MockResponse();
      await chat(makeRequest({ body: { model: CHAT_MODEL, messages: [message] } }), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.json().error.code, "INVALID_MESSAGES");
    }
  });
});

test("Chat Completions adapter forwards its protocol and streams SSE", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key" }, async () => {
    let target = "";
    let sentPayload;
    await withFetch(async (url, options) => {
      target = String(url);
      sentPayload = JSON.parse(options.body);
      return new Response('data: {"choices":[{"index":0,"delta":{"content":"baseline"}}]}\n\ndata: [DONE]\n\n', {
        status: 200, headers: { "content-type": "text/event-stream" }
      });
    }, async () => {
      const res = new MockResponse();
      await chat(makeRequest({ body: { model: CHAT_MODEL, messages: [{ role: "user", content: "hello" }], thinkingLevel: "high" } }), res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.getHeader("content-type"), "text/event-stream; charset=utf-8");
      assert.match(res.text(), /baseline/);
      assert.match(res.text(), /\[DONE\]/);
    });
    assert.ok(target.endsWith("/chat/completions"));
    assert.equal(sentPayload.model, CHAT_MODEL);
    assert.equal(sentPayload.max_tokens, 2048);
    assert.deepEqual(sentPayload.reasoning, { effort: "high" });
  });
});

test("Responses adapter normalizes output_text deltas into chat-compatible SSE", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key" }, async () => {
    let target = "";
    let sentPayload;
    await withFetch(async (url, options) => {
      target = String(url);
      sentPayload = JSON.parse(options.body);
      return new Response('event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"responses-adapter"}\n\nevent: response.completed\ndata: {"type":"response.completed"}\n\n', {
        status: 200, headers: { "content-type": "text/event-stream" }
      });
    }, async () => {
      const res = new MockResponse();
      await chat(makeRequest({ body: { model: RESPONSES_MODEL, messages: [{ role: "user", content: "hello" }] } }), res);
      assert.equal(res.statusCode, 200);
      assert.match(res.text(), /responses-adapter/);
      assert.match(res.text(), /\[DONE\]/);
    });
    assert.ok(target.endsWith("/responses"));
    assert.equal(sentPayload.max_output_tokens, 2048);
  });
});

test("chat blocks Web Search unless explicitly enabled by server configuration", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key", ENABLE_OPENROUTER_WEB_SEARCH: "false" }, async () => {
    const res = new MockResponse();
    await chat(makeRequest({ body: { model: CHAT_MODEL, messages: [{ role: "user", content: "search this" }], enableSearch: true } }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error.code, "WEB_SEARCH_DISABLED");
  });
});

test("chat aborts its upstream request when the client disconnects", async () => {
  await withEnvironment({ OPENROUTER_API_KEY: "test-key" }, async () => {
    let signal;
    let release;
    await withFetch(async (_url, options) => {
      signal = options.signal;
      return await new Promise((resolve) => { release = resolve; });
    }, async () => {
      const res = new MockResponse();
      const pending = chat(makeRequest({ body: { model: CHAT_MODEL, messages: [{ role: "user", content: "hold connection" }] } }), res);
      await new Promise((resolve) => setImmediate(resolve));
      res.destroy();
      assert.equal(signal.aborted, true);
      release(new Response("ignored"));
      await pending;
    });
  });
});

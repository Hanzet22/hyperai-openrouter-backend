import test from "node:test";
import assert from "node:assert/strict";
import { handleSSEEvent } from "../public/sse.js";

test("reads a standard content delta", () => {
  const chunks = [];
  const done = handleSSEEvent('data: {"choices":[{"delta":{"content":"Hello"}}]}', value => chunks.push(value));
  assert.equal(done, false);
  assert.deepEqual(chunks, ["Hello"]);
});

test("joins multiline data fields before JSON parsing", () => {
  const chunks = [];
  const frame = 'event: message\ndata: {\ndata: "choices":[{"delta":{"content":"World"}}]\ndata: }';
  assert.equal(handleSSEEvent(frame, value => chunks.push(value)), false);
  assert.deepEqual(chunks, ["World"]);
});

test("accepts CRLF event lines", () => {
  const chunks = [];
  assert.equal(handleSSEEvent('data: {"choices":[{"delta":{"content":"CRLF"}}]}\r\n', value => chunks.push(value)), false);
  assert.deepEqual(chunks, ["CRLF"]);
});

test("recognizes the [DONE] sentinel", () => {
  assert.equal(handleSSEEvent("data: [DONE]", () => assert.fail("must not append")), true);
});

test("ignores comments, empty frames, and malformed JSON", () => {
  const append = () => assert.fail("must not append");
  assert.equal(handleSSEEvent(": keepalive", append), false);
  assert.equal(handleSSEEvent("data:", append), false);
  assert.equal(handleSSEEvent("data: {not-json}", append), false);
});

test("surfaces upstream error payloads", () => {
  assert.throws(
    () => handleSSEEvent('data: {"error":{"message":"provider unavailable"}}', () => {}),
    /provider unavailable/
  );
});

test("does not append non-string delta content", () => {
  assert.equal(handleSSEEvent('data: {"choices":[{"delta":{"content":{"text":"no"}}}]}', () => assert.fail("must not append")), false);
});

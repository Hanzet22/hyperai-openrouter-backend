import test from "node:test";
import assert from "node:assert/strict";
import { emitTelemetry, startRequestTelemetry } from "../lib/observability.js";
import { MockResponse, makeRequest, withEnvironment } from "./helpers.js";

test("telemetry emits allowlisted structured fields and drops sensitive fields", () => {
  const original = console.info;
  const lines = [];
  console.info = (line) => lines.push(line);
  try {
    emitTelemetry("hyperai.test.event", {
      route: "chat",
      status: 200,
      prompt: "private user content",
      authorization: "Bearer secret",
      ip: "203.0.113.1"
    });
  } finally {
    console.info = original;
  }
  assert.equal(lines.length, 1);
  const event = JSON.parse(lines[0]);
  assert.equal(event.event, "hyperai.test.event");
  assert.equal(event.route, "chat");
  assert.equal(event.status, 200);
  assert.equal("prompt" in event, false);
  assert.equal("authorization" in event, false);
  assert.equal("ip" in event, false);
  assert.equal(typeof event.timestamp, "string");
});

test("request telemetry records completion with generated request ID and no request body", async () => {
  await withEnvironment({ VERCEL_ENV: "preview" }, async () => {
    const original = console.info;
    const lines = [];
    console.info = (line) => lines.push(line);
    try {
      const req = makeRequest({ body: { text: "must never be logged" } });
      const res = new MockResponse();
      const requestId = startRequestTelemetry(req, res, "moderate");
      res.statusCode = 400;
      res.emit("finish");
      assert.equal(res.getHeader("x-request-id"), requestId);
    } finally {
      console.info = original;
    }
    assert.equal(lines.length, 1);
    const event = JSON.parse(lines[0]);
    assert.equal(event.event, "hyperai.request.completed");
    assert.equal(event.route, "moderate");
    assert.equal(event.status, 400);
    assert.equal(event.request_id.length, 36);
    assert.equal(JSON.stringify(event).includes("must never be logged"), false);
  });
});

test("request telemetry records client disconnect only once", () => {
  const original = console.info;
  const lines = [];
  console.info = (line) => lines.push(line);
  try {
    const res = new MockResponse();
    startRequestTelemetry(makeRequest(), res, "chat");
    res.emit("close");
    res.emit("close");
  } finally {
    console.info = original;
  }
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).event, "hyperai.request.aborted");
});

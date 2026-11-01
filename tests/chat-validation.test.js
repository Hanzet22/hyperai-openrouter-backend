import test from "node:test";
import assert from "node:assert/strict";
import handler, { validateMessages } from "../api/chat.js";

test("accepts valid user and assistant text messages", () => {
  const result = validateMessages([
    { role: "user", content: "Halo" },
    { role: "assistant", content: "Hai!" }
  ]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, [
    { role: "user", content: "Halo" },
    { role: "assistant", content: "Hai!" }
  ]);
});

test("rejects empty conversations and unsupported roles", () => {
  assert.equal(validateMessages([]).status, 400);
  assert.equal(validateMessages([{ role: "system", content: "Nope" }]).status, 400);
});

test("rejects blank and non-text message content", () => {
  assert.equal(validateMessages([{ role: "user", content: "  " }]).status, 400);
  assert.equal(validateMessages([{ role: "user", content: ["not", "text"] }]).status, 400);
});

test("enforces per-message and total conversation size limits", () => {
  assert.equal(validateMessages([{ role: "user", content: "x".repeat(30_001) }]).status, 413);
  const messages = Array.from({ length: 5 }, () => ({ role: "user", content: "x".repeat(25_000) }));
  assert.equal(validateMessages(messages).status, 413);
});

test("caps the number of messages", () => {
  const messages = Array.from({ length: 81 }, () => ({ role: "user", content: "x" }));
  assert.equal(validateMessages(messages).status, 413);
});

test("provider access remains default-deny without explicit approval", async () => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  const previousApproval = process.env.HYPERAI_PROVIDER_ACCESS_APPROVED;
  process.env.OPENROUTER_API_KEY = "test-placeholder";
  delete process.env.HYPERAI_PROVIDER_ACCESS_APPROVED;
  const headers = {};
  const response = {
    statusCode: 0,
    body: "",
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    end(value = "") { this.body = value; this.writableEnded = true; }
  };
  await handler({
    method: "POST",
    headers: {},
    body: { model: "liquid/lfm-2.5-2.6b:free", messages: [{ role: "user", content: "test" }] }
  }, response);
  assert.equal(response.statusCode, 503);
  assert.match(response.body, /PROVIDER_ACCESS_NOT_APPROVED/);
  if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = previousKey;
  if (previousApproval === undefined) delete process.env.HYPERAI_PROVIDER_ACCESS_APPROVED;
  else process.env.HYPERAI_PROVIDER_ACCESS_APPROVED = previousApproval;
});

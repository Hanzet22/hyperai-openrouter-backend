import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const privacy = read("../PRIVACY.md");
const terms = read("../TERMS.md");
const cookies = read("../COOKIE-NOTICE.md");
const attributions = read("../ATTRIBUTIONS.md");
const notice = read("../NOTICE.md");
const security = read("../SECURITY.md");
const readme = read("../README.md");
const inventory = read("../docs/legal-data-inventory.md");
const checklist = read("../docs/legal-readiness-checklist.md");

test("legal documents are explicitly marked as drafts pending adult operator and legal review", () => {
  assert.ok(privacy.includes("DRAFT — NOT APPROVED FOR PUBLIC RELEASE"));
  assert.ok(terms.includes("DRAFT — NOT APPROVED FOR PUBLIC RELEASE"));
  assert.ok(cookies.includes("Status: DRAFT"));
  assert.ok(checklist.includes("PUBLIC RELEASE BLOCKED"));
  assert.ok(privacy.includes("[PLACEHOLDER"));
  assert.ok(terms.includes("[PLACEHOLDER"));
});

test("OpenRouter age eligibility is clearly reflected in user-facing legal drafts", () => {
  assert.ok(privacy.includes("at least 18 years old"));
  assert.ok(terms.includes("18 years or older"));
  assert.ok(readme.includes("at least 18 years old"));
});

test("cookie notice accurately documents browser storage keys and no cookie API claim", () => {
  for (const key of ["hyperai.theme", "hyperai.advancedMotion", "hyperai.model", "hyperai.thinking"]) assert.ok(cookies.includes(key));
  assert.ok(cookies.includes("does not call `document.cookie`"));
  assert.ok(cookies.includes("does not use `sessionStorage`"));
});

test("attributions and notices preserve the current MIT license status and avoid implied endorsement", () => {
  assert.ok(attributions.includes("currently contains MIT License text"));
  assert.ok(notice.includes("currently states the MIT License"));
  assert.ok(notice.includes("no sponsorship, partnership, or endorsement is implied"));
});

test("privacy inventory records provider data flow and deployment verification boundary", () => {
  assert.ok(privacy.includes("OpenRouter"));
  assert.ok(privacy.includes("model provider"));
  assert.ok(inventory.includes("POST /api/chat"));
  assert.ok(inventory.includes("deployment verification outstanding"));
  assert.ok(security.includes("private vulnerability reporting"));
});
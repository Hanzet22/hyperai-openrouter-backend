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
  assert.match(privacy, /DRAFT — NOT APPROVED FOR PUBLIC RELEASE/);
  assert.match(terms, /DRAFT — NOT APPROVED FOR PUBLIC RELEASE/);
  assert.match(cookies, /Status: DRAFT/);
  assert.match(checklist, /PUBLIC RELEASE BLOCKED/);
  assert.match(privacy, /\\[PLACEHOLDER/);
  assert.match(terms, /\\[PLACEHOLDER/);
});

test("OpenRouter age eligibility is clearly reflected in user-facing legal drafts", () => {
  assert.match(privacy, /at least 18 years old/);
  assert.match(terms, /18 years or older/);
  assert.match(readme, /at least 18 years old/);
});

test("cookie notice accurately documents browser storage keys and no cookie API claim", () => {
  for (const key of ["hyperai.theme", "hyperai.advancedMotion", "hyperai.model", "hyperai.thinking"]) assert.ok(cookies.includes(key));
  assert.match(cookies, /does not call \`document\\.cookie\`/);
  assert.match(cookies, /does not use \`sessionStorage\`/);
});

test("attributions and notices preserve the current MIT license status and avoid implied endorsement", () => {
  assert.match(attributions, /currently contains MIT License text/);
  assert.match(notice, /currently states the MIT License/);
  assert.match(notice, /no sponsorship, partnership, or endorsement is implied/);
});

test("privacy inventory records provider data flow and deployment verification boundary", () => {
  assert.match(privacy, /OpenRouter/);
  assert.match(privacy, /model provider/);
  assert.match(inventory, /POST \`\\/api\\/chat\`/);
  assert.match(inventory, /deployment verification outstanding/);
  assert.match(security, /private vulnerability reporting/);
});

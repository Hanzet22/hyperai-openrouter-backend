import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/hyperai.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/hyperai.css", import.meta.url), "utf8");
const vnextCss = readFileSync(new URL("../public/vnext.css", import.meta.url), "utf8");
const visuals = readFileSync(new URL("../public/visuals.js", import.meta.url), "utf8");

test("active page loads the separated frontend modules and stylesheets", () => {
  assert.match(html, /href="\\/hyperai\\.css"/);
  assert.match(html, /src="\\/hyperai\\.js"/);
  assert.match(app, /from "\\.\\/markdown\\.js"/);
  assert.match(app, /from "\\.\\/sse\\.js"/);
});

test("primary interactive controls have accessible names and state", () => {
  assert.match(html, /id="prompt"[^>]*aria-label="Pesan untuk HyperAI"/);
  assert.match(html, /id="sendBtn"[^>]*aria-label="Kirim pesan"/);
  assert.match(html, /id="stopBtn"[^>]*aria-label="Hentikan respons"/);
  assert.match(html, /id="themeBtn"[^>]*aria-label=/);
  assert.match(html, /id="motionBtn"[^>]*aria-pressed=/);
  assert.match(html, /id="searchToggleBtn"[^>]*aria-pressed=/);
});

test("dialog, skip navigation, and live status regions remain present", () => {
  assert.match(html, /href="#prompt"/);
  assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="modalTitle"/);
  assert.match(html, /id="statusText" role="status" aria-live="polite"/);
  assert.match(html, /id="streamStatus" class="sr-only" role="status" aria-live="polite"/);
});

test("interactive controls retain visible keyboard focus styling", () => {
  assert.match(css, /button:focus-visible[^}]*outline/);
  assert.match(css, /textarea:focus-visible[^}]*outline/);
  assert.match(vnextCss, /prefers-reduced-motion/);
});

test("advanced animation responds to system reduced-motion preference", () => {
  assert.match(visuals, /prefers-reduced-motion: reduce/);
  assert.match(visuals, /addEventListener\\?\\.\\(\\?\\.change/);
});

test("the chat API contract remains unchanged and no inline event handlers are introduced", () => {
  assert.match(app, /const API_URL = "\\/api\\/chat"/);
  assert.match(app, /thinkingLevel: selectedThinking, enableSearch: searchEnabled/);
  assert.doesNotMatch(html, /\\son(?:click|error|load)=/i);
});

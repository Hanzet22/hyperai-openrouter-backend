import test from "node:test";
import assert from "node:assert/strict";
import { escapeHTML, renderMarkdown } from "../public/markdown.js";

test("escapes HTML metacharacters and quotes", () => {
  assert.equal(escapeHTML("<&>\"\'"), "&lt;&amp;&gt;&quot;&#039;");
});

test("renders untrusted HTML as text rather than executable markup", () => {
  const output = renderMarkdown('<img src=x onerror="alert(1)"><script>alert(1)</script>');
  assert.ok(output.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.ok(output.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!output.includes("<script>"));
  assert.ok(!output.includes("<img"));
});

test("creates only HTTP and HTTPS links with safe new-window attributes", () => {
  const output = renderMarkdown("https://example.com/path and http://example.org");
  assert.equal((output.match(/<a href=/g) || []).length, 2);
  assert.ok(output.includes('target="_blank" rel="noopener noreferrer"'));
  assert.ok(!renderMarkdown("javascript:alert(1)").includes("<a href="));
  assert.ok(!renderMarkdown("data:text/html,hello").includes("<a href="));
});

test("keeps HTML escaped inside fenced code blocks and language metadata", () => {
  const fence = String.fromCharCode(96).repeat(3);
  const output = renderMarkdown(fence + "html\n<img src=x onerror=alert(1)>\n" + fence);
  assert.ok(output.includes('<pre data-language="html"><code>&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!output.includes("<img"));
});

test("keeps quotes escaped in URL attributes", () => {
  const output = renderMarkdown('https://example.com/" onclick="alert(1)');
  assert.ok(output.includes('href="https://example.com/&quot;'));
  assert.ok(!output.includes('href="https://example.com/" onclick='));
});
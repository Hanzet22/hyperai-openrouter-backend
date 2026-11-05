import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

function rendererSource() {
  const start = html.indexOf("function escapeHTML(value)");
  const end = html.indexOf("function createMessage(", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return html.slice(start, end);
}

test("Markdown renderer escapes source text before formatting", () => {
  const source = rendererSource();
  const escapeStep = source.indexOf("let safe = escapeHTML(text)");
  assert.notEqual(escapeStep, -1);
  assert.ok(escapeStep < source.indexOf("safe = safe.replace"));
});

test("Markdown links are restricted to web URL schemes", () => {
  const source = rendererSource();
  assert.match(source, /https\?:/);
  assert.match(source, /noopener noreferrer/);
});

test("code block language metadata is escaped", () => {
  const source = rendererSource();
  assert.match(source, /escapeHTML\(block\.language\)/);
});

test("API route upstream targets are not selected from request fields", async () => {
  const files = ["chat", "decisions", "embeddings", "moderate", "rerank", "speech"];
  for (const name of files) {
    const source = await readFile(new URL(`../api/${name}.js`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /body\.(?:url|targetUrl|upstreamUrl)\b/);
  }
});

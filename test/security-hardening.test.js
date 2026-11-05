import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

function rendererSource() {
  const start = html.indexOf("function appendInline(parent, value)");
  const end = html.indexOf("function createMessage(", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return html.slice(start, end);
}

test("message rendering uses DOM nodes rather than HTML string sinks", () => {
  const source = rendererSource();
  assert.match(source, /document\.createElement/);
  assert.match(source, /document\.createTextNode/);
  assert.match(source, /textContent/);
  assert.match(source, /replaceChildren/);
  assert.doesNotMatch(html, /\.innerHTML\s*=/);
  assert.doesNotMatch(html, /insertAdjacentHTML|outerHTML\s*=/);
});

test("auto-links validate HTTP(S) URLs and reject credentials", () => {
  const source = rendererSource();
  assert.match(source, /parsedUrl\.protocol === "http:"/);
  assert.match(source, /parsedUrl\.protocol === "https:"/);
  assert.match(source, /!parsedUrl\.username && !parsedUrl\.password/);
  assert.match(source, /noopener noreferrer/);
});

test("code block language metadata is bounded and assigned as an attribute", () => {
  const source = rendererSource();
  assert.match(source, /slice\(0, 40\)/);
  assert.match(source, /setAttribute\("data-language", codeLanguage\)/);
  assert.match(source, /code\.textContent = codeLines\.join/);
});

test("dynamic error and abort messages are inserted as text", () => {
  const source = rendererSource();
  assert.match(source, /showErrorMessage/);
  assert.match(source, /showAbortMessage/);
  assert.match(source, /paragraph\.append\(strong, document\.createTextNode/);
});

test("API route upstream targets are not selected from request fields", async () => {
  const files = ["chat", "decisions", "embeddings", "moderate", "rerank", "speech"];
  for (const name of files) {
    const source = await readFile(new URL(`../api/${name}.js`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /body\.(?:url|targetUrl|upstreamUrl)\b/);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "../public/shaders.js";

test("WebGL2 shader sources start with the required GLSL version directive", () => {
  assert.ok(VERTEX_SHADER.startsWith("#version 300 es\n"));
  assert.ok(FRAGMENT_SHADER.startsWith("#version 300 es\n"));
});

test("WebGL2 shader sources contain real line breaks, not escaped newline text", () => {
  assert.ok(VERTEX_SHADER.includes("\nvoid main()"));
  assert.ok(FRAGMENT_SHADER.includes("\nprecision mediump float;"));
  assert.ok(!VERTEX_SHADER.includes("\\n"));
  assert.ok(!FRAGMENT_SHADER.includes("\\n"));
});

test("vertex and fragment shaders expose matching renderer inputs", () => {
  assert.match(VERTEX_SHADER, /in vec2 position/);
  assert.match(FRAGMENT_SHADER, /uniform float time/);
  assert.match(FRAGMENT_SHADER, /uniform vec2 resolution/);
  assert.match(FRAGMENT_SHADER, /out vec4 color/);
});

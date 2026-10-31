export const VERTEX_SHADER = `#version 300 es
in vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

uniform float time;
uniform vec2 resolution;
out vec4 color;

void main() {
  vec2 uv = gl_FragCoord.xy / max(resolution, vec2(1.0));
  float wave = 0.5 + 0.5 * sin(time * 0.16 + uv.x * 5.0 + uv.y * 3.0);
  color = vec4(0.12, 0.34, 0.72, wave * 0.10);
}
`;

import { EventEmitter } from "node:events";

export class MockResponse extends EventEmitter {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = new Map();
    this.chunks = [];
    this.body = "";
    this.destroyed = false;
    this.writableEnded = false;
    this.headersSent = false;
  }
  setHeader(name, value) { this.headers.set(String(name).toLowerCase(), String(value)); }
  getHeader(name) { return this.headers.get(String(name).toLowerCase()); }
  flushHeaders() { this.headersSent = true; }
  write(chunk) {
    this.headersSent = true;
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    return true;
  }
  end(chunk) {
    if (chunk !== undefined) this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    this.body = Buffer.concat(this.chunks);
    this.writableEnded = true;
    this.headersSent = true;
    return this;
  }
  destroy() { this.destroyed = true; this.emit("close"); }
  text() { return this.body.toString("utf8"); }
  json() { return JSON.parse(this.text()); }
}

export function makeRequest({ method = "POST", body = {}, headers = {} } = {}) {
  return { method, body, headers: { host: "hyperai.test", ...headers } };
}

export async function withEnvironment(values, callback) {
  const previous = new Map();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { return await callback(); }
  finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

export async function withFetch(implementation, callback) {
  const original = globalThis.fetch;
  globalThis.fetch = implementation;
  try { return await callback(); }
  finally { globalThis.fetch = original; }
}
export function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { "content-type": "application/json; charset=utf-8" }
  });
}

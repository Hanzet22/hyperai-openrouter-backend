/**
 * Parse one Server-Sent Events frame used by the OpenRouter chat-completions stream.
 * Returns true only when the upstream sends the [DONE] sentinel.
 */
export function handleSSEEvent(eventText, appendDelta) {
  const dataLines = String(eventText).split(/\r?\n/)
    .filter(line => line.startsWith("data:"))
    .map(line => line.slice(5).replace(/^ /, ""));
  if (!dataLines.length) return false;

  const payload = dataLines.join("\n").trim();
  if (!payload) return false;
  if (payload === "[DONE]") return true;

  try {
    const json = JSON.parse(payload);
    const choice = json?.choices?.[0];
    const delta = choice?.delta?.content;
    if (typeof delta === "string" && delta) appendDelta(delta);

    const upstreamError = json?.error?.message || json?.error;
    if (upstreamError) {
      throw new Error(typeof upstreamError === "string" ? upstreamError : JSON.stringify(upstreamError));
    }
  } catch (error) {
    if (error instanceof SyntaxError) return false;
    throw error;
  }
  return false;
}

/**
 * Incrementally separates SSE frames regardless of network chunk boundaries.
 * The caller owns TextDecoder so UTF-8 sequences can also span byte chunks.
 */
export class SSEStreamDecoder {
  constructor(appendDelta) {
    this.appendDelta = appendDelta;
    this.buffer = "";
    this.done = false;
  }

  push(text) {
    if (this.done || !text) return this.done;
    this.buffer += text;
    let boundary;
    while ((boundary = this.buffer.match(/\r?\n\r?\n/)) !== null) {
      const frame = this.buffer.slice(0, boundary.index);
      this.buffer = this.buffer.slice(boundary.index + boundary[0].length);
      if (handleSSEEvent(frame, this.appendDelta)) {
        this.done = true;
        this.buffer = "";
        break;
      }
    }
    return this.done;
  }

  finish() {
    if (!this.done && this.buffer.trim()) {
      this.done = handleSSEEvent(this.buffer, this.appendDelta);
    }
    this.buffer = "";
    return this.done;
  }
}

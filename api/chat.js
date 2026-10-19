
/**
 * HyperAI — Vercel Serverless Function
 * Browser -> /api/chat -> OpenRouter Chat Completions
 *
 * Required Vercel environment variable:
 *   OPENROUTER_API_KEY
 *
 * Optional environment variables:
 *   ALLOWED_ORIGIN       One origin, or comma-separated origins, e.g. https://example.vercel.app
 *   PUBLIC_APP_URL       Public app URL used for OpenRouter attribution
 *   OPENROUTER_APP_TITLE Display name sent to OpenRouter
 *   ENABLE_OPENROUTER_WEB_SEARCH Set to "true" to permit OpenRouter web-search tooling
 *
 * The API key is server-side only. Never add it to index.html.
 */

import { Readable } from "node:stream";
import { once } from "node:events";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_MESSAGES = 80;
const MAX_MESSAGE_CHARS = 30_000;
const MAX_TOTAL_CHARS = 120_000;
const MAX_UPSTREAM_ERROR_CHARS = 1_000;

const THINKING_LEVELS = new Set(["off", "low", "medium", "high", "ultra"]);

// Keep this allowlist in sync with the chat-selectable IDs in index.html.
// Special-purpose models are not accepted by this chat-completions route.
const CHAT_MODELS = new Set([
  "openrouter/free",
  "xingchen-agi/xing4.0-29b-a4b:free",
  "nvidia/nemotron-3.5-super-vl:free",
  "liquid/lfm-2.5-2.6b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "thinkingmachines/inkling-small:free",
  "thinkingmachines/inkling:free",
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free"
]);

const SYSTEM_INSTRUCTION =
  "Lu adalah HyperAI, asisten chat yang asyik, santai, gokil, dan friendly banget. " +
  "Gunakan bahasa Indonesia gaul, kasual khas tongkrongan, pakai kata 'lu', 'gua', 'bre', 'wkwkwk', atau 'coy'. " +
  "JANGAN PERNAH pakai bahasa baku, kaku, atau formal (seperti 'Anda', 'Saya', 'terima kasih atas pertanyaan Anda') " +
  "kecuali user yang minta secara spesifik. Jawab dengan ringkas, punchy, dan langsung ke intinya!";

function sendJson(res, status, body) {
  if (res.destroyed || res.writableEnded) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function errorBody(message, code) {
  return { error: { message, ...(code ? { code } : {}) } };
}

function parseConfiguredOrigins() {
  return String(process.env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function applyOriginPolicy(req, res) {
  const configuredOrigins = parseConfiguredOrigins();

  if (configuredOrigins.length === 0) {
    return { allowed: true, configured: false };
  }

  const requestOrigin = req.headers.origin;

  // Requests without Origin include same-origin/non-browser and command-line clients.
  // ALLOWED_ORIGIN is a browser CORS control, not an API authentication mechanism.
  if (!requestOrigin) {
    return { allowed: true, configured: true };
  }

  const normalizedRequestOrigin = String(requestOrigin).replace(/\/$/, "");

  if (!configuredOrigins.includes(normalizedRequestOrigin)) {
    return { allowed: false, configured: true };
  }

  res.setHeader("Access-Control-Allow-Origin", normalizedRequestOrigin);
  res.setHeader("Vary", "Origin");

  return { allowed: true, configured: true };
}

function parseRequestBody(body) {
  if (Buffer.isBuffer(body)) body = body.toString("utf8");

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return { ok: false, error: "Invalid JSON body." };
    }
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  return { ok: true, value: body };
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Messages are required."
    };
  }

  if (messages.length > MAX_MESSAGES) {
    return {
      ok: false,
      status: 413,
      error: `Conversation exceeds ${MAX_MESSAGES} messages.`
    };
  }

  let totalChars = 0;
  const normalized = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const role = message?.role;
    const content = message?.content;

    // System instructions are owned by the server.
    // Do not let the browser override them.
    if (role !== "user" && role !== "assistant") {
      return {
        ok: false,
        status: 400,
        error: `Message ${index + 1} has an invalid role.`
      };
    }

    if (typeof content !== "string" || !content.trim()) {
      return {
        ok: false,
        status: 400,
        error: `Message ${index + 1} must have non-empty text content.`
      };
    }

    if (content.length > MAX_MESSAGE_CHARS) {
      return {
        ok: false,
        status: 413,
        error: `Message ${index + 1} is too long.`
      };
    }

    totalChars += content.length;

    if (totalChars > MAX_TOTAL_CHARS) {
      return {
        ok: false,
        status: 413,
        error: "Conversation text exceeds the server limit."
      };
    }

    normalized.push({ role, content });
  }

  return { ok: true, value: normalized };
}

function makeUpstreamError(text, status) {
  let message = `OpenRouter request failed (HTTP ${status}).`;

  try {
    const parsed = JSON.parse(text);
    const upstreamError = parsed?.error;

    const upstreamMessage = typeof upstreamError === "string"
      ? upstreamError
      : upstreamError?.message || parsed?.message;

    if (typeof upstreamMessage === "string" && upstreamMessage.trim()) {
      message = upstreamMessage.trim().slice(0, MAX_UPSTREAM_ERROR_CHARS);
    }
  } catch {
    if (text?.trim()) {
      message = text.trim().slice(0, MAX_UPSTREAM_ERROR_CHARS);
    }
  }

  return message;
}

function getReferer(req) {
  const configuredUrl = String(process.env.PUBLIC_APP_URL || "").trim();

  if (configuredUrl) return configuredUrl;

  // Avoid putting arbitrary header characters into another request header.
  const host = String(req.headers.host || "localhost")
    .replace(/[^a-zA-Z0-9.:[\]-]/g, "");

  return `https://${host || "localhost"}`;
}

export default async function handler(req, res) {
  const configuredOrigins = parseConfiguredOrigins();
  const originPolicy = applyOriginPolicy(req, res);

  if (!originPolicy.allowed) {
    return sendJson(res, 403, errorBody("Origin not allowed."));
  }

  if (req.method === "OPTIONS") {
    if (!originPolicy.configured) {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, errorBody("Method not allowed."));
    }

    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "600");
    res.setHeader("Cache-Control", "no-store");
    res.statusCode = 204;

    return res.end();
  }

  if (req.method !== "POST") {
    res.setHeader(
      "Allow",
      originPolicy.configured ? "POST, OPTIONS" : "POST"
    );

    return sendJson(res, 405, errorBody("Method not allowed."));
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return sendJson(
      res,
      500,
      errorBody("OPENROUTER_API_KEY is not configured on the server.")
    );
  }

  const parsedBody = parseRequestBody(req.body);

  if (!parsedBody.ok) {
    return sendJson(res, 400, errorBody(parsedBody.error));
  }

  const body = parsedBody.value;
  const model = typeof body.model === "string" ? body.model.trim() : "";

  if (!model) {
    return sendJson(res, 400, errorBody("Model is required."));
  }

  if (!CHAT_MODELS.has(model)) {
    return sendJson(
      res,
      400,
      errorBody("This model is not enabled for the chat endpoint.")
    );
  }

  const validatedMessages = validateMessages(body.messages);

  if (!validatedMessages.ok) {
    return sendJson(
      res,
      validatedMessages.status,
      errorBody(validatedMessages.error)
    );
  }

  const thinkingLevel = body.thinkingLevel ?? "medium";

  if (
    typeof thinkingLevel !== "string" ||
    !THINKING_LEVELS.has(thinkingLevel)
  ) {
    return sendJson(
      res,
      400,
      errorBody(
        "Invalid thinkingLevel. Use off, low, medium, high, or ultra."
      )
    );
  }

  if (
    body.enableSearch !== undefined &&
    typeof body.enableSearch !== "boolean"
  ) {
    return sendJson(
      res,
      400,
      errorBody("enableSearch must be a boolean.")
    );
  }

  const enableSearch = body.enableSearch === true;

  // OpenRouter web-search tooling may incur separate charges.
  // Require explicit server-side opt-in.
  if (
    enableSearch &&
    String(process.env.ENABLE_OPENROUTER_WEB_SEARCH || "").toLowerCase() !== "true"
  ) {
    return sendJson(
      res,
      403,
      errorBody(
        "Web Search belum diaktifkan di server. " +
        "Periksa tarif tool terlebih dahulu, lalu set " +
        "ENABLE_OPENROUTER_WEB_SEARCH=true jika ingin mengizinkannya."
      )
    );
  }

  const upstreamMessages = [
    { role: "system", content: SYSTEM_INSTRUCTION },
    ...validatedMessages.value
  ];

  const payload = {
    model,
    messages: upstreamMessages,
    stream: true
  };

  // Actual reasoning support depends on the selected model/provider.
  if (thinkingLevel !== "off") {
    const effortByLevel = {
      low: "low",
      medium: "medium",
      high: "high",
      ultra: "xhigh"
    };

    payload.reasoning = {
      effort: effortByLevel[thinkingLevel]
    };
  }

  // OpenRouter server-tool syntax.
  if (enableSearch) {
    payload.tools = [{ type: "openrouter:web_search" }];
  }

  const abortController = new AbortController();

  const onResponseClose = () => {
    if (!res.writableEnded) abortController.abort();
  };

  res.on("close", onResponseClose);

  try {
    const upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: abortController.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": getReferer(req),
        "X-OpenRouter-Title": String(
          process.env.OPENROUTER_APP_TITLE || "HyperAI"
        ).slice(0, 128)
      },
      body: JSON.stringify(payload)
    });

    if (!upstream.ok) {
      const responseText = await upstream.text();
      const message = makeUpstreamError(responseText, upstream.status);

      return sendJson(
        res,
        upstream.status,
        errorBody(message, upstream.status)
      );
    }

    if (!upstream.body) {
      return sendJson(
        res,
        502,
        errorBody("OpenRouter returned an empty response stream.")
      );
    }

    const contentType = upstream.headers.get("content-type");

    res.statusCode = 200;
    res.setHeader(
      "Content-Type",
      contentType?.includes("text/event-stream")
        ? contentType
        : "text/event-stream; charset=utf-8"
    );
    res.setHeader("Cache-Control", "no-store, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader(
      "Vary",
      originPolicy.configured ? "Origin" : "Accept-Encoding"
    );

    res.flushHeaders?.();

    const stream = Readable.fromWeb(upstream.body);

    for await (const chunk of stream) {
      if (res.destroyed) break;

      if (!res.write(chunk)) {
        // Respect response backpressure without hanging if the browser disconnects.
        await Promise.race([
          once(res, "drain"),
          once(res, "close").then(() => undefined)
        ]);
      }
    }

    if (!res.destroyed && !res.writableEnded) {
      res.end();
    }
  } catch (error) {
    if (
      res.destroyed ||
      res.writableEnded ||
      error?.name === "AbortError"
    ) {
      return;
    }

    const message = error instanceof Error
      ? error.message.slice(0, MAX_UPSTREAM_ERROR_CHARS)
      : "Unable to contact OpenRouter.";

    if (!res.headersSent) {
      return sendJson(
        res,
        502,
        errorBody(`OpenRouter connection failed: ${message}`)
      );
    }

    // Signal an SSE error once response headers have been committed.
    try {
      res.write(
        `data: ${JSON.stringify({
          error: { message: "Upstream stream interrupted." }
        })}\n\n`
      );
      res.end();
    } catch {
      res.destroy();
    }
  } finally {
    res.off("close", onResponseClose);
  }
}
/**
 * Vercel Serverless Function
 *
 * Browser -> /api/chat -> OpenRouter
 *
 * Required Vercel environment variable:
 *   OPENROUTER_API_KEY
 *
 * The secret is never sent to the browser.
 */

import { Readable } from "node:stream";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const ALLOWED_METHODS = new Set(["POST"]);

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function getAllowedOrigin(req) {
  // Same-origin Vercel deployment by default.
  // Set ALLOWED_ORIGIN in Vercel if you need a specific public origin.
  return process.env.ALLOWED_ORIGIN || null;
}

export default async function handler(req, res) {
  if (!ALLOWED_METHODS.has(req.method)) {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return sendJson(res, 500, {
      error: "OPENROUTER_API_KEY is not configured on the server."
    });
  }

  const origin = getAllowedOrigin(req);

  if (origin) {
    const requestOrigin = req.headers.origin;

    if (requestOrigin && requestOrigin !== origin) {
      return sendJson(res, 403, { error: "Origin not allowed" });
    }

    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  let body = req.body;

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return sendJson(res, 400, { error: "Invalid JSON body." });
    }
  }

  if (!body || typeof body !== "object") {
    return sendJson(res, 400, { error: "Request body is required." });
  }

  const { model, messages } = body;

  if (
    typeof model !== "string" ||
    !model.trim()
  ) {
    return sendJson(res, 400, { error: "Model is required." });
  }

  if (
    !Array.isArray(messages) ||
    messages.length === 0
  ) {
    return sendJson(res, 400, { error: "Messages are required." });
  }

  // Basic request-size/content guardrails.
  if (messages.length > 100) {
    return sendJson(res, 413, { error: "Conversation is too long." });
  }

  const normalizedMessages = messages.map((message) => ({
    role: message?.role,
    content: message?.content
  }));

  const upstream = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.PUBLIC_APP_URL ||
        `https://${req.headers.host || "localhost"}`,
      "X-OpenRouter-Title":
        process.env.OPENROUTER_APP_TITLE ||
        "HyperAI"
    },
    body: JSON.stringify({
      model: model.trim(),
      messages: normalizedMessages,
      stream: true
    })
  });

  res.statusCode = upstream.status;

  // Forward only useful response headers.
  const contentType =
    upstream.headers.get("content-type");

  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Accel-Buffering", "no");

  if (!upstream.body) {
    const text = await upstream.text();
    return res.end(text);
  }

  Readable.fromWeb(upstream.body).pipe(res);
}

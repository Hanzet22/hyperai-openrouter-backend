/**
 * HyperAI chat endpoint for Vercel.
 * POST /api/chat
 * Uses only explicitly allowlisted free chat models. There is no automatic fallback.
 * OPENROUTER_API_KEY must stay in Vercel Environment Variables, never in the browser.
 */

import { Readable } from "node:stream";
import {
  OPENROUTER_BASE,
  preparePost,
  sendJson,
  fail,
  openRouterHeaders,
  extractUpstreamMessage
} from "../lib/openrouter.js";

const CHAT_COMPLETIONS_URL = `${OPENROUTER_BASE}/chat/completions`;
const RESPONSES_URL = `${OPENROUTER_BASE}/responses`;
const MAX_MESSAGES = 80;
const MAX_MESSAGE_CHARS = 30_000;
const MAX_TOTAL_CHARS = 120_000;
const THINKING_LEVELS = new Set(["off", "low", "medium", "high", "ultra"]);

// Keep in sync with the active model picker in index.html.
// Nemotron Super VL uses OpenRouter's Responses API adapter; the other two use Chat Completions.
const CHAT_MODELS = new Map([
  ["nvidia/nemotron-3.5-super-vl:free", { api: "responses" }],
  ["liquid/lfm-2.5-2.6b:free", { api: "chat-completions" }],
  ["cohere/north-mini-code:free", { api: "chat-completions" }]
]);

const SPECIAL_MODELS = {
  "openrouter/free": {
    code: "AUTO_ROUTING_DISABLED",
    message: "Auto routing sengaja dinonaktifkan di HyperAI supaya model tidak dipilih otomatis. Pilih model free yang tercantum di menu."
  },
  "thinkingmachines/inkling:free": {
    code: "AGENT_HARNESS_REQUIRED",
    message: "Inkling hanya tersedia untuk agentic harness yang diizinkan provider. Endpoint chat biasa HyperAI tidak bisa mengakali pembatasan ini."
  },
  "thinkingmachines/inkling-small:free": {
    code: "AGENT_HARNESS_REQUIRED",
    message: "Inkling Small hanya tersedia untuk agentic harness yang diizinkan provider. Endpoint chat biasa HyperAI tidak bisa mengakali pembatasan ini."
  },
  "inception/mercury-decide:free": {
    code: "SPECIAL_ENDPOINT_REQUIRED",
    message: "Mercury Decide bukan model chat biasa. Gunakan POST /api/decisions dengan state dan questions."
  },
  "respan/span-01-lite:free": {
    code: "SPECIAL_ENDPOINT_REQUIRED",
    message: "Span-01 Lite mengembalikan keputusan terstruktur, bukan teks chat. Gunakan POST /api/decisions dengan state dan questions."
  },
  "liquid/lfm-2.5-embedding-350m:free": {
    code: "SPECIAL_ENDPOINT_REQUIRED",
    message: "Model embedding tidak menghasilkan jawaban chat. Gunakan POST /api/embeddings dengan input teks."
  },
  "nvidia/nemotron-3-embed-1b:free": {
    code: "SPECIAL_ENDPOINT_REQUIRED",
    message: "Model embedding tidak menghasilkan jawaban chat. Gunakan POST /api/embeddings dengan input teks."
  },
  "nvidia/llama-nemotron-embed-vl-1b-v2:free": {
    code: "SPECIAL_ENDPOINT_REQUIRED",
    message: "Model embedding multimodal tidak menghasilkan jawaban chat. Gunakan POST /api/embeddings; route yang disiapkan saat ini menerima input teks."
  },
  "nvidia/llama-nemotron-rerank-vl-1b-v2:free": {
    code: "SPECIAL_ENDPOINT_REQUIRED",
    message: "Model reranking menilai relevansi dokumen. Gunakan POST /api/rerank dengan query dan documents."
  },
  "nvidia/nemotron-3.5-content-safety:free": {
    code: "SPECIAL_ENDPOINT_REQUIRED",
    message: "Model Content Safety dipakai untuk klasifikasi safety. Gunakan POST /api/moderate dengan text."
  },
  "fish-audio/s2.1-pro-free:free": {
    code: "SPECIAL_ENDPOINT_REQUIRED",
    message: "Fish Audio adalah model text-to-speech. Gunakan POST /api/speech dengan input dan voice."
  },
  "nvidia/nemotron-3.5-lightning:free": {
    code: "MODEL_TEMPORARILY_DISABLED",
    message: "Nemotron 3.5 Lightning sementara dinonaktifkan di chat picker karena tes HyperAI sebelumnya menghasilkan respons kosong."
  },
  "xingchen-agi/xing4.0-29b-a4b:free": {
    code: "UPSTREAM_RATE_LIMITED_IN_LAST_TEST",
    message: "Xing 4.0 sebelumnya mengembalikan upstream rate limit. Model ini tidak aktif di chat picker sampai diuji lagi."
  },
  "google/gemma-4-26b-a4b-it:free": {
    code: "UPSTREAM_RATE_LIMITED_IN_LAST_TEST",
    message: "Gemma 4 26B sebelumnya mengembalikan Google AI Studio rate limit. Model ini tidak aktif di chat picker sampai diuji lagi."
  },
  "google/gemma-4-31b-it:free": {
    code: "UPSTREAM_RATE_LIMITED_IN_LAST_TEST",
    message: "Gemma 4 31B sebelumnya mengembalikan Google AI Studio rate limit. Model ini tidak aktif di chat picker sampai diuji lagi."
  }
};

const SYSTEM_INSTRUCTION =
  "Lu adalah HyperAI, asisten chat yang asyik, santai, gokil, dan friendly. " +
  "Gunakan bahasa Indonesia kasual mengikuti gaya user. Jawab jelas, relevan, dan langsung ke inti. " +
  "Kalau ada ketidakpastian, jelaskan; jangan mengarang sumber, pengalaman, atau hasil tindakan.";

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, status: 400, message: "Messages are required." };
  }
  if (messages.length > MAX_MESSAGES) {
    return { ok: false, status: 413, message: `Conversation exceeds ${MAX_MESSAGES} messages.` };
  }

  let total = 0;
  const normalized = [];
  for (let i = 0; i < messages.length; i += 1) {
    const item = messages[i];
    const role = item?.role;
    const content = item?.content;
    if (role !== "user" && role !== "assistant") {
      return { ok: false, status: 400, message: `Message ${i + 1} has an invalid role.` };
    }
    if (typeof content !== "string" || !content.trim()) {
      return { ok: false, status: 400, message: `Message ${i + 1} must contain non-empty text.` };
    }
    if (content.length > MAX_MESSAGE_CHARS) {
      return { ok: false, status: 413, message: `Message ${i + 1} is too long.` };
    }
    total += content.length;
    if (total > MAX_TOTAL_CHARS) {
      return { ok: false, status: 413, message: "Conversation text exceeds the server limit." };
    }
    normalized.push({ role, content });
  }
  return { ok: true, value: normalized };
}

function withReasoning(payload, thinkingLevel) {
  if (thinkingLevel === "off") return;
  const effort = { low: "low", medium: "medium", high: "high", ultra: "xhigh" }[thinkingLevel];
  payload.reasoning = { effort };
}

function sseHeaders(res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

function writeWithBackpressure(res, chunk) {
  if (res.destroyed || res.writableEnded) return Promise.resolve();
  if (res.write(chunk)) return Promise.resolve();
  return new Promise((resolve) => {
    const cleanup = () => {
      res.off("drain", onDrain);
      res.off("close", onClose);
      resolve();
    };
    const onDrain = () => cleanup();
    const onClose = () => cleanup();
    res.once("drain", onDrain);
    res.once("close", onClose);
  });
}

function emitChatDelta(res, text) {
  return writeWithBackpressure(res, `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: text } }] })}\n\n`);
}

async function pipeChatCompletionStream(upstream, res) {
  const stream = Readable.fromWeb(upstream.body);
  for await (const chunk of stream) {
    if (res.destroyed) break;
    await writeWithBackpressure(res, chunk);
  }
  if (!res.destroyed && !res.writableEnded) res.end();
}

function extractResponseEvent(block) {
  const dataLines = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart());
  if (!dataLines.length) return null;
  const data = dataLines.join("\n");
  if (data === "[DONE]") return { type: "done" };
  try { return JSON.parse(data); }
  catch { return null; }
}

async function pipeResponsesAsChatStream(upstream, res) {
  const stream = Readable.fromWeb(upstream.body);
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;

  const processBlock = async (block) => {
    const event = extractResponseEvent(block);
    if (!event) return;
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      await emitChatDelta(res, event.delta);
      return;
    }
    if (event.type === "response.failed" || event.type === "error" || event.error) {
      const message = event.error?.message || event.response?.error?.message || event.message || "Responses API stream failed.";
      await writeWithBackpressure(res, `data: ${JSON.stringify({ error: { message: String(message).slice(0, 1000) } })}\n\n`);
      sawDone = true;
    }
  };

  for await (const chunk of stream) {
    if (res.destroyed || sawDone) break;
    buffer += decoder.decode(chunk, { stream: true });
    let separator;
    while ((separator = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const block = buffer.slice(0, separator);
      const match = buffer.slice(separator).match(/^\r?\n\r?\n/);
      buffer = buffer.slice(separator + (match ? match[0].length : 2));
      await processBlock(block);
      if (sawDone) break;
    }
  }
  buffer += decoder.decode();
  if (!sawDone && buffer.trim()) await processBlock(buffer);
  if (!res.destroyed && !res.writableEnded) {
    if (!sawDone) await writeWithBackpressure(res, "data: [DONE]\n\n");
    res.end();
  }
}

export default async function handler(req, res) {
  const body = preparePost(req, res);
  if (!body) return;

  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!model) return fail(res, 400, "Model is required.", "MODEL_REQUIRED");
  const modelConfig = CHAT_MODELS.get(model);
  if (!modelConfig) {
    const diagnostic = SPECIAL_MODELS[model];
    if (diagnostic) return fail(res, 400, diagnostic.message, diagnostic.code);
    return fail(res, 400, "Model ID tidak diaktifkan di chat endpoint HyperAI. Hanya model yang di-allowlist di index.html yang boleh dipakai.", "MODEL_NOT_ALLOWLISTED");
  }

  const checked = validateMessages(body.messages);
  if (!checked.ok) return fail(res, checked.status, checked.message, "INVALID_MESSAGES");

  const thinkingLevel = body.thinkingLevel ?? "medium";
  if (typeof thinkingLevel !== "string" || !THINKING_LEVELS.has(thinkingLevel)) {
    return fail(res, 400, "Invalid thinkingLevel. Use off, low, medium, high, or ultra.", "INVALID_THINKING_LEVEL");
  }
  if (body.enableSearch !== undefined && typeof body.enableSearch !== "boolean") {
    return fail(res, 400, "enableSearch must be a boolean.", "INVALID_SEARCH_FLAG");
  }

  const enableSearch = body.enableSearch === true;
  if (enableSearch && String(process.env.ENABLE_OPENROUTER_WEB_SEARCH || "").toLowerCase() !== "true") {
    return fail(res, 403, "Web Search dinonaktifkan oleh konfigurasi server. Untuk menghindari biaya tambahan, set ENABLE_OPENROUTER_WEB_SEARCH=false atau hapus variabelnya.", "WEB_SEARCH_DISABLED");
  }
  if (enableSearch && modelConfig.api === "responses") {
    return fail(res, 400, "Web Search belum dihubungkan ke Responses API adapter untuk model ini. Matikan toggle Web Search atau pilih model chat lainnya.", "SEARCH_NOT_SUPPORTED_FOR_MODEL");
  }

  const upstreamMessages = [{ role: "system", content: SYSTEM_INSTRUCTION }, ...checked.value];
  const payload = modelConfig.api === "responses"
    ? { model, input: upstreamMessages, stream: true }
    : { model, messages: upstreamMessages, stream: true };
  withReasoning(payload, thinkingLevel);
  if (enableSearch) payload.tools = [{ type: "openrouter:web_search" }];

  const controller = new AbortController();
  const onClose = () => { if (!res.writableEnded) controller.abort(); };
  res.on("close", onClose);

  try {
    const endpoint = modelConfig.api === "responses" ? RESPONSES_URL : CHAT_COMPLETIONS_URL;
    const upstream = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: openRouterHeaders(req),
      body: JSON.stringify(payload)
    });

    if (!upstream.ok) {
      const responseText = await upstream.text();
      const message = extractUpstreamMessage(responseText, upstream.status);
      return fail(res, upstream.status, message, `OPENROUTER_${upstream.status}`);
    }
    if (!upstream.body) return fail(res, 502, "OpenRouter returned an empty response stream.", "EMPTY_UPSTREAM_STREAM");

    sseHeaders(res);
    if (modelConfig.api === "responses") await pipeResponsesAsChatStream(upstream, res);
    else await pipeChatCompletionStream(upstream, res);
  } catch (error) {
    if (res.destroyed || res.writableEnded || error?.name === "AbortError") return;
    const message = String(error?.message || "Unknown upstream error").slice(0, 400);
    if (!res.headersSent) return fail(res, 502, `OpenRouter connection failed: ${message}`, "UPSTREAM_CONNECTION_FAILED");
    try {
      await writeWithBackpressure(res, `data: ${JSON.stringify({ error: { message: "Upstream stream interrupted." } })}\n\n`);
      res.end();
    } catch { res.destroy(); }
  } finally {
    res.off("close", onClose);
  }
}

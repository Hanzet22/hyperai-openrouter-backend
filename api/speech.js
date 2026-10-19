/** Free text-to-speech helper. POST /api/speech; returns raw audio bytes. */
import { preparePost, fail, openRouterHeaders, OPENROUTER_BASE, extractUpstreamMessage } from "../lib/openrouter.js";

const MODEL = "fish-audio/s2.1-pro-free:free";
const FORMATS = new Set(["mp3", "wav", "opus", "aac", "flac", "pcm"]);

export default async function handler(req, res) {
  const body = preparePost(req, res);
  if (!body) return;
  const input = typeof body.input === "string" ? body.input.trim() : "";
  const voice = typeof body.voice === "string" ? body.voice.trim() : "";
  const responseFormat = typeof body.response_format === "string" ? body.response_format.toLowerCase() : "mp3";
  if (!input) return fail(res, 400, "input wajib diisi.", "INPUT_REQUIRED");
  if (input.length > 4000) return fail(res, 413, "Teks TTS terlalu panjang (maks. 4.000 karakter per request).", "INPUT_TOO_LARGE");
  if (!voice || voice.length > 100) return fail(res, 400, "voice wajib diisi dengan ID voice yang didukung Fish Audio S2.1 Pro Free.", "VOICE_REQUIRED");
  if (!FORMATS.has(responseFormat)) return fail(res, 400, "response_format tidak dikenal. Coba mp3 atau pcm jika didukung model.", "INVALID_AUDIO_FORMAT");

  let upstream;
  try {
    upstream = await fetch(`${OPENROUTER_BASE}/audio/speech`, {
      method: "POST",
      headers: openRouterHeaders(req),
      body: JSON.stringify({ model: MODEL, input, voice, response_format: responseFormat })
    });
  } catch (error) {
    return fail(res, 502, `OpenRouter connection failed: ${String(error?.message || "network error").slice(0, 400)}`, "UPSTREAM_CONNECTION_FAILED");
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    return fail(res, upstream.status, extractUpstreamMessage(text, upstream.status), `OPENROUTER_${upstream.status}`);
  }
  const contentType = upstream.headers.get("content-type") || "";
  if (!contentType.startsWith("audio/")) {
    const text = await upstream.text();
    return fail(res, 502, extractUpstreamMessage(text, 502), "INVALID_AUDIO_RESPONSE");
  }
  const audio = Buffer.from(await upstream.arrayBuffer());
  if (!audio.length) return fail(res, 502, "Audio provider mengembalikan file kosong.", "EMPTY_AUDIO_RESPONSE");
  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", String(audio.length));
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", `attachment; filename="hyperai-speech.${responseFormat === "pcm" ? "pcm" : responseFormat}"`);
  const generationId = upstream.headers.get("x-generation-id");
  if (generationId) res.setHeader("X-Generation-Id", generationId);
  res.end(audio);
}

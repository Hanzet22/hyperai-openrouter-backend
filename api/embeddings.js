/** Text embeddings. POST /api/embeddings */
import { preparePost, fail, forwardJson, jsonSize } from "../lib/openrouter.js";

const MODELS = new Set([
  "liquid/lfm-2.5-embedding-350m:free",
  "nvidia/nemotron-3-embed-1b:free",
  "nvidia/llama-nemotron-embed-vl-1b-v2:free"
]);

export default async function handler(req, res) {
  const body = preparePost(req, res);
  if (!body) return;
  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!MODELS.has(model)) return fail(res, 400, "Model embedding tidak diaktifkan.", "MODEL_NOT_ALLOWLISTED");
  const input = body.input;
  const inputs = typeof input === "string" ? [input] : input;
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 16 || !inputs.every((value) => typeof value === "string" && value.trim() && value.length <= 20_000)) {
    return fail(res, 400, "input harus berupa teks atau array 1–16 teks; tiap teks maksimal 20.000 karakter. Route ini sementara menerima teks saja.", "INVALID_EMBEDDING_INPUT");
  }
  if (jsonSize(inputs) > 60_000) return fail(res, 413, "Total input embedding terlalu besar (maks. 60 KB).", "INPUT_TOO_LARGE");
  const payload = { model, input: typeof input === "string" ? input : inputs };
  if (typeof body.input_type === "string" && body.input_type.length <= 32) payload.input_type = body.input_type;
  return forwardJson(req, res, "/embeddings", payload);
}

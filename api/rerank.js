/** Document relevance ranking. POST /api/rerank */
import { preparePost, fail, forwardJson, jsonSize } from "../lib/openrouter.js";

const MODEL = "nvidia/llama-nemotron-rerank-vl-1b-v2:free";

export default async function handler(req, res) {
  const body = preparePost(req, res);
  if (!body) return;
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const documents = body.documents;
  if (!query || query.length > 5000) return fail(res, 400, "query wajib diisi dan maksimal 5.000 karakter.", "INVALID_QUERY");
  if (!Array.isArray(documents) || documents.length < 1 || documents.length > 40 || !documents.every((doc) => typeof doc === "string" && doc.trim() && doc.length <= 20_000)) {
    return fail(res, 400, "documents harus berisi 1–40 teks; tiap dokumen maksimal 20.000 karakter. Route ini sementara menerima dokumen teks saja.", "INVALID_DOCUMENTS");
  }
  const topN = body.top_n === undefined ? Math.min(10, documents.length) : body.top_n;
  if (!Number.isInteger(topN) || topN < 1 || topN > documents.length) return fail(res, 400, "top_n harus bilangan bulat antara 1 dan jumlah documents.", "INVALID_TOP_N");
  const payload = { model: MODEL, query, documents, top_n: topN };
  if (jsonSize(payload) > 100_000) return fail(res, 413, "Payload rerank terlalu besar (maks. 100 KB).", "PAYLOAD_TOO_LARGE");
  return forwardJson(req, res, "/rerank", payload);
}

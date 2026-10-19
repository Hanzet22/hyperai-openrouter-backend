/** Structured classification / scoring. POST /api/decisions */
import { preparePost, fail, forwardJson, jsonSize } from "../lib/openrouter.js";

const MODELS = new Set([
  "inception/mercury-decide:free",
  "respan/span-01-lite:free"
]);

export default async function handler(req, res) {
  const body = preparePost(req, res);
  if (!body) return;
  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!MODELS.has(model)) return fail(res, 400, "Model decisions tidak diaktifkan. Gunakan inception/mercury-decide:free atau respan/span-01-lite:free.", "MODEL_NOT_ALLOWLISTED");
  if (body.state === undefined || body.state === null || (typeof body.state === "string" && !body.state.trim())) {
    return fail(res, 400, "state wajib diisi.", "STATE_REQUIRED");
  }
  if (jsonSize(body.state) > 60_000) return fail(res, 413, "state terlalu besar; batas payload state 60 KB.", "STATE_TOO_LARGE");
  if (!body.questions || typeof body.questions !== "object" || Array.isArray(body.questions)) {
    return fail(res, 400, "questions harus berupa object dengan pertanyaan bertipe.", "QUESTIONS_REQUIRED");
  }
  const entries = Object.entries(body.questions);
  if (!entries.length || entries.length > 20) return fail(res, 400, "Masukkan 1–20 pertanyaan dalam questions.", "INVALID_QUESTION_COUNT");
  for (const [name, question] of entries) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name) || !question || typeof question !== "object" || Array.isArray(question)) {
      return fail(res, 400, "Setiap question harus berupa object dengan nama key yang valid.", "INVALID_QUESTION");
    }
    if (!["choice", "noul", "score"].includes(question.type)) {
      return fail(res, 400, `Question '${name}' harus memakai type choice, noul, atau score.`, "INVALID_QUESTION_TYPE");
    }
    if (typeof question.instructions !== "string" || !question.instructions.trim() || question.instructions.length > 4000) {
      return fail(res, 400, `Question '${name}' butuh instructions teks (maks. 4000 karakter).`, "INVALID_QUESTION_INSTRUCTIONS");
    }
  }
  const payload = { model, state: body.state, questions: body.questions };
  if (jsonSize(payload) > 90_000) return fail(res, 413, "Payload decisions terlalu besar (maks. 90 KB).", "PAYLOAD_TOO_LARGE");
  return forwardJson(req, res, "https://openrouter.ai/api/alpha/decisions", payload);
}

# Current Architecture Inventory

**Evidence baseline:** repository `main`, inspected 2026-11-05.  
**Scope:** source inspection only; no live deployment or end-to-end runtime test was performed.

## 1. Repository map

| Path | Observed responsibility |
|---|---|
| `api/chat.js` | Chat request validation, model allowlist, model/protocol selection, upstream request, streaming response |
| `api/decisions.js` | Structured decision requests using supported decision models |
| `api/embeddings.js` | Text embedding requests |
| `api/moderate.js` | Text moderation/classification using a fixed model |
| `api/rerank.js` | Text document reranking using a fixed model |
| `api/speech.js` | Text-to-speech request and audio response handling |
| `lib/openrouter.js` | Shared HTTP/CORS/body helpers, OpenRouter headers, JSON forwarding, error normalization |
| `public/index.html` | Single-file HTML/CSS/JS client |
| `vercel.json` | Function maximum-duration configuration |
| `package.json` | ESM package declaration; no scripts or dependencies declared |
| `README.md`, `LICENSE`, `ATTRIBUTIONS.md` | Project and licensing documentation |

## 2. Request path

The browser client sends requests to same-origin API routes. API handlers call shared helpers from `lib/openrouter.js` for method/origin/body/key checks and upstream forwarding. The backend sends requests to OpenRouter using a server-side API key. The browser receives JSON, audio, or an SSE-style streamed chat response depending on route.

## 3. Chat path

The inspected chat handler defines:
- Chat Completions and Responses API upstream URLs.
- Maximum 80 messages.
- Maximum 30,000 characters per message.
- Maximum 120,000 total message characters.
- Thinking-level allowlist: `off`, `low`, `medium`, `high`, `ultra`.
- A model map that selects Responses API for `nvidia/nemotron-3.5-super-vl:free` and Chat Completions for `liquid/lfm-2.5-2.6b:free` and `cohere/north-mini-code:free`.
- Explicit special-model errors for models that require another endpoint or an agentic harness.
- Streaming and client-disconnect handling in the existing implementation (must be covered by tests before migration).

The frontend separately declares its own active model list. This duplication is a drift risk.

## 4. Other route boundaries

| Route | Observed constraints / behavior |
|---|---|
| `POST /api/decisions` | Model allowlist; required state; state max 60 KB; 1–20 typed questions; question instructions max 4,000 chars; final payload max 90 KB |
| `POST /api/embeddings` | Model allowlist; string or 1–16 text inputs; each max 20,000 chars; aggregate input max 60 KB |
| `POST /api/moderate` | Fixed moderation model; required text; max 20,000 chars |
| `POST /api/rerank` | Fixed rerank model; query max 5,000 chars; 1–40 text documents; each max 20,000 chars; valid top_n; payload max 100 KB |
| `POST /api/speech` | Fixed TTS model; input max 4,000 chars; required voice ID max 100 chars; supported response format set; validates non-empty audio response |

These limits are observed in source and should be treated as current behavior until verified by contract tests.

## 5. Shared helper observations

`lib/openrouter.js` contains JSON response helpers, standardized errors, origin policy, request parsing, POST preparation, OpenRouter headers, upstream error extraction, JSON forwarding, and JSON-size calculation.

The README correctly warns that CORS is not authentication. The source inspection found no evident per-user authentication, rate limiting, or per-user quota enforcement in the inspected route/helper layer. This is a source-level finding, not proof that no external platform-level controls exist.

## 6. Frontend observations

`public/index.html` is approximately 57 KB / 858 lines and combines markup, styling, and application JavaScript. The inspected client includes:
- Model picker with three active chat models.
- Thinking-mode picker.
- Optional Web Search control.
- Streaming chat UI, send/stop controls, and quick prompts.
- Night/Day theme and motion toggle.
- Local-storage helpers for preferences.
- Accessibility semantics including dialog/listbox roles, labels, and live status text.
- Welcome/privacy notice describing third-party model/provider processing.

The prompt textarea has a 12,000-character UI limit, while backend per-message validation permits up to 30,000 characters. This is a deliberate-or-accidental mismatch that must be resolved as an explicit product decision.

## 7. Deployment observations

`vercel.json` configures 60 seconds for chat and speech, and 30 seconds for decisions, embeddings, rerank, and moderation. These values are configuration requests, not proof of the active account's effective limits. Vercel documents that function duration includes processing and sending streamed responses, and that request/response payloads have platform limits; see:
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/functions/runtimes/node-js

## 8. Known evidence gaps

- No live production request was sent during this inventory.
- No automated tests were found in the inspected package manifest.
- Full deployment environment, Vercel plan, environment-variable configuration, external rate limits, and provider-side quotas were not independently inspected.
- The frontend's complete runtime behavior and every model-specific parameter path require targeted tests.

# API Contract Map

**Status:** source-derived baseline; contract tests still required.  
**Common convention:** JSON POST requests use shared preparation helpers and standardized JSON errors unless a route returns audio or a stream.

## 1. Route inventory

| Route | Purpose | Required fields (source-derived) | Bounds / notes |
|---|---|---|---|
| `POST /api/chat` | Chat completion | `messages`, `model` plus optional thinking/search controls | 80 messages; 30,000 chars/message; 120,000 total chars; model allowlist; protocol depends on model |
| `POST /api/decisions` | Structured decision output | `model`, `state`, `questions` | State 60 KB; 1–20 questions; question instructions max 4,000 chars; payload 90 KB |
| `POST /api/embeddings` | Text vectors | `model`, `input` | String or 1–16 strings; each max 20,000 chars; aggregate 60 KB |
| `POST /api/moderate` | Text safety classification | `text` | Required; max 20,000 chars; fixed model |
| `POST /api/rerank` | Rank documents against query | `query`, `documents`, `top_n` | Query max 5,000 chars; 1–40 text docs; each max 20,000 chars; payload 100 KB |
| `POST /api/speech` | Text-to-speech | `input`, `voice`, optional `response_format` | Input max 4,000 chars; voice required/max 100 chars; audio response must be non-empty |

## 2. Chat model/protocol routing

| Model ID | Upstream protocol | Current status |
|---|---|---|
| `nvidia/nemotron-3.5-super-vl:free` | Responses API | Explicitly mapped in `api/chat.js` |
| `liquid/lfm-2.5-2.6b:free` | Chat Completions | Explicitly mapped in `api/chat.js` |
| `cohere/north-mini-code:free` | Chat Completions | Explicitly mapped in `api/chat.js` |

The chat handler also contains explicit rejection cases for models requiring a special harness or a different route (decisions/embeddings). The browser currently mirrors the three active chat models in its own array.

OpenRouter documents both `POST /api/v1/chat/completions` and `POST /api/v1/responses`; their request/response shapes are related but not identical. Keep them as separate adapters with normalized internal output rather than assuming all models share one wire protocol:
- https://openrouter.ai/docs/api_reference/overview
- https://openrouter.ai/docs/api_reference/streaming
- https://openrouter.ai/docs/api/api-reference/responses/create-a-response

## 3. Shared request/error behavior

The shared helper layer currently handles method checks, CORS origin policy, JSON body parsing, server API-key presence, OpenRouter request headers, upstream error extraction, and JSON forwarding. Error responses use an `error` object with a message and, where supplied, a machine-readable code.

The README documents `OPENROUTER_API_KEY`, `OPENROUTER_APP_TITLE`, `PUBLIC_APP_URL`, `ALLOWED_ORIGIN`, and `ENABLE_OPENROUTER_WEB_SEARCH` as environment settings. Verify actual use and defaults against source during implementation.

## 4. Contract details still to freeze

Before Phase 1, add tests or fixtures to capture:
- Exact chat request schema, role/content constraints, thinking-level mapping, Web Search enablement, and SSE event format.
- Exact success/error response shape for each route.
- HTTP status codes for invalid JSON, wrong method, blocked origin, missing key, upstream errors, malformed upstream response, and timeout.
- Audio content type, format mapping, and binary response headers.
- Decisions model-specific response shape.
- Embedding and rerank response passthrough semantics.
- Whether all six endpoints are used by the current UI or intended for external clients.

## 5. Compatibility rule

Do not rename or remove any existing route during the initial rewrite. If a route needs a new internal implementation, keep the old URL as a thin compatibility handler and test it against the captured contract. Any breaking change requires an explicit versioning/deprecation decision.

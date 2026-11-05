# Feature Preservation Matrix

This matrix separates observed current features from proposed improvements. “Preserve” means the behavior must remain available through the rewrite; it does not require retaining the same internal code.

| Feature / capability | Current evidence | Rewrite requirement | Verification |
|---|---|---|---|
| Chat through OpenRouter | `POST /api/chat` | Preserve | Contract + integration test |
| Three active chat models | Frontend picker and backend allowlist | Preserve IDs until separately reviewed | Registry parity test |
| Responses API model adapter | Nemotron model mapping | Preserve protocol compatibility | Adapter fixture/integration test |
| Chat Completions adapter | Liquid and Cohere mappings | Preserve protocol compatibility | Adapter fixture/integration test |
| Thinking modes | Five UI choices and backend levels | Preserve supported mapping; expose unsupported states clearly | Mapping tests |
| Optional Web Search | UI toggle and server environment gate | Preserve opt-in behavior and cost warning | Disabled/enabled tests |
| Streaming chat | Existing chat handler | Preserve chunk delivery, end/error behavior, cancellation | Stream tests |
| Structured decisions | `/api/decisions` | Preserve | Request/response tests |
| Embeddings | `/api/embeddings` | Preserve | Input bound + response tests |
| Moderation | `/api/moderate` | Preserve | Validation + upstream tests |
| Reranking | `/api/rerank` | Preserve | Validation + ranking response tests |
| Text-to-speech | `/api/speech` | Preserve audio output and format handling | Binary response tests |
| Theme switching | Frontend controls | Preserve | UI smoke test |
| Motion toggle | Frontend controls | Preserve and honor reduced-motion preference | Accessibility test |
| Model/thinking pickers | Accessible picker/listbox controls | Preserve keyboard and screen-reader behavior | Keyboard/a11y test |
| Quick prompts | Frontend | Preserve unless product owner removes them | UI test |
| Stop generation | Frontend and backend cancellation behavior | Preserve end-to-end cancellation | Abort test |
| Preference persistence | localStorage helpers | Preserve safe fallback when storage unavailable | Browser test |
| Conversation handling | In-memory client state observed; no persistent history identified in source audit | Do not introduce server-side retention silently | Privacy review |
| Welcome/privacy notice | Frontend disclosure | Preserve and update to actual provider/data behavior | Content review |
| AGPL notices | LICENSE/README/ATTRIBUTIONS migrated | Preserve notices and source-access path | Deployment check |

## 1. Explicit non-assumptions

- Do not claim image/vision input is supported just because one selected model is multimodal; the current UI description says it sends text only.
- Do not claim persistent chat history exists; the inspected client does not show a conversation database.
- Do not assume every backend endpoint is integrated into the current browser UI.
- Do not assume a “free” model or Web Search tool has unlimited or zero-cost usage.

## 2. Proposed improvements (not existing features)

- One canonical model/capability registry.
- Authentication and abuse controls suitable for the deployment's intended audience.
- Rate limits, per-user quotas, concurrency caps, and request budgets.
- Structured request IDs and redacted operational logging.
- Robust Markdown parsing and HTML sanitization.
- Modular frontend assets and testable UI modules.
- Automated contract, unit, integration, and accessibility tests.
- Clear source/license link that points to the exact deployed revision.

## 3. Preservation gate

Before each route or UI module is replaced, its row must have a passing test or a documented manual verification procedure. No “cleanup” may silently remove a feature.

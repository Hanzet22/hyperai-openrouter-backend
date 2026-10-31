# HyperAI vNext — UI and API Contract Audit

**Branch:** `hyperai-vnext/remake-foundation`  
**Audit status:** source inspection only; no runtime, assistive-technology, provider, or Vercel production tests performed.  
**Purpose:** establish the behavior that the redesign must preserve before changing the UI.

## 1. Current application shape

- The web client is a single static document at `public/index.html`; styles, markup, model configuration, and client logic are inline.
- `vercel.json` declares function duration limits for six API routes and does not define a build step or custom static rewrite.
- The current UI is a single chat workspace with a welcome modal, model/thinking selectors, Web Search toggle, theme and motion preferences, message stream, composer, and message actions.
- The design foundation is documented in `docs/vnext-design-system.md`.

## 2. Frontend behavior contract

| Area | Existing behavior to preserve |
|---|---|
| Model selection | Three active chat model IDs are listed in the frontend; selected model is persisted under `hyperai.model`. |
| Thinking mode | Off, low, medium, high, ultra; selected value is persisted under `hyperai.thinking`. |
| Theme | Dark/light; stored under `hyperai.theme`; first visit falls back to system preference. |
| Motion | Basic/advanced; stored under `hyperai.advancedMotion`; advanced motion must continue respecting reduced-motion preference. |
| Web Search | Toggle state is in memory only; sent as `enableSearch` on the next chat request. Server configuration may reject it. |
| Chat | Sends the last 80 messages to `POST /api/chat`; frontend prompt limit is 12,000 characters. |
| Streaming | Reads newline-delimited SSE `data:` events; appends `choices[0].delta.content`; recognizes `[DONE]` and upstream errors. |
| Stop | Aborts the active fetch with `AbortController`; partial output is not added to the model message array. |
| Regenerate | Reuses the most recent user prompt and removes the preceding assistant response from the in-memory message array. |
| Clear | Aborts any active request, empties in-memory conversation state, restores welcome screen. |
| Copy | Copies the latest assistant text, with a legacy clipboard fallback. |
| Quick prompts | Populate the composer only; they do not send automatically. |

**Important:** conversation messages are held in JavaScript memory in the inspected client; the inspected localStorage keys are preferences, not chat history. This is a source-level observation, not a statement about platform/provider logging or retention.

## 3. API contracts

### `POST /api/chat`

Request fields:
- `model`: one of the three explicitly allowlisted chat model IDs.
- `messages`: 1–80 user/assistant text messages.
- `thinkingLevel`: `off | low | medium | high | ultra`; defaults to medium.
- `enableSearch`: optional boolean; Web Search requires server-side `ENABLE_OPENROUTER_WEB_SEARCH=true` and is not supported by the Responses adapter model.

Response:
- Streaming `text/event-stream`, with chat-completions-compatible deltas.
- Error responses use JSON `{ error: { message, code } }` before stream headers are sent.
- The Responses API adapter translates output text delta events into chat-style SSE events.

### Additional backend routes (not wired into the current chat UI)

| Route | Contract summary |
|---|---|
| `POST /api/decisions` | Allowlisted structured decision models; requires `state` and 1–20 typed `questions`; forwards to OpenRouter alpha decisions API. |
| `POST /api/embeddings` | Allowlisted embedding models; accepts one text or 1–16 text inputs; forwards to embeddings API. |
| `POST /api/rerank` | Accepts a query and 1–40 text documents; forwards to rerank API. |
| `POST /api/moderate` | Accepts text and forwards a content-safety classification request. |
| `POST /api/speech` | Accepts text, voice ID, and audio format; returns audio bytes. |

These routes should not be represented as active user-facing UI features until their workflows, limits, error states, and tests are designed.

## 4. Findings and priority

| Priority | Finding | User / product impact | Recommended action |
|---|---|---|---|
| P0 security | Shared `preparePost` has no authentication, rate limiting, or quota enforcement in the inspected code. | Public callers may consume the project owner's upstream quota. | Add abuse controls and a defensible access/usage model before public production use. |
| P1 security | CORS origin checks are not authentication; with no configured allowlist, requests are not origin-restricted. Requests without an Origin header are accepted even when configured. | CORS alone cannot protect a public server-side API key or prevent non-browser callers. | Keep CORS as browser policy only; implement server-side abuse controls independently. |
| P1 accessibility | The welcome dialog has no inspected focus trap, Escape dismissal, or explicit initial focus management. | Keyboard and screen-reader users may lose context or navigate behind the modal. | Implement accessible dialog lifecycle, focus return, Escape behavior, and inert background. |
| P1 accessibility | Chat container uses `aria-live="off"`; streamed assistant output is not announced through a dedicated polite status region. | Screen-reader users may not know when a response starts or completes. | Add concise live status announcements; avoid announcing every token. |
| P1 accessibility | Several compact controls are below the 44 px recommended touch target in responsive styles. | Harder operation on mobile/touch devices. | Increase primary interactive targets to at least 44×44 CSS px where practical. |
| P1 accessibility | Custom listbox keyboard handling supports arrows/Home/End, but selection semantics and focus behavior need full assistive-technology testing. | Selector interaction may vary across screen readers. | Test and refine as an accessible combobox/listbox pattern, or use native select controls. |
| P1 UX | The visible character counter says 12,000 and textarea enforces that limit, while backend accepts up to 30,000 per individual message. | Frontend/backend limits are inconsistent and can confuse future clients. | Keep the current frontend limit or intentionally align both; document the chosen contract. |
| P1 UX | The model picker and chat workspace are dense on narrow screens; the current responsive rules need real-device testing. | Controls can consume vertical space on phones. | Validate 320–430 px widths and landscape, with a compact settings drawer or progressive disclosure if needed. |
| P2 resilience | Stream parsing assumes each SSE data payload is represented by a single `data:` line. | Multiline SSE payloads would not be handled as a full event. | Parse complete SSE event blocks and test chunk boundaries, CRLF, errors, and early close. |
| P2 UX | Web Search toggle is volatile and can be rejected by server configuration or model compatibility. | User may request search without clear prior indication of server availability. | Show capability/disabled states from a truthful server capability source; preserve explicit error messages. |
| P2 privacy | The current welcome modal combines usage rules, privacy notice, contact details, and other content in one long dialog. | Important privacy information is difficult to scan and revisit. | Move durable policies to a dedicated Legal Center; keep first-run acknowledgement concise and non-coercive. |
| P2 privacy | Source inspection cannot establish Vercel log retention, OpenRouter provider data handling, or model-provider training settings. | Public privacy claims could overstate what the project controls. | Verify each platform/provider configuration and publish only substantiated statements. |

## 5. Accessibility and responsive acceptance gates

- Keyboard-only navigation reaches every control in a predictable order; focus is always visible.
- Dialog open/close behavior manages focus correctly and prevents background interaction while open.
- Stream lifecycle is announced without noisy token-by-token speech.
- Controls meet 44×44 px recommended touch sizing where feasible.
- Text remains usable at 200% zoom and narrow viewport widths.
- Reduced-motion preference takes precedence over optional advanced effects.
- Dark and light themes maintain WCAG 2.2 AA contrast for text and meaningful controls.
- Test with at least one desktop screen reader and one mobile screen reader before claiming a full accessibility audit.

## 6. Implementation order

1. Preserve the current API payload and SSE response contract.
2. Refactor the application shell and responsive control layout without changing behavior.
3. Improve dialog, selector, composer, and streaming accessibility.
4. Add focused client tests or a documented manual regression matrix for send/stop/clear/copy/regenerate/search.
5. Address API abuse controls in a separate security-focused change set.
6. Keep deployment paused until critical security, privacy, accessibility, and functional gates pass and the maintainer explicitly approves.

## 7. Scope boundaries

- No production deployment was performed.
- No license migration was performed.
- No provider or platform retention/training claim was verified.
- No third-party route has been exposed as a new UI feature.
- This audit is based on repository source inspection only; it is not a penetration test, legal review, or complete WCAG conformance audit.

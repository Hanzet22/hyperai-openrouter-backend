# Phase 0.1 — Baseline Test Preparation

**Status:** baseline suite passed in GitHub Actions on Node.js 22; deployed Vercel environment remains unverified.  
**Purpose:** capture observable behavior before the architecture rewrite.

## Test command

Run with Node.js 18 or newer:

    npm test

The suite uses Node's built-in test runner and standard web APIs. It adds no runtime dependencies and does not alter production endpoint behavior.

## Coverage added

- Shared method handling, missing server API key, and configured-origin rejection.
- Decisions, embeddings, moderation, rerank, and speech validation.
- Successful JSON passthrough for decisions, embeddings, moderation, and rerank.
- Speech binary response, content type, and no-store behavior.
- Chat model allowlist and message validation.
- Chat Completions request routing and SSE forwarding.
- Responses API routing and conversion of output-text deltas into chat-compatible SSE.
- Web Search server-side feature gate.
- Client-disconnect abort signal propagation.

## Known coverage gaps

- Exact boundary tests for every documented character/count/payload limit.
- Upstream non-2xx, malformed JSON, network failure, and timeout cases for each route.
- Responses API multi-chunk UTF-8 boundaries and provider error events.
- Backpressure behavior with a slow writable response.
- Speech formats beyond MP3, malformed audio content type, and empty audio.
- Browser model-picker/backend allowlist parity.
- Live deployment smoke tests and actual Vercel runtime/plan verification.

## Execution record

| Environment | Result | Notes |
|---|---|---|
| GitHub source review | Complete | Tests authored against current main handlers. |
| GitHub Actions (Node.js 22) | Passed | Run 42011524474; test job and Run baseline tests step completed successfully. |
| Vercel deployment smoke test | Pending | Requires deployed URL and controlled test credentials. |

## Safety of this phase

Tests mock OpenRouter responses. They do not send real provider requests, require a real API key, or intentionally incur model usage. No production endpoint contract was intentionally changed.

## Exit criteria

1. Run npm test and resolve all failures.
2. Record Node version and complete test output.
3. Add boundary and upstream-failure tests for remaining contracts.
4. Run a controlled deployment smoke test before Phase 1.

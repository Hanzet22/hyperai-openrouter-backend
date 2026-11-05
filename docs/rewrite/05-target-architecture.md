# Target Architecture Proposal

**Status:** proposed architecture for review; not implemented.

## 1. Design goals

Use a small, modular Node.js ESM codebase that fits Vercel Functions, keeps existing route URLs, centralizes policy, and makes provider protocol differences explicit. Avoid adding a large framework unless the project later demonstrates a concrete need.

## 2. Proposed logical structure

```text
api/
  chat.js
  decisions.js
  embeddings.js
  moderate.js
  rerank.js
  speech.js
  public-config.js          # safe, non-secret model/capability metadata
src/
  config/
    env.js
    limits.js
    model-registry.js
  http/
    errors.js
    request.js
    response.js
    cors.js
    auth.js
    rate-limit.js
  providers/
    openrouter/
      client.js
      chat-completions.js
      responses.js
      audio.js
      errors.js
  services/
    chat-service.js
    decisions-service.js
    embeddings-service.js
    moderation-service.js
    rerank-service.js
    speech-service.js
  schemas/
    chat.js
    decisions.js
    embeddings.js
    moderation.js
    rerank.js
    speech.js
  observability/
    logger.js
    request-context.js
public/
  index.html
  assets/
    css/
    js/
tests/
  unit/
  contract/
  integration/
docs/
  rewrite/
```

This is a logical proposal, not a mandatory exact directory tree. Keep deployment-specific entrypoints thin.

## 3. Request lifecycle

1. Parse request and assign request ID.
2. Apply method, content-type, payload, origin, and authentication checks.
3. Apply rate, quota, concurrency, and request-budget policy.
4. Validate input against a route-specific schema.
5. Resolve a model/capability from one server-owned registry.
6. Dispatch to the appropriate provider adapter.
7. Normalize upstream errors and output shape.
8. Return JSON, audio, or a controlled stream.
9. Emit redacted metrics/logs and release concurrency budget.

## 4. Model registry

Each model entry should declare only facts required by the application:
- Stable model ID and display metadata.
- Enabled/disabled status.
- Supported capability (chat, decisions, embeddings, moderation, rerank, speech).
- Provider protocol/adapter identifier.
- Supported parameters and limits.
- Whether streaming is supported.
- Whether Web Search or other tools are permitted.
- Optional cost/risk classification and user-facing notes.

The frontend must receive a sanitized public projection; never expose secrets, internal provider credentials, or private policy data.

## 5. Provider adapter boundary

Define a small adapter contract such as:
- `buildRequest(input, modelConfig)`
- `send(request, abortSignal)`
- `normalizeResponse(upstream)`
- `stream(upstream, writer, abortSignal)` when supported
- `normalizeError(error)`

Chat Completions and Responses API remain distinct wire adapters. Shared concerns (auth header, base URL, timeout, retry policy, telemetry) belong in a common OpenRouter client. Retries must be conservative: do not blindly retry streamed or potentially billable requests.

OpenRouter reference material:
- https://openrouter.ai/docs/api_reference/overview
- https://openrouter.ai/docs/api_reference/streaming
- https://openrouter.ai/docs/api/api-reference/responses/create-a-response

## 6. HTTP/security layer

- Keep API keys in server environment only.
- Treat CORS and authentication as separate controls.
- Choose an explicit access model before adding authentication (private owner-only, invite-only, or public with quotas).
- Add rate limiting and concurrency/budget controls appropriate to that model.
- Enforce route schemas and body limits server-side.
- Use request-scoped abort signals and bounded upstream timeouts.
- Redact tokens, cookies, prompts, and personal data from logs.
- Return stable error codes without leaking upstream secrets or stack traces.

## 7. Frontend structure

Split the single HTML file into a small set of focused assets. Preserve the existing visual language and accessible controls. Use safe text/DOM rendering or a maintained Markdown parser plus sanitizer. Keep local preference persistence resilient when localStorage is unavailable. Do not introduce server-side conversation retention without a privacy/product decision.

## 8. Tests and tooling

Start with Node's built-in test runner if the selected Node version supports the required project syntax; add lint/type tooling only after choosing versions. Minimum test layers:
- Unit: validators, model registry, error mapping, adapters.
- Contract: each route's request/response and status codes.
- Integration: mocked OpenRouter responses; no real billing in default CI.
- Streaming: chunk ordering, terminal events, upstream error, client abort.
- UI: picker, theme, reduced motion, keyboard accessibility, safe Markdown rendering.
- Deployment smoke: health/config endpoint, key-missing behavior, duration and payload boundaries.

## 9. Deployment constraints

Retain Vercel initially. Verify actual runtime and plan limits rather than assuming the configured `maxDuration` is guaranteed. Vercel documents that function duration includes request processing and sending the response, including streamed responses, and documents a 4.5 MB request/response payload limit:
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/functions/runtimes/node-js

## 10. AGPL source availability

The deployment should show a clear license notice and source-code link. The link should identify the exact corresponding source revision used by that deployment, not merely point to a moving default branch. Review third-party notices and contribution provenance before asserting all historical code has the same license.

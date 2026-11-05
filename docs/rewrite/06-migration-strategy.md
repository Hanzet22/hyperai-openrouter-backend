# Rewrite Migration Strategy

**Status:** proposed staged migration.  
**Rule:** keep the existing implementation available until the replacement passes its contract and regression gates.

## Stage 0 — Baseline and decisions

- Complete all eight Phase 0 documents.
- Capture exact route request/response examples and error codes.
- Record current model IDs, route limits, stream events, and audio headers.
- Decide deployment access model and security controls.
- Confirm Node.js runtime/version and effective Vercel duration/payload limits.
- Resolve third-party license and attribution questions.

**Exit:** readiness review approved; unresolved blockers have owners.

## Stage 1 — Test harness and shared foundation

- Add package scripts and minimal test setup.
- Create fixtures for OpenRouter JSON, Responses API, Chat Completions, SSE, and audio.
- Add tests against current handlers before refactoring.
- Extract environment parsing, limits, error types, and model registry behind tests.

**Exit:** baseline tests pass against old implementation; no production behavior change intended.

## Stage 2 — Provider adapters

- Implement OpenRouter client and separate protocol adapters.
- Normalize provider errors and responses.
- Test cancellation, timeout, malformed responses, and stream termination.
- Do not enable new models until their adapter/capability tests pass.

**Exit:** adapters pass fixtures and integration tests using mocked upstream responses.

## Stage 3 — Route-by-route service migration

Recommended order:
1. embeddings / rerank / moderation (bounded JSON request-response paths)
2. decisions (structured output contract)
3. speech (binary response and format handling)
4. chat (most complex path: streaming, model-specific protocol, search, cancellation)

For each route:
- Keep the public path unchanged.
- Replace internals behind a thin handler.
- Run old/new contract fixtures.
- Compare response status, error codes, headers, and output shape.
- Keep rollback straightforward.

**Exit:** every route has passing contract and integration tests.

## Stage 4 — Frontend modularization

- Split CSS and JavaScript into focused files.
- Preserve model/thinking controls, Web Search, stream UI, stop, theme, motion, quick prompts, and notices.
- Replace duplicated model definitions with safe public metadata.
- Align prompt length limits.
- Add sanitizer and accessibility regression tests.

**Exit:** feature preservation matrix passes.

## Stage 5 — Security and deployment hardening

- Implement chosen authentication/access model.
- Add rate limits, quotas, concurrency caps, and spend controls.
- Verify origin handling, secrets, redacted logging, and cancellation.
- Add visible AGPL license/source link tied to deployed revision.
- Test production-like deployment limits and rollback.

**Exit:** security release checklist approved.

## Stage 6 — Cleanup

Only after all routes and UI are migrated:
- Remove dead code and duplicated registries.
- Update README, API documentation, attribution, and deployment instructions.
- Tag a release and record the migration commit.
- Keep a rollback reference to the last known-good baseline.

## Rollback principles

- Keep old handlers or a recoverable commit until route-level verification is complete.
- Avoid simultaneous large changes to routing, model list, frontend, and deployment.
- Do not use real paid provider calls in routine CI.
- A failed contract test blocks the corresponding route cutover.

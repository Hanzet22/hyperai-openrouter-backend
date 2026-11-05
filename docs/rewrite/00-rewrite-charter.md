# HyperAI Rewrite Charter

**Status:** Draft baseline for Phase 0  
**Repository:** `Hanzet22/hyperai-openrouter-backend`  
**Branch inspected:** `main`  
**Inspection date:** 2026-11-05  
**License baseline:** AGPL-3.0-or-later

## 1. Purpose

Rewrite HyperAI into a maintainable, modular AI web application while preserving the useful behavior and public API contracts already present. The rewrite must reduce duplicated configuration, hardcoded routing, unclear boundaries, and security gaps without silently removing existing capabilities.

This document is an engineering charter, not a claim that the rewrite is implemented or tested.

## 2. Goals

- Preserve the six existing API capabilities unless a documented decision explicitly changes one.
- Centralize model/provider metadata and protocol selection.
- Separate HTTP handling, validation, provider adapters, business logic, and UI presentation.
- Keep provider credentials server-side.
- Make request limits, timeouts, cancellation, error mapping, and streaming behavior explicit.
- Establish automated tests and repeatable local verification.
- Keep deployment compatible with Vercel unless a later architecture decision justifies a change.
- Meet AGPL-3.0-or-later obligations, including access to Corresponding Source for network users when Section 13 applies.

## 3. Non-goals for Phase 0

- No endpoint behavior changes.
- No deletion or replacement of existing implementation.
- No provider/model expansion merely to increase the model list.
- No framework migration before compatibility and cost are assessed.
- No claim that current production deployment has been runtime-tested in this audit.

## 4. Current baseline

The repository currently contains six API handlers: `api/chat.js`, `api/decisions.js`, `api/embeddings.js`, `api/moderate.js`, `api/rerank.js`, and `api/speech.js`; shared request/provider helpers in `lib/openrouter.js`; and a single-file browser client at `public/index.html`.

The current package manifest declares ESM but no scripts or dependencies. Vercel function durations are configured in `vercel.json`. Detailed inventories are in the following Phase 0 documents.

## 5. Engineering principles

1. **Contract first:** record current inputs, outputs, limits, and errors before refactoring.
2. **One source of truth:** model metadata and capability routing must not drift between browser and server.
3. **Explicit adapters:** provider protocol differences belong behind named adapters, not scattered conditionals.
4. **Secure by default:** CORS is not authentication; public cost-bearing endpoints need abuse controls.
5. **Bounded work:** enforce payload, item-count, timeout, concurrency, and output limits.
6. **Observable, not leaky:** use structured operational logs without logging secrets or unnecessary user content.
7. **Accessible UI:** preserve keyboard navigation, status announcements, reduced-motion behavior, and responsive layout.
8. **License clarity:** retain notices and provide an accurate source link for the deployed revision.

## 6. Decision records

| ID | Decision | State |
|---|---|---|
| D-001 | Preserve current six API capabilities during initial migration | Proposed |
| D-002 | Keep Vercel + Node.js as the initial deployment target | Proposed |
| D-003 | Centralize model registry and protocol adapters | Proposed |
| D-004 | Introduce automated tests before replacing production handlers | Required gate |
| D-005 | Keep existing routes as compatibility facades during migration | Proposed |

## 7. Exit criteria

Phase 0 is complete only when all eight documents exist, every current route has a documented contract, feature preservation is explicit, risks have owners/priorities, the target architecture is reviewable, and the readiness review lists unresolved decisions. No code rewrite is authorized by this charter alone.

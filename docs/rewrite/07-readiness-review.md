# Rewrite Readiness Review

**Review date:** 2026-11-05  
**Scope:** Phase 0 source and documentation baseline.  
**Decision:** **NOT READY for implementation rewrite yet.** Ready to complete the remaining specification and baseline-test work.

## 1. Readiness scorecard

| Area | Status | Evidence / next action |
|---|---|---|
| Repository inventory | Complete at source-inspection level | `01-current-architecture.md` |
| API route inventory | Initial map complete | Exact response fixtures and full error contract still needed |
| Feature preservation | Initial matrix complete | Add tests for each preserved feature |
| Technical debt | Initial register complete | Confirm deployment controls and actual exposure |
| Target architecture | Proposed | Review access model, registry shape, adapter contract |
| Migration plan | Proposed | Add concrete acceptance criteria per route |
| Automated tests | Not established | Build baseline harness before handler replacement |
| Security model | Incomplete | Decide private/invite-only/public access; implement controls |
| Vercel runtime/plan limits | Unverified | Confirm deployed runtime/plan and effective limits |
| AGPL source link | Needs UI/deployment verification | Add revision-specific link and inspect deployed UI |

## 2. Blocking decisions

1. **Access model:** Is HyperAI private, invite-only, or public? This determines authentication and quota design.
2. **Canonical input limits:** Should the UI's 12,000-character limit remain canonical, or should the backend limit be lowered/aligned?
3. **Model registry policy:** Who/what approves model IDs and capability metadata, and how are provider changes reviewed?
4. **Conversation privacy:** Confirm that no server-side history is intended before selecting any persistence mechanism.
5. **Runtime target:** Confirm Node.js version and actual Vercel plan/limits before choosing dependencies or streaming implementation details.

## 3. Required evidence before Phase 1

- Captured examples for successful and failing requests to all six endpoints.
- A test proving frontend model metadata matches the backend registry.
- Chat tests for both OpenRouter protocols, SSE chunk parsing, terminal events, and abort behavior.
- Speech tests for content type, response format, empty/malformed audio, and upstream errors.
- A decision on rate limiting, authentication, quotas, and cost controls.
- Verification of AGPL notice/source access in the deployed application.
- A clean baseline commit/tag to support rollback.

## 4. Risks accepted for now

The current implementation remains unchanged during Phase 0. Existing deployment risk is not made worse by these documents, but the absence of evident application-level authentication/rate limiting remains a concern if the endpoints are publicly reachable and backed by the owner's API key.

## 5. Final gate

Phase 1 may begin only after:
- the five blocking decisions are recorded,
- baseline tests exist and pass against the current code,
- the feature-preservation requirements have test coverage or explicit manual procedures,
- security controls are designed for the chosen access model,
- and the owner approves this target architecture.

**No implementation rewrite, endpoint deletion, dependency swap, or frontend replacement is authorized by this review.**

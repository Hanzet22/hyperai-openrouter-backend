# Technical Debt and Risk Register

**Scoring:** P0 = release blocker; P1 = high; P2 = medium; P3 = low. Ratings are preliminary source-inspection assessments, not penetration-test findings.

| ID | Finding | Risk | Priority | Proposed response |
|---|---|---|---|---|
| TD-01 | Model list duplicated between frontend and backend | Drift can expose unsupported models or hide supported ones | P1 | Single server-owned registry; expose safe public metadata endpoint |
| TD-02 | No evident app-level authentication/rate limit/quota in inspected handlers | Public proxy may be abused and consume owner's provider budget | P0 before open public launch | Define access model; add rate limit, quotas, concurrency and budget controls |
| TD-03 | CORS could be mistaken for access control | Non-browser clients can call public endpoints | P0 before open public launch | Keep CORS for browsers; add actual authentication/abuse controls |
| TD-04 | Monolithic `public/index.html` (~57 KB / 858 lines) | Harder maintenance, testing, and safe UI changes | P2 | Split semantic HTML, CSS, and focused JS modules |
| TD-05 | Frontend prompt limit 12,000 vs backend message limit 30,000 | Inconsistent UX and contract expectations | P2 | Decide canonical user-facing limit and test both sides |
| TD-06 | `package.json` has no scripts/dependencies | No standard lint/test/check workflow | P1 | Add minimal scripts and Node test strategy after runtime compatibility review |
| TD-07 | No test infrastructure evident in package manifest/repository inventory | Regressions may pass unnoticed | P1 | Add route contracts, adapter fixtures, stream/abort tests, and UI smoke tests |
| TD-08 | Markdown renderer/sanitization needs review | Untrusted model output may create unsafe HTML if inserted unsafely | P1 | Adopt tested parser + sanitizer or safe DOM rendering; test XSS payloads |
| TD-09 | Request/body limits are route-specific and partly duplicated | Inconsistent enforcement and accidental memory pressure | P2 | Centralize reusable schemas/limits while retaining route-specific contracts |
| TD-10 | Provider protocol handling is currently concentrated in chat route | Adding models may increase conditional complexity | P2 | Explicit protocol adapter interface and capability registry |
| TD-11 | Operational logging/metrics are not clearly standardized | Harder diagnosis and cost attribution | P2 | Structured redacted logs, request IDs, latency/status counters |
| TD-12 | AGPL source-access UI path is not yet confirmed in inspected frontend | Network users may not have an easy source link for deployed modified version | P1 | Add visible license/source link and ensure it identifies deployed revision |
| TD-13 | External runtime/plan limits not validated | Configured maxDuration may not match effective deployment capability | P2 | Verify active Vercel plan/runtime and test slow/streamed requests |

## 1. Security boundaries

- `ALLOWED_ORIGIN` is a browser CORS policy, not user identity.
- The API key must remain server-side and never appear in client bundles or logs.
- Rate limiting by IP alone can be insufficient; consider authenticated identity plus IP/device signals and provider budget caps.
- Do not log raw prompts or full provider payloads by default.
- Validate every field server-side; browser validation is only a usability feature.
- Bound input size, number of items, upstream duration, concurrency, and output size.
- Ensure cancellation stops upstream work where the provider/runtime supports it.

## 2. Prioritization

**Before public release:** TD-02/03/08 and the source-link obligation must be resolved or explicitly accepted with a limited-access deployment model.

**Before rewrite merge:** TD-06/07 and TD-01 need a concrete implementation plan.

**During modularization:** TD-04/05/09/10/11/13 should be handled without changing observable route behavior accidentally.

## 3. Not established

This register is not a security audit or proof of exploitability. It does not inspect Vercel project settings, provider account settings, CDN/WAF controls, or external identity systems.

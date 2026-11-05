# HyperAI — Security, Privacy, and Compliance Review

**Review date:** 2026-11-05  
**Scope:** current `main` source tree, project configuration, frontend, API handlers, dependency manifest, and GitHub Actions workflow.  
**Type:** source/configuration review; not a penetration test, legal opinion, Vercel account review, or provider audit.

## Executive summary

The current project is a small serverless AI frontend/backend with six public API routes. It has no application database, account system, password authentication, OAuth integration, or application-managed session cookies. The backend keeps the OpenRouter key server-side, validates input, and constructs upstream payloads explicitly.

**Highest-risk finding:** the API routes remain publicly callable and there is no user-account authentication or per-user authorization. Security 0.1 adds shared Redis-backed per-IP and global request throttling to all six POST routes. This reduces abuse risk but is not authentication and does not guarantee a daily provider-spend cap. CORS does not fix public access.

**Immediate source changes made during this review:**

1. Added baseline HTTP security headers in `vercel.json`: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS, and `Permissions-Policy`. These require a deployed-response check; a source change alone does not prove the headers are live.
2. Replaced the API-key-shaped placeholder in `.env.example` with a clearly non-secret placeholder.
3. Removed direct personal phone/payment contact details from the current `public/index.html`.
4. Added direct links to the project source repository and AGPL license in the UI.
5. Added `lib/rate-limit.js` and integrated it into all six POST routes. Production and Preview deployments require Upstash Redis REST credentials; requests fail closed with HTTP 503 if the limiter is not configured or unavailable. Per-route and global 60-second limits return HTTP 429 when reached.
6. Added rate-limit regression tests and a deployment setup guide. No production API request/response contract or model-routing behavior was intentionally changed apart from 429/503 protection responses.
7. Security 0.2 added a 256 KiB request-body ceiling, server-controlled output-token caps for chat and moderation, prompt-free usage telemetry when upstream metadata is available, and the `HYPERAI_AI_ENABLED=false` emergency kill switch. Provider-side OpenRouter spending limits remain a required account configuration.

**Important historical exposure note:** removing contact details from the current file does not erase older Git commits. The old file content may remain accessible in repository history. History rewriting was not performed.

## Security 0.2 implementation record

- Shared request-body ceiling: 256 KiB, checked after the Vercel runtime parses `req.body`.
- Chat output cap: 2,048 tokens (`max_tokens` for Chat Completions; `max_output_tokens` for Responses API).
- Moderation output cap: 256 tokens.
- Emergency switch: `HYPERAI_AI_ENABLED=false` blocks AI POST requests with HTTP 503. Environment changes require a redeployment to take effect.
- Usage telemetry: logs route, model, generation ID when available, token counts, and provider-reported cost when present. Prompt and generated text are not logged by this telemetry. Audio speech usage is not yet included.
- Monetary enforcement: no application-owned daily USD ledger was added. A dedicated OpenRouter API key with a provider-enforced spending limit is the authoritative hard cap; workspace/guardrail budgets may add another layer. Owner configuration and deployed verification remain pending.
- No Supabase database or runtime dependency was added. The connected Supabase project is a separate FurFinder project and is not used by HyperAI.

## Evidence boundaries

- Current source tree contains no `package-lock.json`, `npm-shrinkwrap.json`, or third-party runtime dependencies in `package.json`. The rate limiter uses Node.js built-ins and the Upstash Redis REST API directly.
- Current `.env.example` contains only a placeholder. No real OpenRouter key was identified in the current default-branch code search. This is not a complete scan of every historical commit, Git object, deployment log, Vercel environment variable, or external secret store.
- `.gitignore` excludes `.env`, `.env.*` except `.env.example`, `node_modules/`, and `.vercel/`.
- No database, admin dashboard, OAuth flow, password handling, or application cookie-setting code was found in the current tree.
- The chat UI keeps conversation messages in memory during the page session. The browser stores display preferences in `localStorage` (theme, motion, selected model, and thinking mode); it does not intentionally persist chat history there.
- API requests are forwarded to OpenRouter over HTTPS. The application's own data retention does not determine OpenRouter, model-provider, or hosting-provider retention.
- Vercel account settings, actual deployed headers, environment variables, firewall, log retention, backups, and access controls cannot be verified from this repository review. The new rate limiter's production behavior is not active until both Upstash variables are configured and the deployment is redeployed.

## A. Eighteen security risks

| # | Risk | Finding | Status | Priority / next action |
|---:|---|---|---|---|
| 1 | Vulnerable dependencies | No direct npm dependencies or lockfile are present. The workflow's two GitHub Actions are now pinned to verified full commit SHAs, and Dependabot is configured to check GitHub Actions and npm updates weekly. | **No app packages found; CI supply-chain gap** | **Completed:** pin Actions to verified full commit SHAs and enable weekly Dependabot checks. Add a lockfile and dependency audit when runtime packages are introduced. |
| 2 | Malicious packages | No npm packages are declared. The workflow uses SHA-pinned `actions/checkout` and `actions/setup-node`; Dependabot is configured to check GitHub Actions updates weekly. | **No npm package finding; partial** | **Completed:** pin Actions; continue reviewing publisher, permissions, and release provenance when updates arrive. |
| 3 | Prompt injection | User text is sent to an LLM. The moderation route tells the model not to follow instructions in the submitted content. The current chat path does not expose internal database, filesystem, or privileged application tools to the model; Web Search is an optional external tool. Prompt injection can still manipulate answers and search behavior. | **Residual model risk** | Treat retrieved/user content as untrusted; keep tool permissions narrow; never place secrets in prompts; add adversarial tests before adding agent tools. |
| 4 | Unpermissioned AI access | All six routes remain public to anonymous callers; no user identity, API-client credential, session, or per-user authorization is enforced. Security 0.1 applies shared Upstash-backed per-IP route limits and a global request ceiling; Security 0.2 adds request/output caps and an emergency shutdown switch. | **Abuse throttling and cost-defense controls implemented in source; authentication absent; provider/deployment configuration pending** | Configure Upstash and a dedicated OpenRouter key spend cap, then verify production. If a private API mode is required, add server-verifiable identity; never put a shared secret in browser code. |
| 5 | Excessive DB permissions | No application database or database credentials are present in the repository. | **Not applicable to current code** | Reassess if a database is introduced; use least-privilege service roles and row-level access controls. |
| 6 | Missing audit logs | No full application security audit trail exists. Security 0.2 adds prompt-free structured usage telemetry when the upstream returns usage metadata. | **Partial — usage telemetry only; broader security audit events remain a gap** | Add redacted security events for rate limits, auth decisions, provider failures, and configuration changes. Never log prompts or secrets by default. |
| 7 | No security monitoring | No alerting, anomaly detection, or incident notification integration was found in source. Usage telemetry is available in Vercel runtime logs when returned by the provider. | **Gap — logs exist, alerts are not configured/verified** | Configure deployment/provider usage alerts and error/abuse alerts in the hosting account. |
| 8 | No backups/restore | No application database or user-content store exists in source. Git is the source-code history, but no deployment/configuration restore runbook was found. | **Partly not applicable** | Document Vercel rollback and environment recovery; add tested backup/restore if persistent user data is added. |
| 9 | Exposed internal dashboards | No admin dashboard or internal dashboard route was found in the repository. Vercel dashboard access and deployment protection are external account settings. | **Not found in source; account unverified** | Restrict Vercel team membership, enable MFA, and review production/preview deployment access. |
| 10 | Missing security headers | No project-level response headers were configured in the previous `vercel.json`. | **Fixed in source; deployment pending** | Verify actual production and preview responses after deployment. Add a CSP after testing compatibility with the inline frontend. |
| 11 | Insecure cookie settings | No application cookie creation or session-cookie handling was found. | **Not applicable currently** | If authentication/cookies are introduced, use Secure, HttpOnly, SameSite, narrow Path/Domain, expiry, and CSRF protection. |
| 12 | Unencrypted data | The backend sends requests to OpenRouter using HTTPS. No application-side persistent conversation database was found. Provider/hosting retention and encryption-at-rest controls are outside this repository. | **Partial / provider controls unverified** | Document processors, cross-border processing, retention, and deletion paths; verify provider terms and deployment settings. |
| 13 | Poor tenant isolation | No accounts, tenants, or per-user records exist, so tenant isolation is not currently implemented. | **Not applicable currently** | Required before multi-user accounts or tenant-scoped stored data are introduced. |
| 14 | Unreviewed code | No `CODEOWNERS` file or repository-enforced review policy was found in the tree. Branch protection/ruleset settings were not verified. | **Unverified / governance gap** | Require review for production changes; protect `main`; require CI checks; define a maintainer/reviewer policy. |
| 15 | Mass assignment | The route handlers validate input and construct explicit upstream payload objects instead of blindly forwarding the full request body. | **No clear finding in reviewed handlers** | Preserve explicit field allowlists and add schema tests for every route. |
| 16 | Command injection | No `child_process`, `exec`, `spawn`, shell execution, or user-controlled command construction was found in application source. | **No finding in current source** | Recheck if build tools, file conversion, or command execution are added. |
| 17 | Insecure deserialization | Request parsing uses JSON parsing; no `eval`, dynamic code evaluation, or unsafe YAML/object deserializer was found. | **No finding in current source** | Keep strict JSON/schema validation; avoid unsafe object merging and executable serialization formats. |
| 18 | Misconfigured OAuth | No OAuth/OIDC flow or token validation exists. | **Not applicable currently** | If login is added, use a maintained provider, exact redirect URI allowlists, PKCE, state/nonce, issuer/audience checks, and short-lived tokens. |

## B. Twenty requested hardening actions

| # | Action | Result from review | Status |
|---:|---|---|---|
| 1 | Hide API keys | Backend reads `OPENROUTER_API_KEY` from server environment; it is not intentionally embedded in frontend source. Current branch search found only the example placeholder, now replaced. Actual Vercel values and full Git history were not accessible. | **Source reviewed; external/history pending** |
| 2 | Check environment variables | `.env.example` and `.gitignore` reviewed. Actual Production/Preview/Development values cannot be inspected from this connection. | **Partial** |
| 3 | Protect admin routes | No admin routes currently exist. | **Not applicable** |
| 4 | Add proper authentication | No application authentication exists. The current product is an anonymous browser app; a client-side shared token would be public and would not provide meaningful authentication. | **Not implemented; separate design required for private API clients** |
| 5 | Check user access | No user identity or role model exists. | **Required with authentication** |
| 6 | Sanitize forms | Chat input is length-limited in the browser and validated server-side. Other routes validate their own request fields. | **Partial; extend schema tests** |
| 7 | Protect against XSS | Frontend escapes HTML before applying its limited Markdown rendering and only auto-links HTTP(S) URLs. It still uses a custom renderer and `innerHTML`; this is not a formal sanitizer guarantee. | **Partial; add XSS regression tests and consider a maintained sanitizer/parser** |
| 8 | Add rate limiting | `lib/rate-limit.js` now enforces atomic Upstash Redis per-IP route limits and a global 120-request/60-second ceiling across all six POST endpoints. Production and Preview deployments fail closed if Redis credentials/service or the trusted client-IP header is unavailable. | **Implemented in source; Vercel/Upstash activation and production verification pending** |
| 9 | Secure API endpoints | Method checks, input validation, model allowlists, server-side secrets, and shared rate limiting exist in source. User authentication and per-user quotas remain absent. | **Partial — production configuration pending** |
| 10 | Check CORS settings | Optional `ALLOWED_ORIGIN` is an origin filter, but requests without an Origin header are allowed. CORS does not authenticate non-browser clients. | **Partial; keep CORS and add auth** |
| 11 | Add security headers | Five baseline headers added to `vercel.json`. | **Source fixed; deployment verification pending** |
| 12 | Turn off debug mode | No explicit debug mode or debug flag was found. Actual Vercel build/runtime settings were not inspected. | **Source no finding; deployment pending** |
| 13 | Update dependencies | No npm dependencies to update. GitHub Actions versions need SHA pinning. | **No npm update required; CI action pinning pending** |
| 14 | Remove unused packages | No npm packages declared. | **Not applicable** |
| 15 | Check for exposed files | Current tree has no committed `.env` file; example only. Current UI phone/payment details were removed. Historical Git content may still expose the prior values. | **Current tree improved; history pending** |
| 16 | Secure database | No database exists in the current application. | **Not applicable** |
| 17 | Hash passwords properly | No passwords or local credential store exist. | **Not applicable** |
| 18 | Check Git for leaked secrets | Current-branch code search found no real key; only the placeholder was matched. Full history and deployment logs were not scanned. | **Partial** |
| 19 | Run a full security audit | This is a source/configuration review, not a full penetration test, account audit, or independent security assessment. | **In progress; do not call complete** |
| 20 | Make no mistakes | No audit can guarantee zero defects. Tests, review, staged deployment, monitoring, and incident response reduce risk. | **Not a guarantee** |

## C. Twenty privacy, legal, and UX checks

| # | Item | Finding | Status / action |
|---:|---|---|---|
| 1 | Privacy policy | The welcome modal contains a privacy/data-safety notice, but not a complete standalone privacy policy describing controller identity, purposes, legal basis, recipients/processors, retention, international transfers, user rights, and contact channel. | **Required before public launch** |
| 2 | Terms of service | The modal has basic usage rules, not a complete Terms of Service with service scope, acceptable use, AI limitations, availability, liability language, and dispute/contact process. | **Required before public launch; legal review** |
| 3 | Refund policy | No checkout, subscription, or end-user payment processing was found. A refund policy is not currently applicable; do not advertise paid plans or take payments without one. | **Not applicable currently** |
| 4 | Cookie policy | No app-set cookies were found. The app uses `localStorage` for preferences. Hosting/provider infrastructure may process its own cookies or logs. | **Document the app's actual behavior; verify live site** |
| 5 | Cookie consent banner | No cookie banner exists. Since no non-essential app cookies or analytics were found, do not add a misleading consent banner merely for appearance. Reassess before adding analytics/advertising/third-party cookies. | **Conditional** |
| 6 | Check form consents | The chat composer has no separate privacy acknowledgement or consent workflow. The welcome modal's “understood” button is an acknowledgement, not proof of valid consent. | **Review legal basis and notice UX** |
| 7 | Collect only needed data | No account or chat persistence was found; browser preferences are stored locally. Chat text is sent to OpenRouter/model providers to generate responses. | **Good minimization direction; document processor flow** |
| 8 | Audit third-party SDKs | No npm SDKs are declared. External services include Vercel and OpenRouter; GitHub Actions are third-party workflow dependencies. | **Partial; review provider terms and pin CI actions** |
| 9 | Remove dark patterns | No forced sign-up, hidden checkout, fake urgency, or confirm-shaming was found. The welcome modal is blocking until acknowledged; ensure it remains clear and accessible. | **No clear dark pattern; improve modal accessibility** |
| 10 | No hidden fees | No user-facing billing/checkout was found. The deployment owner may incur OpenRouter costs, especially if Web Search is enabled; the README already warns about provider/tool pricing. | **Disclose clearly; add rate/cost controls** |
| 11 | No fake reviews | No review/testimonial widget or fabricated rating was found. | **No finding** |
| 12 | No unsupported claims | README describes an active-development project and warns that model/provider capabilities vary. Avoid claims such as “fully secure,” “compliant,” “private by default,” or guaranteed model accuracy. | **Keep claims evidence-based** |
| 13 | Add alt text | No content `<img>` elements were found in the main page markup; the favicon is a browser icon, not a content image. If meaningful images are added, supply useful alt text. | **No current image issue found** |
| 14 | Fix color contrast | No WCAG contrast measurement was performed. | **Unverified; run WCAG 2.2 AA contrast checks** |
| 15 | Keyboard navigation | Many controls have labels/ARIA states and the custom pickers handle arrow keys. The modal does not show a complete focus-trap/keyboard-dismissal implementation in the reviewed markup. | **Partial; test full keyboard and screen-reader flows** |
| 16 | Business details | README identifies the project and maintainer contact but does not establish a registered legal business. Do not imply a registered company, office address, or legal entity unless verified. | **Use truthful operator/contact details; adult/legal review before commercial activity** |
| 17 | Age consent for kids | No age gate, child-specific consent, guardian verification, or child-safety flow was found. This is material because the service is publicly accessible and may be used by minors. | **Required legal/product assessment before enabling child access** |
| 18 | Unsubscribe link | No mailing-list/newsletter subscription form was found. | **Not applicable unless subscriptions are added** |
| 19 | License stock images | No stock-photo gallery was found. The favicon's origin/license should still be documented if it is not original. | **Partial; verify favicon provenance** |
| 20 | Data deletion option | No server-side account/chat database was found. “Clear Chat” clears in-memory conversation state; local preferences remain in `localStorage`. Provider-side retention/deletion is governed by provider controls and policies, not the app's Clear Chat button. | **Explain accurately; provide a contact/request route if personal data is processed** |

## D. Immediate remediation priorities

1. **Access and cost abuse:** configure Upstash credentials in Vercel and verify the deployed rate limiter. The current IP/global request ceilings reduce bursts but are not a daily cost cap or user authentication. Keep provider budget controls and consider Vercel Firewall/WAF rules.
2. **Deployment verification:** deploy the header change to a preview and production, then inspect actual response headers on both static pages and API responses.
3. **Secret assurance:** inspect Vercel Production/Preview/Development variables privately; rotate any key that was ever committed or logged. Scan full Git history before claiming secret-free history.
4. **CI supply chain:** pin GitHub Actions to reviewed full commit SHAs; protect `main`; require the baseline test job and code review.
5. **Privacy/legal:** prepare standalone Privacy Policy, Terms, and Cookie/Tracking Notice based on actual data flows and provider terms. Do not publish generic boilerplate as a claim of compliance.
6. **Children's access:** assess the current Indonesian child-protection rules and decide minimum age, parental/guardian consent, age assurance, safety defaults, and reporting/complaint channels before allowing children to use the service.
7. **Accessibility:** run keyboard-only, screen-reader, reduced-motion, zoom, and contrast checks; fix modal focus handling.
8. **Data lifecycle:** document what is processed by the browser, Vercel, OpenRouter, and model providers; define retention and deletion paths for each.

## E. Indonesia legal reference points

These are research starting points, not a legal opinion:

- [UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi](https://peraturan.bpk.go.id/Details/229798/uu-no-27-) — recorded as in force; includes personal-data processing and data-subject rights.
- [PP No. 17 Tahun 2025](https://peraturan.bpk.go.id/Details/316698/pp-no-17-tahun-2025) — governance of electronic-system operation for child protection. Verify the official text and applicability to the service.
- [Permenkomdigi No. 9 Tahun 2026](https://jdih.komdigi.go.id/produk_hukum/view/id/1007/t/peraturan%2Bmenteri%2Bkomunikasi%2Bdan%2Bdigital%2Bnomor%2B9%2Btahun%2B2026) — implementing regulation for PP 17/2025; the JDIH record lists it as in force from 6 March 2026.

Applicability depends on the service, its operator, audience, processing activities, and current implementing rules. Have a qualified Indonesian legal professional and responsible adult review the final product and policies before public/commercial launch.

## F. External technical references

- [Upstash Redis REST API — EVAL](https://upstash.com/docs/redis/commands/scripting/eval) — atomic Lua scripting is supported through a POST with a JSON command array.
- [Vercel Request Headers](https://vercel.com/docs/headers/request-headers) — documents `x-real-ip` / `x-forwarded-for` as client IP headers available to Vercel Functions.
- [Upstash Rate Limit SDK overview](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) — documents distributed HTTP-based rate limiting for serverless environments.

- [OWASP Serverless FaaS Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Serverless_FaaS_Security_Cheat_Sheet.html)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP Node.js Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- [Vercel response headers documentation](https://vercel.com/docs/headers)

## Review conclusion

The repository is **not ready to be described as fully secure or legally compliant**. The immediate header and public-contact cleanups are in source, but public API access control/rate limiting, deployment checks, secret-history verification, privacy/terms documentation, and child-safety assessment remain open.

This report reflects only the reviewed repository snapshot and evidence available on 2026-11-05. Re-run it after significant code, provider, hosting, or policy changes.


## G. Post-audit verification

- GitHub Actions baseline test run after the security configuration changes: [Run 42013111580](https://github.com/Hanzet22/hyperai-openrouter-backend/actions/runs/42013111580) — **success** on Node.js 22.
- The run confirms the repository test suite still passes after the source/configuration edits. It does not verify production deployment headers, external environment variables, or legal compliance.


## G. Security 0.1 implementation record

- Added `lib/rate-limit.js` using one atomic Upstash Redis Lua `EVAL` operation per accepted POST request.
- Integrated the limiter before request-body parsing and before any OpenRouter forwarding in all six routes.
- Per-IP limits per 60 seconds: chat 8; decisions 12; embeddings 20; moderation 20; rerank 10; speech 4.
- Global limit: 120 requests per 60 seconds across all six routes.
- Uses Vercel's `x-real-ip` header; hashes the IP in Redis keys; Redis counters expire after the window.
- HTTP 429 includes `Retry-After` and rate-limit headers. Redis/configuration/IP failures return HTTP 503 (fail closed).
- Added `test/rate-limit.test.js` for atomic command construction, hashed identifiers, 429 behavior, Redis outage behavior, missing configuration, and route blocking.
- Setup instructions: [Security 0.1 rate-limit setup](0.1-rate-limit-setup.md).
- **Deployment remains pending:** add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel Production and Preview, redeploy, and verify a successful request plus an expected 429. This repository connection cannot inspect or change those private environment variables.
- IP-based throttling is not authentication, not a per-user quota, and not a guaranteed daily spending cap. The current frontend remains anonymous/public.

- GitHub Actions run [42018000381](https://github.com/Hanzet22/hyperai-openrouter-backend/actions/runs/42018000381) completed successfully on Node.js 22: **24 tests passed, 0 failed**, including the Vercel Preview enforcement test.


## H. Security 0.3 implementation record — concurrency and resource protection

- Added `lib/concurrency.js` with a distributed Redis lease semaphore using atomic Lua scripts and unique request tokens.
- Global ceiling: 24 concurrent upstream operations. Route ceilings: chat 8, decisions 8, embeddings 8, moderation 8, rerank 6, speech 3.
- Saturated capacity returns HTTP 429 `CONCURRENCY_LIMITED`; there is no unbounded in-memory queue.
- Leases expire after 70 seconds to recover permits if a function instance is terminated before cleanup. Normal completion releases the lease in `finally`.
- Added upstream deadlines: chat 55 seconds, speech 50 seconds, and JSON routes 25 seconds. These are below configured Vercel function duration ceilings.
- Shared guard listens for response closure and request abort/error events, passes an AbortSignal to upstream fetch, and clears timers/listeners on completion.
- Existing chat streaming backpressure behavior remains in place and now executes inside the shared concurrency guard.
- Redis failures return HTTP 503; this protection depends on the same Upstash Production/Preview configuration required by Security 0.1.
- Added `test/concurrency.test.js` for permit acquisition/release, saturated capacity, missing Redis configuration, exception cleanup, and client-disconnect cancellation.
- Setup and limitations: [Security 0.3 concurrency and resource protection](0.3-concurrency-resource-protection.md).
- **Activation remains pending:** the previously inspected Vercel Production/Preview environment did not contain the two Upstash variables. Configure them, redeploy, then verify runtime behavior before treating this control as active.
- Residual risks: global slots are not per-user fair; lease expiry is a crash-recovery fallback; no production load test or real upstream timeout test has been run. Monitor Upstash operation usage because each accepted upstream request adds acquire/release operations in addition to the existing rate-limit call.


## I. Security 0.4 implementation record — upstream reliability

- Added `lib/resilience.js` with a Redis-coordinated circuit breaker scoped to the selected provider/model key; stream errors discovered after response headers are recorded as failures without replaying the stream.
- Circuit behavior: CLOSED admits requests; five transient failures within a 30-second fixed counter window open the circuit for 30 seconds; after cooldown, one HALF_OPEN probe is admitted using a 10-second Redis lease. A failed half-open probe immediately reopens the circuit.
- Uses Redis server time and atomic Lua scripts. Model keys are SHA-256 hashed before being placed in Redis key names.
- Failure classification counts HTTP 429/500/502/503/504 and fetch/network exceptions as transient; successful 2xx clears failure state; other 4xx are neutral.
- Retry is deliberately narrow: at most one retry for HTTP 429, only when a valid `Retry-After` is no greater than one second. HTTP-date and delta-seconds forms are supported.
- No automatic replay for network exceptions or 5xx POST responses because upstream processing may already have occurred and replay could duplicate generation work or cost.
- Chat permits a bounded 429 retry only before SSE output begins. No retry occurs after stream output starts. Speech has circuit protection but no automatic retry.
- Reuses `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; Production/Preview fail closed when Redis coordination is unavailable.
- Added `test/resilience.test.js` for open-circuit rejection, missing Redis configuration, Retry-After parsing, bounded 429 retry, no retry for 5xx or invalid Retry-After, and local-development bypass.
- Documentation: [Security 0.4 upstream reliability](0.4-upstream-reliability.md).
- **Activation remains pending:** Security 0.1/0.3 already require the same Upstash variables, which were absent in the previously inspected Vercel Production/Preview metadata. Configure both variables, redeploy, and verify runtime behavior before treating the guards as active.
- No production fault-injection, provider outage, load, or paid-generation test was performed. Use mocked tests or bounded owner-authorized staging verification.

## J. Security 0.5 implementation record — observability

- Added `lib/observability.js` with timestamped JSON events, an explicit field allowlist, and request lifecycle instrumentation.
- All six API routes receive request-completion/abort telemetry centrally through `preparePost`; each request receives a generated `X-Request-Id`.
- Added telemetry for provider usage, rate-limit rejection/unavailability, concurrency rejection/unavailability, circuit-open decisions, half-open probes, upstream outcomes, and Redis circuit-state write errors.
- Prompt text, model output, request bodies, raw IP addresses, authorization headers, API keys, Redis tokens, and arbitrary exception messages are not accepted by the telemetry field allowlist.
- Runtime output is sent to Vercel Function Runtime Logs. No external telemetry SDK, metrics database, dashboard, alert delivery, or log-export integration was added.
- Added `test/observability.test.js` for JSON event shape, sensitive-field exclusion, request lifecycle logging, generated request IDs, and duplicate close-event suppression.
- Documentation: [Security 0.5 observability and operational monitoring](0.5-observability-monitoring.md).
- Runtime logs are operational telemetry, not a durable metrics store. Configure access controls and retention in the hosting account; no retention setting is changed by this source update.
- CI and mocked tests do not establish production observability delivery or the health of the Upstash dependency. The previously noted Production/Preview Upstash activation requirement remains open.

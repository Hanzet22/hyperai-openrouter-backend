# HyperAI vNext — Putaran 126–139 Legal & Compliance Documentation

**Status:** Draft legal documentation committed; automated checks pass; public release remains blocked pending adult operator and legal review.  
**Branch:** `hyperai-vnext/remake-foundation`  
**CI run #50:** https://github.com/Hanzet22/hyperai-openrouter-backend/actions/runs/41205479007  
**CI head SHA:** `9dcccef630144599d7a9f03d90aaf0d21a1b506c`

## Deliverables

- `PRIVACY.md` — draft privacy notice with data categories, purposes, provider chain, cross-border processing, retention, rights, and placeholders.
- `TERMS.md` — draft terms with 18+ eligibility, acceptable use, user content, AI output limitations, third-party terms, and jurisdiction placeholders.
- `COOKIE-NOTICE.md` — source-level cookie and browser-storage disclosure.
- `ATTRIBUTIONS.md` — expanded service, model-provider, runtime dependency, and asset inventory.
- `NOTICE.md` — project identity, trademark, current license, and no-endorsement notices.
- `SECURITY.md` — private vulnerability-reporting guidance and authorized-testing scope.
- `docs/legal-data-inventory.md` — source-level data-flow and storage inventory.
- `docs/legal-readiness-checklist.md` — release blockers and legal verification checklist.
- `tests/legal-documents.test.js` — regression checks for draft status, 18+ eligibility, storage disclosure, license accuracy, and data-flow wording.
- `README.md` — links to the legal documents and a visible 18+ eligibility note.

## Source-level findings recorded

- Frontend sends model, messages, thinking level, and optional web-search flag to `POST /api/chat`.
- Frontend stores four interface preferences in localStorage: theme, advanced motion, model, and thinking.
- No `document.cookie` or `sessionStorage` use was found in the reviewed frontend.
- No app-managed persistent chat-history database was found in the inspected repository.
- OpenRouter and selected model providers may process prompts and outputs; model-provider data practices vary.
- Vercel's actual deployment logs, retention, region, cookies, and platform settings were not accessed or verified.
- `public/favicon.png` provenance remains unverified and is a release blocker until verified or replaced.

## Provider eligibility requirement

The current OpenRouter Terms state that users must be at least 18 years old. The legal drafts therefore restrict the current OpenRouter-backed service to adults and require an adult operator with authority to accept the provider terms. No age-check bypass, provider-account action, or provider API access was performed.

## Legal references used

- Indonesia Law No. 27 of 2022 on Personal Data Protection: https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022
- Indonesia Government Regulation No. 71 of 2019: https://jdih.komdigi.go.id/produk_hukum/view/id/695/t/peraturan%2Bpemerintah%2Bnomor%2B71%2Btahun%2B10%2Boktober%2B2019
- OpenRouter Terms: https://openrouter.ai/terms
- OpenRouter Privacy Policy: https://openrouter.ai/privacy/
- Vercel Privacy Notice: https://vercel.com/legal/privacy-notice
- Vercel Cookie Policy: https://vercel.com/legal/cookie-policy

## CI results

GitHub Actions run #50 completed successfully:
- Node.js 24.22.1: 30/30 tests passed; JavaScript syntax check passed.
- Node.js 26.12.1: 30/30 tests passed; JavaScript syntax check passed.

## Release blockers — do not mark legal release-ready

- Legal documents remain drafts and contain placeholders for the adult operator identity, contact email, address, service URL, and effective date.
- Qualified legal review is still required.
- Vercel and OpenRouter account settings, data-processing terms, provider model terms, retention, and international transfer safeguards remain unverified.
- Live cookie/storage and network-request inspection remains outstanding.
- The root `LICENSE` remains MIT. The previously proposed AGPL-3.0-or-later transition was not applied because contributor rights and the precise version boundary still need a documented audit.
- No public legal page was activated in the production UI.
- No provider account/API key was accessed or modified.
- No Vercel deployment, production setting, PR, or merge was performed.

**Deployment status:** PAUSED / RED FLAG. This is documentation and source-level compliance work only.

# HyperAI Data Inventory and Flow — Internal Review

**Reviewed:** 31 October 2026  
**Branch:** `hyperai-vnext/remake-foundation`  
**Status:** source-level inventory; deployment verification outstanding.

## Observed data flow

1. User enters a prompt in the browser.
2. Frontend sends `model`, recent `messages`, `thinkingLevel`, and `enableSearch` to `POST /api/chat`.
3. Backend validates model and message structure/size, adds the system instruction, and forwards the request to OpenRouter.
4. OpenRouter routes the request to the selected model provider, subject to model/provider availability and terms.
5. Streamed response is returned to the browser and rendered in the current page.

## Browser-side storage

- `localStorage`: `hyperai.theme`, `hyperai.advancedMotion`, `hyperai.model`, `hyperai.thinking`.
- No `sessionStorage` use found in inspected frontend.
- No `document.cookie` use found in inspected frontend.
- No persistent chat-history write found in inspected frontend.
- Chat messages exist in JavaScript memory while the page is active.

## Infrastructure / third-party processors

| Party | Role | Data/metadata to verify |
|---|---|---|
| Vercel | Hosting/serverless platform if deployed | Request logs, IP/device metadata, security logs, retention, cookies, region, subprocessors |
| OpenRouter | Model API gateway | Request prompts, model identifiers, usage metadata, account configuration and retention |
| Selected model provider | Model inference | Input/output handling, prompt logging, training policy, retention, region |
| GitHub | Source repository and CI | Repository/code/CI metadata; not found as runtime recipient of chat prompts |
| Shields.io | README badge service | Badge requests by readers; not part of chat request path |

## Required verification before publication

- Inspect live HTTP response headers and browser storage/cookies using a clean browser profile.
- Confirm Vercel deployment region, logging and retention settings, analytics, security features, and applicable DPA.
- Confirm OpenRouter account settings, provider routing, logging/training options, model-specific terms, and available DPA.
- Confirm whether any provider receives personal data and whether international transfer safeguards are required.
- Define retention schedule and deletion/rights-request workflow.
- Confirm no analytics/advertising tags were added outside the reviewed files.
- Record the actual public domain and operator contact.
- Keep the 18+ eligibility restriction aligned with OpenRouter terms.

## Important boundary

This inventory describes the repository source at the time of review. It does not prove the deployed environment behaves identically, and it is not a DPIA or legal compliance certification.

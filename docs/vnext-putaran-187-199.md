# HyperAI vNext — Putaran 187–199

**Status:** implementation committed to `hyperai-vnext/remake-foundation`; not merged or deployed.

## Delivered

- Replaced the oversized first-run dialog with a concise privacy and development notice.
- Removed personal social, contact, private-DM, collaboration, and payment details from the public onboarding surface.
- Added a provider-eligibility notice. No age data is collected and the UI does not invite users to misrepresent age or borrow accounts.
- Added a server-side default-deny gate for provider-backed chat. The API returns `503 PROVIDER_ACCESS_NOT_APPROVED` unless `HYPERAI_PROVIDER_ACCESS_APPROVED=true` is configured after an authorized adult operator has reviewed provider requirements and the intended access model.
- Added a WebGPU capability badge using `navigator.gpu.requestAdapter()` only. No GPU device, shaders, model downloads, prompt processing, or telemetry are used.
- Clarified that WebGPU availability does not accelerate OpenRouter inference.
- Corrected stylesheet order so vNext overrides are applied after the legacy stylesheet.
- Improved light-theme subtle-text contrast and raised key mobile control targets to at least 44 px (48 px for picker and primary actions).
- Expanded the focused syntax-check script to include the API handler and WebGPU module.

## Deliberate boundaries

- Provider access remains disabled by default in this branch.
- No Vercel environment variable is added or changed.
- No merge or production deployment is authorized.
- The existing MIT license and third-party license boundaries remain unchanged.
- This is not a legal approval, age-verification system, full WCAG audit, or device-rendering certification.

## Operator action before provider access

An authorized adult operator must review current OpenRouter terms, account eligibility, intended end-user eligibility, privacy/data handling, and any required safeguards. Only then may the provider-access flag be considered. Do not set the flag as a workaround for age restrictions.

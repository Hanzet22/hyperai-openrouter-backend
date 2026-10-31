# HyperAI Cookie and Browser Storage Notice — Draft

**Status: DRAFT — verify after deployment**  
**Last source review:** 31 October 2026

## 1. Cookies

The reviewed HyperAI frontend source does not call `document.cookie` and no application-authored cookie-setting code was found. This is not proof that the hosting platform, security services, reverse proxies, or third-party services never set cookies. The deployed site must be tested in a clean browser profile and its response headers/storage inspected before this notice is finalized.

## 2. Local browser storage

HyperAI uses `localStorage` for interface preferences:

| Key | Purpose |
|---|---|
| `hyperai.theme` | Remembers dark/light theme |
| `hyperai.advancedMotion` | Remembers animation preference |
| `hyperai.model` | Remembers selected model |
| `hyperai.thinking` | Remembers selected thinking level |

These entries are stored on the user's device/browser for the same origin. The reviewed code does not use `sessionStorage` for these preferences. Chat history is held in page memory and is not written to these localStorage keys.

Users can clear site data through their browser settings. Clearing localStorage may reset these preferences.

## 3. Analytics and advertising

No application-integrated analytics or advertising SDK was identified in the source files reviewed. This must be rechecked before every release because hosting/provider features or future code changes may add tracking or similar technologies.

## 4. Consent and legal scope

Whether a consent banner is required depends on the user's jurisdiction, the technology used, and its purpose. This notice does not make a universal legal determination. Do not add non-essential analytics, advertising, or tracking technologies without first assessing applicable law and implementing a valid consent/choice mechanism where required.

## 5. Hosting-provider technologies

Vercel may process information and use cookies or similar technologies for its own platform and services under its policies. The operator must distinguish provider-side processing from cookies set by the HyperAI application and must confirm the actual production configuration.

References:
- [Vercel Privacy Notice](https://vercel.com/legal/privacy-notice)
- [Vercel Cookie Policy](https://vercel.com/legal/cookie-policy)
- [Indonesia Law No. 27 of 2022 on Personal Data Protection](https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022)

**Privacy contact:** [PLACEHOLDER]

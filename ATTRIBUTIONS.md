# ATTRIBUTIONS — HyperAI

**Status:** source-level inventory, last reviewed 31 October 2026.  
**Project license:** the root `LICENSE` file currently contains MIT License text. See [NOTICE.md](NOTICE.md) for the proposed future license-transition controls.

This file records third-party services, model providers, repository badges, and assets identified during a source-level review. It is not a claim of sponsorship, partnership, endorsement, or legal approval.

## 1. Third-party services

| Service / owner | Use in HyperAI | Official information | Notes |
|---|---|---|---|
| OpenRouter, Inc. | API gateway for model inference and optional web-search routing | https://openrouter.ai/ · https://openrouter.ai/terms · https://openrouter.ai/privacy/ | Provider terms and model-specific terms apply. OpenRouter states users must be at least 18. |
| Vercel, Inc. | Intended hosting/serverless platform and function configuration | https://vercel.com/docs · https://vercel.com/legal | Platform data processing, logs, cookies, and retention depend on the actual deployment/account configuration. |
| GitHub, Inc. | Source repository, issue tracking, and GitHub Actions CI | https://docs.github.com/ | GitHub marks and services remain owned by GitHub. |
| Shields.io | README badges | https://shields.io/ | Badge endpoint is used in README; badge logos may be trademarks of their respective owners. |

## 2. Model providers

HyperAI's backend contains an explicit model allowlist and routes requests through OpenRouter. The model provider may vary by selected model and may change over time. The provider's terms, privacy practices, retention, training settings, output rights, and restrictions must be checked for each enabled model.

Do not infer that all model providers have identical data handling. See:
- https://openrouter.ai/models
- https://openrouter.ai/privacy/
- https://openrouter.ai/terms

## 3. Runtime dependencies and platform APIs

The inspected `package.json` declares no third-party npm runtime dependencies. Backend code uses Node.js built-in modules and platform-provided `fetch`, streams, and standard web APIs. Frontend code uses browser-provided APIs such as DOM, Canvas, WebGL2, Web Storage, and CSS Houdini where supported.

This is a source-level finding; re-check package manifests and lockfiles whenever dependencies are added.

## 4. Project-authored assets

| File | Description | Provenance |
|---|---|---|
| `public/assets/hyperai-mark.svg` | Simple HyperAI mark SVG | Present in project source; confirm authorship/ownership with the contributor before release. |
| `public/shaders.js` | WebGL shader source | Project source; confirm contributor rights. |
| `public/worklets/hyperai-grid.js` | CSS Paint Worklet | Project source; confirm contributor rights. |

## 5. Assets requiring provenance verification

| File | Required action |
|---|---|
| `public/favicon.png` | **Unverified.** Identify creator/source and license, or replace with a verified project-authored asset before release. |

No third-party font import, analytics SDK, or advertising SDK was identified in the reviewed CSS/JavaScript files. This does not rule out platform-level technologies or assets added later.

For every future third-party asset, record:
```text
File:
Asset type:
Creator / rights holder:
Original source URL:
License / permission:
Modifications:
Date verified:
```

## 6. Trademarks and no affiliation

OpenRouter, Vercel, GitHub, Shields.io, and model/provider names are used only to identify services or compatibility. Their respective owners retain all trademark rights. No official affiliation, endorsement, sponsorship, or partnership is implied unless separately documented in writing.

## 7. License boundary

The root `LICENSE` currently says MIT. The proposed AGPL-3.0-or-later transition is not applied by this attribution update. Before changing the root license, audit contributor ownership, preserve the MIT grant for already distributed versions, define the exact future-version boundary, and update `LICENSE`, `NOTICE.md`, README badges, and release notes together.

## 8. Related legal documents

- [Privacy Notice](PRIVACY.md)
- [Terms of Use](TERMS.md)
- [Cookie and Browser Storage Notice](COOKIE-NOTICE.md)
- [Security Policy](SECURITY.md)
- [Project Notices](NOTICE.md)
- [Internal Data Inventory](docs/legal-data-inventory.md)
- [Legal Readiness Checklist](docs/legal-readiness-checklist.md)

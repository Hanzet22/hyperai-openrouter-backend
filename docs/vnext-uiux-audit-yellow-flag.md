# HyperAI vNext — UI/UX Audit & Design Direction (Yellow Flag)

**Status:** Discovery and design specification only; no UI implementation changed in this batch.  
**Branch:** `hyperai-vnext/remake-foundation`  
**Scope:** Preserve existing model selection, thinking modes, optional web search, streaming, stop, clear, copy, regenerate, theme, motion, and local preference behavior.  
**Release gate:** Vercel remains PAUSED / RED FLAG. This work does not authorize a deployment, PR, merge, or legal publication.

## 1. Audit boundary

This is a source-level review of `public/index.html`, `public/hyperai.css`, `public/vnext.css`, and `public/hyperai.js`. It is not a browser-rendered audit. No assistive-technology session, real-device viewport test, or production configuration inspection was performed in this batch.

## 2. Product snapshot

- **Product:** HyperAI, a browser-based AI chat client routed through the existing backend and OpenRouter.
- **Primary user goal:** start a conversation quickly, select a model and reasoning effort, optionally request web search, and manage the response.
- **Primary layout:** top bar → model/control strip → conversation workspace → composer.
- **Visual identity to retain:** dark cyberpunk/technical console, cool blue-violet-cyan accents, compact product feel.
- **Design direction:** refine into an "Aurora Console" — calmer hierarchy, more readable controls, less compressed mobile UI, consistent surfaces, and clear status feedback.

## 3. Existing feature contract — preserve

| Capability | Existing UI/JS evidence | Redesign rule |
|---|---|---|
| Model selection | `modelPicker`, `MODELS`, `chooseModel()` | Preserve IDs, labels, selection and persistence |
| Thinking modes | `thinkingPicker`, `THINKING_MODES` | Preserve all five values and explanatory subtitles |
| Optional web search | `searchToggleBtn`, `enableSearch` request field | Keep explicit ON/OFF state and `aria-pressed` |
| Streaming | `SSEStreamDecoder` in `sendMessage()` | Preserve incremental rendering |
| Stop generation | `AbortController` and `stopBtn` | Keep visible and keyboard accessible |
| Clear conversation | `clearBtn` | Keep action clear and prevent accidental activation |
| Copy last answer | `copyLastBtn` | Preserve clipboard fallback |
| Regenerate | `regenBtn` | Preserve last-prompt behavior |
| Theme | `applyTheme()` | Preserve dark/light and local preference |
| Motion | `applyMotion()` | Preserve preference and reduced-motion override |
| Quick prompts | `[data-prompt]` | Preserve as optional starting points |

No feature should be removed or have its API contract changed as part of a visual-only pass.

## 4. Source-level findings

| Priority | Finding | Evidence / impact | Proposed treatment |
|---|---|---|---|
| P0 privacy | First-run modal contains direct personal contact and donation/payment details | `public/index.html` modal includes personal contact channels and payment information | Before public release, replace with a project-owned contact route managed by an authorized adult; remove personal payment details from the public onboarding surface. Do not invent replacement contacts. |
| P1 usability | First-run modal is a long, dense, mandatory reading surface | Large policy, safety, project, contact and donation content is placed in one dialog | Keep a short welcome/important-notice step; move full policy content to a dedicated, clearly linked Legal & Privacy surface only after approval. |
| P1 mobile | Header, model controls, and action buttons compete for limited width | Controls use a dense multi-column layout; narrow breakpoints reduce labels and control dimensions | Use a compact mobile header and a dedicated horizontal/stacked control region with readable labels and 44–48 px touch targets. |
| P1 readability | Several mobile labels and helper texts are reduced to 8–10 px | Mobile CSS includes 8 px picker subtitles and 8–9 px action labels | Raise supporting text toward 12–14 px where practical; never make essential state or action labels tiny. |
| P1 contrast | Light-theme faint text token is approximately 3.32:1 against the light background | `--faint: #78869a` on `--bg: #eef3fb`; below 4.5:1 for normal text | Darken the light-theme faint token or reserve it for non-text decoration; validate every semantic text/surface pair. |
| P1 touch | Some narrow-screen controls fall below the 44 px recommended target | vNext sets 44 px baseline, but mobile overrides include 40–43 px controls | Standardize interactive targets to at least 44 px (prefer 48 px for primary touch controls). |
| P2 navigation | There is no dedicated settings or conversation-management destination | Current screen is a single workspace with inline controls | Keep primary chat uncluttered; use a lightweight settings drawer/panel for preferences and a future conversation list only if persistence is deliberately introduced. |
| P2 status | Model details and generation state are distributed across multiple areas | Status chip, model info, stream status, and footer model all carry related context | Consolidate model identity and generation status without removing the live status announcements. |
| P2 visual | Current backdrop, gradients, orbs, borders, and animation can compete with content | Multiple decorative effects are enabled by theme/motion styles | Retain the signature, reduce decoration behind messages, and make motion strictly optional. |

### Contrast spot-check

Calculated from current CSS token values against the listed base backgrounds (source-level arithmetic, not a full rendered contrast audit):

| Pair | Approx. ratio | WCAG AA normal text |
|---|---:|---|
| Dark primary `#edf3ff` / `#080b13` | 17.67:1 | Pass |
| Dark muted `#98a6bc` / `#080b13` | 7.98:1 | Pass |
| Dark faint `#6f7c92` / `#080b13` | 4.66:1 | Pass, narrow margin |
| Light primary `#182337` / `#eef3fb` | 14.13:1 | Pass |
| Light muted `#5e6b80` / `#eef3fb` | 4.84:1 | Pass |
| Light faint `#78869a` / `#eef3fb` | 3.32:1 | Fail for normal text |

## 5. Proposed information architecture

### Main workspace
1. **Top bar:** HyperAI mark/name, service status, theme control, motion preference.
2. **Control area:** model picker, thinking picker, explicit web-search toggle; collapse into a compact mobile control panel.
3. **Conversation:** welcome/quick prompts when empty; user/assistant messages; streaming state; error state.
4. **Composer:** multiline prompt, send/stop action, character count, secondary copy/regenerate actions.
5. **Settings panel:** theme, motion, and clearly explained model preferences; no hidden controls.
6. **Legal & Privacy surface:** draft links remain non-public until reviewed and approved; no implied consent or unapproved legal acceptance flow.

### Core flows
- First visit → concise safety/eligibility notice → workspace.
- New chat → choose model/thinking/search → enter prompt → streaming → copy or regenerate.
- Generation in progress → stop → preserve already received text and show a clear stopped state.
- Error → explain recoverable issue → allow retry without losing the prompt where feasible.
- Preferences → change theme/motion → persist only the existing documented preference keys.

## 6. Design tokens — proposed starting point

| Token | Dark value | Light value | Use |
|---|---|---|---|
| `--color-bg` | `#080B13` | `#EEF3FB` | App background |
| `--color-surface` | `#111725` | `#FFFFFF` | Cards, controls |
| `--color-surface-raised` | `#192237` | `#E8EEF8` | Hover/raised surface |
| `--color-text` | `#EDF3FF` | `#182337` | Primary text |
| `--color-text-muted` | `#98A6BC` | `#536176` | Supporting text |
| `--color-text-subtle` | `#8795AA` | `#59677D` | Secondary labels; recheck contrast per surface |
| `--color-accent` | `#75ADFF` | `#286BD8` | Primary accent |
| `--color-accent-alt` | `#A08AFF` | `#7250D6` | Secondary accent |
| `--color-info` | `#50DFFC` | `#087F9C` | Focus/info |
| `--color-success` | `#52DFAA` | `#087A52` | Success |
| `--color-warning` | `#F2C66D` | `#8A5A00` | Warning |
| `--color-danger` | `#FF708B` | `#C93858` | Error |

**Type scale:** 12 / 14 / 16 / 20 / 24 / 32 / 40 px. Body copy should default to 14–16 px; essential controls should not rely on 8–10 px text.

**Spacing:** 4 px base with 8 px primary rhythm.  
**Radius:** 8 / 12 / 16 / 20 px.  
**Content width:** conversation 760–860 px; wide shell up to 1280 px.  
**Breakpoints:** 360, 560, 800, 1024, 1280 px.  
**Touch targets:** minimum 44 px; prefer 48 px on primary mobile actions.

These are design proposals; implement only after reviewing the screen-level handoff.

## 7. Screen and state inventory

| Screen/region | Required states |
|---|---|
| Welcome / first visit | default, dismissed, keyboard focus, reduced motion |
| Main workspace | empty, active conversation, long conversation |
| Model picker | closed, open, selected, keyboard navigation, disabled while generating |
| Thinking picker | closed, open, selected, keyboard navigation, disabled while generating |
| Web search toggle | off, on, disabled while generating |
| Composer | empty, typing, near limit, disabled, send-ready |
| Assistant response | waiting, streaming, complete, stopped, error, empty response |
| Message actions | enabled, disabled, copied feedback, clipboard fallback |
| Theme/motion | dark, light, advanced motion, system reduced-motion |
| Settings panel | open, closed, keyboard focus, persisted preference |
| Legal/privacy | draft-only state; do not present as approved terms |

## 8. Accessibility acceptance criteria

- Semantic landmarks and heading order; every control has an accessible name.
- Visible keyboard focus and logical focus order; Escape behavior is predictable.
- Dialog background is not operable while the dialog is open; focus returns to a sensible trigger after dismissal.
- Model/thinking controls expose selection and expanded state to assistive technology.
- Streaming announcements remain concise and do not announce every token.
- Touch targets are at least 44 px; primary mobile controls target 48 px.
- Text contrast meets 4.5:1 for normal text and 3:1 for large text and non-text controls.
- 200% zoom and narrow viewport do not cause horizontal page scrolling or hide primary actions.
- `prefers-reduced-motion` takes precedence over the advanced-motion preference.
- Test with keyboard-only navigation and at least one screen reader before claiming accessibility completion.

## 9. Implementation sequence

1. **Yellow Flag — audit and direction:** this document; no runtime changes.
2. **Foundation pass:** semantic tokens, typography, spacing, responsive control layout.
3. **Workspace pass:** top bar, controls, conversation, composer, and message actions.
4. **First-run and settings pass:** shorten onboarding, move preferences into a panel, keep legal drafts clearly unapproved.
5. **Accessibility and regression pass:** keyboard, focus, contrast, zoom, reduced motion, touch targets, and existing feature tests.
6. **Release review:** independent visual/device checks and maintainer approval. Deployment remains paused until separately authorized.

## 10. Explicit non-actions in this batch

- No backend/API behavior changed.
- No provider, account, legal, or age-eligibility policy changed.
- No personal contact or payment details were copied into this document.
- No license, legal draft, or attribution record was modified.
- No PR was opened, no merge occurred, and no Vercel deployment was created.

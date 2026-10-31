# HyperAI vNext — UI/UX Foundation

**Status:** Design baseline for implementation review  
**Tracking:** GitHub Issue #1  
**Branch:** `hyperai-vnext/remake-foundation`  
**Deployment:** PAUSED — no production deployment authorized

## 1. Product direction

HyperAI is a responsive AI chat workspace using the existing server-side OpenRouter integration. The redesign should feel like a focused, modern technical workspace while retaining HyperAI's recognizable dark/cyber identity.

Primary user job: choose an available model and reasoning mode, optionally enable supported web search, then conduct a readable streaming conversation.

Design principles:
- Conversation first; controls remain discoverable without dominating the viewport.
- Progressive disclosure for advanced settings.
- Preserve existing working behavior unless a regression or security issue requires a documented change.
- Honest status and error messages; never imply that an unavailable provider/model is active.
- Mobile-first layout with comfortable touch targets and keyboard access.
- Respect reduced-motion preferences and the existing user motion setting.

## 2. Information architecture

### Main workspace
1. **Top bar:** HyperAI identity, connection/request status, theme control, settings entry.
2. **Conversation controls:** model selector, thinking mode selector, web-search toggle (only when backend configuration permits).
3. **Conversation canvas:** welcome/empty state, user and assistant messages, streaming indicator, error/retry states.
4. **Composer:** multiline prompt, character/length feedback if applicable, send/stop controls, concise helper text.
5. **Utility actions:** clear/new chat and relevant conversation actions, preserving only capabilities confirmed in source.

### Settings and Legal Center
- Appearance: dark/light theme and motion preference.
- AI behavior: only settings supported by the current backend.
- Privacy & data: plain-language data-flow notice and links to reviewed policies.
- Legal Center: Privacy Policy, Terms, AI disclaimer, Acceptable Use, third-party disclosures, license and attribution notices.
- About: project version/build metadata when reliably available.

Avoid adding fake account, history-sync, cloud-save, or consent controls unless the backend actually supports them.

## 3. Core flows

### First visit
Open workspace → explain that prompts are sent to HyperAI's server and onward to configured AI providers → show provider/data notice → user can begin without misleading claims about data retention.

### Chat
Select model → select thinking mode → optionally enable web search if allowed → compose prompt → submit → show streaming state → render response → expose a clear recoverable error if request fails.

### Preferences
Open settings → change theme or motion → apply immediately → persist only the preferences that the current implementation supports → provide a reset path.

### Legal and privacy
Open Legal Center → select policy → show effective date and version → provide contact/data-rights process only after a real contact route and operational process are confirmed.

## 4. Visual system

The values below are a proposed starting point. Verify contrast in implementation before release.

### Brand and semantic colors

| Token | Dark | Light | Purpose |
|---|---|---|---|
| `--color-bg` | `#080B13` | `#EEF3FB` | App background |
| `--color-surface` | `#111725` | `#FFFFFF` | Main surfaces |
| `--color-surface-raised` | `#192237` | `#EDF3FD` | Hover/raised surfaces |
| `--color-text` | `#EDF3FF` | `#182337` | Primary text |
| `--color-text-muted` | `#A8B4C8` | `#536178` | Secondary text |
| `--color-border` | `#344158` | `#CBD5E3` | Borders |
| `--color-primary` | `#75ADFF` | `#286BD8` | Primary action |
| `--color-accent` | `#A08AFF` | `#7250D6` | Secondary accent |
| `--color-info` | `#50DFFC` | `#087F9C` | Information/focus |
| `--color-success` | `#52DFAA` | `#087A52` | Success |
| `--color-danger` | `#FF708B` | `#C93858` | Errors/destructive actions |

Use semantic tokens in components; do not hard-code colors repeatedly. Warning states require a separately tested amber token.

### Typography
- UI: system sans-serif stack; use Inter only if bundled/licensed or loaded from an approved source.
- Body: 14–16 px desktop, 14–16 px mobile.
- Labels/meta: 12 px minimum where practical; avoid tiny low-contrast helper text.
- Headings: fluid scale, strong hierarchy, restrained letter spacing.
- Message content: readable line length and generous line-height.

### Spacing and geometry
- 4 px base spacing; common steps 8, 12, 16, 24, 32.
- Main content max width: approximately 900 px.
- Control radius: 10–14 px; panel radius: 16–20 px.
- Interactive target: minimum 44 × 44 CSS px.
- Use consistent border and elevation tokens; avoid excessive glass/blur effects that reduce legibility.

### Responsive breakpoints
- Compact: up to 560 px — stacked controls, full-width composer, safe-area padding.
- Medium: 561–800 px — two-column control layout.
- Wide: above 800 px — horizontal controls and centered conversation column.
- Test at 320 px width, common Android widths, tablet portrait/landscape, and desktop.

## 5. Component inventory and states

| Component | Required states and behavior |
|---|---|
| Top bar | default, narrow layout, focus-visible |
| Model selector | closed, open, selected, loading, unavailable, error |
| Thinking selector | closed, open, selected, unsupported |
| Web-search control | enabled, disabled by policy/config, unavailable |
| Message bubble | user, assistant, streaming, code, links, long content |
| Composer | empty, typing, disabled, submitting, over limit, error |
| Send/stop | idle, submitting, streaming, disabled |
| Toast/alert | info, success, warning, error; announced accessibly |
| Modal/dialog | open, close, focus trap, Escape behavior, focus return |
| Legal document view | loading, content, unavailable, version/effective date |

## 6. Accessibility baseline

- Target WCAG 2.2 AA; verify contrast for all text and interactive states.
- Semantic landmarks and correctly nested headings.
- Every control has an accessible name; icon-only controls need labels.
- Visible keyboard focus and logical tab order.
- Dialogs manage focus and restore focus on close.
- Streaming updates must not overwhelm screen readers; use restrained live-region announcements.
- Respect `prefers-reduced-motion` in addition to the in-app motion preference.
- Do not communicate status using color alone.
- Ensure zoom/reflow and long messages remain usable.

## 7. Privacy and trust guardrails

- Clearly describe the actual data path: browser → HyperAI backend → OpenRouter → selected model/provider, as applicable.
- Do not promise zero retention, no training, encryption details, deletion, or data residency without verified provider and hosting evidence.
- Distinguish browser preferences from cookies; audit actual storage before building preference controls.
- Do not add analytics/telemetry by default.
- Publish policy version/effective date only after maintainer review.
- Keep secrets out of frontend bundles, documentation, issue comments, and test fixtures.

## 8. Implementation sequence

1. Inventory current DOM IDs, event handlers, API contracts, and all existing user-facing features.
2. Extract/normalize design tokens without changing behavior.
3. Refactor shared shell and responsive layout.
4. Rework workspace components and interaction states.
5. Add settings and Legal Center using verified product capabilities.
6. Complete accessibility, regression, privacy, and security checks.
7. Prepare a reviewable PR; do not merge or deploy without maintainer approval.

## 9. Acceptance gates

- Existing chat, streaming, model selection, thinking modes, optional search, theme, motion, and privacy notice behavior are regression-tested.
- No secrets or unsupported data-handling claims are introduced.
- Mobile and desktop layouts pass manual review.
- Keyboard and screen-reader interaction is usable.
- License and attribution changes are based on an ownership/dependency audit.
- Production deployment remains paused until explicit approval.

# HyperAI vNext — Putaran 100–120: Security & WebGL Animation

**Branch:** `hyperai-vnext/remake-foundation`  
**Deployment:** PAUSED / RED FLAG. No PR, merge, or Vercel deployment was created.

## Baseline

The preceding Node.js 24.22.1 / 26.12.1 GitHub Actions matrix completed successfully on commit `a4da40b4f0daf9e28b548fd3903de8b1b74aea35` before this batch.

## WebGL finding

The previous `public/visuals.js` embedded GLSL shader strings with escaped backslash-n sequences. GLSL requires the `#version 300 es` directive to be the first directive on its own source line; the escaped text could cause shader compilation to fail. The previous implementation also looked up uniform locations during every animation frame and did not dynamically react to changes in the operating-system reduced-motion preference.

## Changes

- Moved GLSL into `public/shaders.js` with actual line breaks and explicit WebGL 2.0 shader declarations.
- Reworked `public/visuals.js` to compile/link shaders with error checks, cache uniform locations, release shader objects after linking, and use a low-power WebGL context without depth/stencil/antialiasing.
- Added a 2D Canvas fallback when WebGL2 is unavailable or shader initialization fails.
- Added a context-loss fallback so the ambient effect can continue on Canvas 2D after a WebGL context loss.
- Capped device pixel ratio at 1.5 and animation rendering at approximately 30 FPS.
- Kept animation opt-in through the existing Advanced Motion toggle; animation also pauses when the document is hidden or the OS requests reduced motion.
- Added cleanup for observers and event listeners on final page exit, while preserving animation lifecycle when the page is restored from the back-forward cache (bfcache).
- Added Node tests for GLSL version directives, actual newline characters, and shader input consistency.

## Security and performance notes

- The renderer is decorative only: it does not read user input, chat content, network data, or browser storage.
- The canvas remains `aria-hidden` and ignores pointer input.
- WebGL is optional; unsupported or failed initialization falls back to Canvas 2D.
- This batch does not add runtime dependencies, third-party scripts, or new network requests.
- This is a source-level hardening pass, not a full browser/device penetration test.

## Verification

GitHub Actions will run the existing Node.js 24.22.1 and 26.12.1 test matrix and JavaScript syntax checks on this branch. Node tests validate shader source structure, but they do not compile GLSL in a real browser GPU context. Browser/device verification remains required for WebGL2, Canvas fallback, context loss, reduced-motion changes, and mobile performance.

## Unchanged

No backend routes, API contracts, secrets, environment variables, production settings, Vercel deployment, PR, or merge were changed. Vercel remains PAUSED / RED FLAG.

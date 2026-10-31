# Putaran 18–29 — Frontend Separation

## Completed
- Extracted the former inline document stylesheet into `public/hyperai.css`.
- Extracted the client runtime into `public/hyperai.js` as an ES module.
- Kept the existing `public/vnext.css` responsive/accessibility layer linked.
- Added a feature-detected CSS Houdini paint worklet with native CSS fallback.
- Added optional WebGL2/Canvas ambient visuals; neither is required for chat operation.
- Added an SVG brand mark asset.
- Added a Tailwind v4 design-token entrypoint at `src/styles/tailwind.css`.
- Added an Astro migration checkpoint at `src/pages/index.astro`.

## Deliberate compatibility boundary
The static `public/index.html` remains the active entry. The Astro route is only a migration checkpoint; it is not yet wired as the active production route. This avoids silently replacing the working chat page with an incomplete shell or changing Vercel Function routing while deployment is paused.

## Not yet complete / not claimed
- Tailwind has not been compiled into the active page; no package/build dependency has been installed.
- Astro is not yet the active page renderer; no Vercel adapter or build-output routing has been selected.
- WebGL shader execution and Canvas fallback have not been runtime-tested on mobile devices.
- CSS Houdini support/fallback has not been browser-tested.
- No visual regression, browser, accessibility, or API streaming integration suite was run in this turn.
- No backend API, environment variable, license, or deployment configuration was changed.

## Required next gates
1. Add a reproducible build/test environment and pin Astro/Tailwind versions.
2. Integrate the existing full chat markup into the Astro page rather than the temporary checkpoint.
3. Verify static asset paths and Vercel Function routing in a preview environment.
4. Test WebGL2, Canvas 2D fallback, Houdini unsupported-browser fallback, reduced motion, and mobile performance.
5. Keep production deployment paused until maintainer approval.

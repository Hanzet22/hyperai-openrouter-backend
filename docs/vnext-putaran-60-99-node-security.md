# HyperAI vNext — Putaran 60–99: Node.js Security Baseline

**Branch:** `hyperai-vnext/remake-foundation`  
**Deployment:** PAUSED / RED FLAG. No Vercel deployment or production runtime setting was changed.

## Security advisory reviewed

The Node.js Project published its 21 October 2026 security release covering the 22.x, 24.x, and 26.x release lines. The advisory includes high-severity DNS, TLS, and Brotli decoder issues, plus additional medium- and low-severity fixes.

The most urgent issue is CVE-2026-111497 in the Brotli decoder. The Node.js advisory describes an out-of-bounds write that may lead to process crashes, memory disclosure, or remote code execution when attacker-controlled Brotli input is decoded.

Patched release baselines published by the Node.js Project:

| Release line | Patched version |
|---|---:|
| 22.x | 22.23.4 |
| 24.x | 24.22.1 |
| 26.x | 26.12.1 |

Sources:
- Node.js Project: https://nodejs.org/en/blog/vulnerability/october-2026-security-releases
- Node.js releases: https://github.com/nodejs/node/releases
- NHS England cyber alert (active exploitation update, 29 October 2026): https://digital.nhs.uk/cyber-alerts/2026/cc-4881

## Changes delivered

- Added `.nvmrc` and `.node-version`, pinning the latest Current security-patched release, Node.js 26.12.1.
- Declared the supported runtime range in `package.json`: Node.js >=24.22.1 and <27.
- Updated GitHub Actions to test both the patched Node.js 24 LTS release (24.22.1) and the patched Node.js 26 Current release (26.12.1).
- Updated Actions checkout/setup-node from v4 to v5 to remove the previous Node.js 20 action-runtime warning.
- Added a runtime test that rejects unsupported major versions and versions below the patched baselines.
- Kept the existing dependency-free test and syntax-check flow. No application runtime dependencies were introduced.

## Runtime policy

- Node.js 26.12.1 is the repository's pinned development/CI default.
- Node.js 24.22.1 remains an explicitly tested LTS-compatible baseline.
- Node.js 22 is no longer in the declared supported application range.
- Vercel's configured production runtime is a separate platform setting and has **not** been changed or verified by this repository-only update.
- Before deployment, verify the selected Vercel Node.js runtime is a patched supported release and check the actual build/runtime version from deployment logs.

## Verification status and limitations

This commit records source/configuration changes. GitHub Actions must complete on the updated branch before the new matrix is considered verified. The repository does not currently have an Astro build pipeline or package lockfile, so this phase does not claim an Astro build, Vercel routing validation, or a production runtime upgrade.

No backend endpoint, secret, environment variable, Vercel project setting, deployment, merge, or PR was changed.

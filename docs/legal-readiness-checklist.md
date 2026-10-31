# HyperAI Legal Readiness Checklist — Putaran 126–139

**Status:** DRAFT DOCUMENTATION CREATED; PUBLIC RELEASE BLOCKED.

## Required before public release

- [ ] Name the adult legal operator/controller and verify authority to operate the service.
- [ ] Confirm the operator is eligible under OpenRouter's 18+ Terms and has authority to bind any organization.
- [ ] Fill privacy/security contact email and legal contact address.
- [ ] Have counsel review Privacy Notice, Terms, Cookie/Storage Notice, and governing-law/dispute wording.
- [ ] Confirm Vercel account ownership, deployment region, logs, retention, cookies, analytics, subprocessors, and DPA.
- [ ] Confirm OpenRouter account eligibility, API use rights, model/provider terms, prompt logging settings, training preferences, retention, and DPA availability.
- [ ] Restrict model picker to providers/models whose terms and data practices have been reviewed.
- [ ] Complete international transfer assessment and safeguards where required.
- [ ] Define and test access/correction/deletion/objection/complaint workflows.
- [ ] Verify live cookies, localStorage, response headers, and all third-party requests in a clean browser.
- [ ] Complete a source/asset/license audit, including the origin and license of `public/favicon.png`.
- [ ] Decide the license transition only after checking contributor ownership and documenting the effective commit/release boundary.
- [ ] Add visible links to the approved public legal pages and an accessible way to reach the operator.
- [ ] Obtain approval from the adult operator before deployment.

## Explicitly not done in this batch

- No Vercel deployment, production setting, provider setting, account, or API key was accessed or changed.
- No cookie banner or consent mechanism was added; the source review did not identify app-set cookies or analytics, and legal necessity depends on actual deployment and jurisdiction.
- No claim of GDPR, UU PDP, PSE, or other regulatory certification is made.
- The root `LICENSE` remains MIT pending rights/contributor audit for the proposed AGPL-3.0-or-later transition.

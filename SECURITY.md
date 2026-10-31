# HyperAI Security Policy

## Supported development branch

Security fixes are currently developed on `hyperai-vnext/remake-foundation`. Production support status is not declared while deployment is paused.

## Reporting a vulnerability

Please do not publish secrets, personal data, exploit payloads, or sensitive vulnerability details in a public issue.

- Preferred channel: GitHub private vulnerability reporting for this repository, if enabled.
- Alternative private contact: [PLACEHOLDER — adult operator's monitored security email].

Include the affected component, impact, reproducible high-level steps, and a safe way to coordinate a fix. Do not access, alter, or disclose other users' data while investigating.

## Scope and authorization

Only test systems and accounts you own or have explicit written permission to assess. Do not perform denial-of-service testing, credential attacks, or testing against upstream providers without their prior authorization.

## Response expectations

The operator should acknowledge reports, assess severity, coordinate remediation, and publish advisories when appropriate. No response-time SLA is promised until an adult operator formally adopts one.

## Secret handling

Never include API keys, tokens, passwords, cookies, private user content, or production environment values in issues, commits, screenshots, or public logs. Rotate any secret that may have been exposed.

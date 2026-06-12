# Security Policy

## Reporting a vulnerability

Email **juanse.hevia@gmail.com** with subject `[kerkit security]`. Please do not open a public issue for security reports.

You can expect an acknowledgment within 7 days. We follow a **90-day coordinated disclosure** window: we'll work with you on a fix and credit you in the release notes unless you prefer otherwise.

## Scope notes

- kerkit packages do not implement authentication or OAuth flows. Those surfaces live in **consumer applications** — `@kerkit/server` route factories take a `getUserId(req)` function and never handle credentials themselves. Vulnerabilities in your auth integration belong to your app's policy, not this one.
- Reports about **PII leakage** are explicitly in scope, and held to a high bar: if you find a path where data classified as `direct-identifier` reaches an LLM provider unredacted through documented kerkit APIs, that is a security bug here.

## Supported versions

Pre-1.0: only the latest published 0.x minor receives fixes.

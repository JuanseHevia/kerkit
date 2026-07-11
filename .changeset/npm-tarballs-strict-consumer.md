---
"@kerkit/core": patch
"@kerkit/pack-argentina": patch
"@kerkit/ai": patch
"@kerkit/server": patch
"@kerkit/ui": patch
---

Make the published npm tarballs complete and strict-consumer safe.

- Every package tarball now ships the Apache `LICENSE` and `NOTICE` (copied in at
  `prepack`), alongside the existing `README.md`, metadata, JS, and declarations.
- `@kerkit/server` now declares `@types/express` as a dependency, so a strict
  consumer with `skipLibCheck: false` can resolve its public Express-typed
  surface (`createPrivacyRouter`, `PrivacyRouterOptions`) without adding `@types`
  themselves.
- All publishable packages declare `engines` (`node >=22`, `npm >=10`) so
  unsupported Node versions get a clear install-time warning, matching the
  README's Node 22+ requirement.

No public API changed.

# @kerkit/pack-argentina

## 0.2.0

### Minor Changes

- bcf2ce9: Complete the deterministic M2 privacy gate and make provider safety structural.

  - Add public typed PII patterns, confidence tiers, spans, and sync/async detector interfaces.
  - Normalize NFKC text, zero-width/control characters, and identifier spacing while preserving
    original offsets; resolve overlaps deterministically and replace spans right-to-left.
  - Make async detector failures fail closed at the provider boundary.
  - Expand the Argentina pack with typed DNI, validated CUIL/CUIT, phone, email, credential, and
    labeled-address detection plus the versioned `es-ar-v1` adversarial corpus.
  - Gate high-confidence corpus recall and structural redaction properties. Heuristic recall and
    false positives are reported with masked case diagnostics rather than blocking initially.

  Free-text detection remains a measured, extensible defense and is not a guarantee over arbitrary
  language. Consumers may add `PiiDetector` implementations for their own domains and locales.

### Patch Changes

- 0253c53: Make the published npm tarballs complete and strict-consumer safe.

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

- Updated dependencies [0253c53]
- Updated dependencies [bcf2ce9]
- Updated dependencies [aba1df2]
  - @kerkit/core@0.2.0

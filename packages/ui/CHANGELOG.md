# @kerkit/ui

## 0.2.0

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

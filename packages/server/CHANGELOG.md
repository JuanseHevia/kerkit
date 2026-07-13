# @kerkit/server

## 0.2.0

### Patch Changes

- fe7fd59: Upgrade Drizzle to a patched release and gate known high/critical advisories.

  **Security fix.** `drizzle-orm` versions below `0.45.2` are affected by an
  identifier-escaping SQL injection advisory
  ([GHSA-gpj5-g38j-94v9](https://github.com/advisories/GHSA-gpj5-g38j-94v9)).
  The lockfile previously resolved `drizzle-orm@0.39.3`. This release moves the
  resolved dev/build version to `0.45.2` and raises `@kerkit/server`'s
  `drizzle-orm` peer-dependency floor from `>=0.38.0` to `>=0.45.2` so the
  published package no longer advertises support for any affected version.

  **Action required.** Consumers must be on `drizzle-orm >=0.45.2`. Kerkit's
  schema/repository code uses only static identifiers, so this is a defense-in-depth
  tightening rather than a fix for an exploitable path in Kerkit itself, but the
  peer range is intentionally strict for the public launch. The public API of
  `@kerkit/server` is unchanged.

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

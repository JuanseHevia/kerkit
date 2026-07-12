# Releasing kerkit

How the `@kerkit/*` packages get to npm — reproducibly, auditably, and with
provenance — instead of a manual `npm publish` from an unverified laptop.

This runbook is the definition of "done" for a release. If you are doing the
**very first** publish, read [First publish](#first-publish-one-time-bootstrap)
first: it lists the one-time account/settings steps that only a human with npm
and GitHub admin access can do.

---

## What ships

Five public packages, versioned **in lockstep** (Changesets `fixed` group
`@kerkit/*`), all `Apache-2.0`, all `publishConfig.access = "public"`:

| Package | npm name |
| --- | --- |
| core | `@kerkit/core` |
| ai | `@kerkit/ai` |
| pack-argentina | `@kerkit/pack-argentina` |
| server | `@kerkit/server` |
| ui | `@kerkit/ui` |

Example apps under `examples/*` are `private` and never publish.

**First public version: `0.2.0`.** The repo sits at `0.1.0` (never published).
The pending product changeset (`.changeset/redaction-session-sink.md`) is a
`minor`, and because the group is fixed, it bumps all five to `0.2.0` together.
`0.2.0` is therefore the deliberate first public version — not an accident of
tooling. If you want a different first version, edit/replace the changesets
before versioning; do not hand-edit `version` fields.

Pre-1.0 caveat (already documented in `CONTRIBUTING.md` / `README.md`): a
`minor` may contain breaking changes; breaking changes are called out in each
package's `CHANGELOG.md`.

---

## Access & recovery

> These are account facts, not repo files. Keep them true; this section is the
> source of truth for "who can publish and who recovers it."

- **npm scope/org:** `@kerkit` on npmjs.com.
- **Recovery owner:** at least two humans — or one human **plus** a documented
  recovery owner — must have `owner`/`admin` on the `@kerkit` org so a single
  lost account never strands the packages. Record the current owners in the org
  settings and mirror the maintainer list in [`.github/CODEOWNERS`](.github/CODEOWNERS).
- **2FA:** every publisher account has 2FA enabled, and the org requires 2FA for
  writes. CI publishing satisfies this via an **automation** token (2FA-exempt
  by design) or via **trusted publishing** (no long-lived secret at all).

If you are ever locked out, the recovery owner deprecates the compromised
tokens (npm → Access Tokens) and rotates `NPM_TOKEN` (see below).

---

## How automated releases work

One workflow, [`.github/workflows/release.yml`](.github/workflows/release.yml),
runs on every push to `main` and does one of two things via
[`changesets/action`](https://github.com/changesets/action):

1. **Changesets are pending →** it opens/updates a **"Version Packages"** PR.
   That PR runs `changeset version`: bumps all five packages to the next
   version, updates internal `@kerkit/*` dependency ranges in lockstep, consumes
   the changeset files, writes each `CHANGELOG.md` from them, and refreshes the
   npm lockfile workspace metadata.
2. **No pending changesets (the Version PR was merged) →** it runs
   `npm run release` (`turbo build && changeset publish`): builds, publishes to
   npm **with provenance**, creates the git tags, and creates a **GitHub
   Release** per package from the changelog (`createGithubReleases: true`).

Because versioning happens in step 1 and publishing in step 2, **versioning
always precedes publishing**, and the **tag, GitHub Release, and npm version all
come from the same `changeset publish` run**, so they agree by construction.

### Credentials the workflow uses

- `GITHUB_TOKEN` — provided automatically; opens the Version PR, pushes tags,
  creates Releases (`contents: write`, `pull-requests: write`).
- `id-token: write` — lets npm attach a **provenance** attestation
  (`NPM_CONFIG_PROVENANCE=true`) and, if you adopt it, OIDC trusted publishing.
- `NPM_TOKEN` (repo/environment **secret**) — a least-privilege **Automation**
  token scoped to publish `@kerkit` only. Never printed, never exposed to PRs.

> **PRs never see these.** The dry-run gate below runs on `pull_request` with
> `contents: read` and **no** secrets and **no** `id-token`, so a fork PR has
> nothing to exfiltrate and still proves a release would succeed.

GitHub repository settings must also allow Actions to create pull requests
(Settings → Actions → General → Workflow permissions). Keep the default token
permission read-only; the release job requests only its explicit scoped writes.
If an administrator does not enable the repo-level PR switch, the action can
still generate and push `changeset-release/main`, but a maintainer must open the
Version PR from that branch manually, preferably as a draft.

### Preferred hardening: trusted publishing (OIDC)

Once the packages exist on npm, configure **trusted publishing** for each
package (npm package → Settings → Trusted Publisher → GitHub Actions →
`JuanseHevia/kerkit`, workflow `release.yml`). Then you can delete the
`NPM_TOKEN` secret entirely — the workflow already requests `id-token: write`.
Until every package is registered as a trusted publisher, keep `NPM_TOKEN` as
the auth path. (Trusted publishing for a brand-new package name may require the
first publish to seed the package; see the manual bootstrap below.)

---

## Dry-run gate (pull requests)

[`.github/workflows/release-dry-run.yml`](.github/workflows/release-dry-run.yml)
runs on every PR with no credentials and:

- `npx changeset status` — prints the pending release plan (the release-notes
  source) and fails on a malformed changeset. On the reserved generated
  `changeset-release/main` branch, where changesets are intentionally consumed,
  the gate instead asserts that no pending changeset files remain.
- `node scripts/verify-publish.mjs` — dry-run `npm publish` for **all five**
  packages and asserts each would publish under its `@kerkit/*` name with
  **public** access (`npm run verify-publish` locally).

---

## Cut a release (steady state)

From a clean `main`:

```bash
# 1. Add a changeset with your change (contributors do this in their PR).
npm run changeset          # pick packages + bump; writes .changeset/<name>.md

# 2. Merge to main. The Release workflow opens a "Version Packages" PR.
# 3. Review that PR (versions + CHANGELOGs), then merge it.
# 4. Merging it triggers the publish job automatically. Done.
```

You typically touch nothing else — the workflow tags, publishes with
provenance, and cuts the GitHub Releases.

---

## First publish (one-time bootstrap)

The very first publish needs account/settings work that is **not** in this repo
and that this runbook cannot automate. Do these once, in order:

**Manual (npm / GitHub web UI — a human with admin must do these):**

1. **Create/verify the `@kerkit` org** on npmjs.com and confirm you own the
   scope (`npm org ls kerkit`).
2. **Add the recovery owner** to the org; enable **2FA** on all accounts and
   require 2FA for the org.
3. **Create a least-privilege Automation token** (Access Tokens → Generate →
   Automation), scoped to publish `@kerkit`. Add it to GitHub as the repo/env
   secret **`NPM_TOKEN`**. Never paste it into a file, commit, or log.
4. *(Optional but recommended)* enable **branch protection** on `main` requiring
   the `Build & test`, `Release dry-run`, and PII-scan checks and a Code Owner
   review, so releases can't be pushed around the workflow.

**Automated (this repo already provides):** the release + dry-run workflows,
`publishConfig.access:"public"` on every package, provenance wiring, the
`verify-publish` pre-flight, `CODEOWNERS`, and this runbook.

**Then drive the first release** — either let the workflow do it (recommended:
land the pending changeset → merge the Version PR → publish job runs), or, if
you must bootstrap by hand from a clean checkout:

```bash
git clone https://github.com/JuanseHevia/kerkit && cd kerkit
git checkout main && git status        # clean tree
npm ci
npm run build
npm run verify-publish                 # dry-run all 5, public access
npx changeset version                  # 0.1.0 -> 0.2.0 across the group
git commit -am "chore(release): version packages"
# Auth once for a manual publish (interactive, 2FA):
npm login
NPM_CONFIG_PROVENANCE=true npm run release   # build + changeset publish
git push --follow-tags                 # push the version commit + tags
```

Prefer the workflow. Only hand-publish to seed package names that trusted
publishing can't create yet, and delete the local token/session afterward.

---

## Verify a release

Run the issue's verification commands and confirm each agrees:

```bash
npm whoami                              # confirms you're authenticated
npm access list packages kerkit         # lists the 5 @kerkit packages + access
npx changeset status                    # pending plan is empty right after release
# Dry-run every package (no publish, no creds):
npm run verify-publish
```

Confirm the three sources agree for `0.2.0`:

- git tags: `git tag --list '@kerkit/*@0.2.0'` (or `v0.2.0` per your tag style)
- GitHub Releases: one per package at `0.2.0`
- npm: `npm view @kerkit/core version` … for all five

### Fresh registry install (final gate)

Prove a brand-new consumer can install and use it, from a throwaway project:

```bash
node scripts/smoke-install.mjs 0.2.0    # installs from the registry, runs, typechecks
```

The script creates a temp project, installs all five packages **from npm**,
imports `@kerkit/core` + `@kerkit/ui/tokens` at runtime, and typechecks imports
from every package. Exit 0 = the release is consumable.

After a green smoke test, flip the "not yet published" notes in `README.md`
(status line + the install table footnote) to reflect that `npm i @kerkit/*`
now works.

---

## Rollback / deprecation (bad publish)

npm publishes are effectively immutable — you cannot overwrite a version. Choose
the least-destructive fix:

1. **Deprecate** (preferred) — steer installs to a good version without deleting:
   ```bash
   npm deprecate "@kerkit/core@0.2.0" "Broken release; use 0.2.1" --otp=<code>
   ```
   Repeat per affected package (do all five to keep the group consistent).
2. **Publish a fix forward** — add a changeset, let the workflow cut `0.2.1`.
   This is the normal remedy; prefer it over unpublish.
3. **Unpublish** — only within npm's **72-hour** window and only if the version
   is truly unusable and unlikely to be depended on:
   ```bash
   npm unpublish "@kerkit/core@0.2.0" --otp=<code>
   ```
   Unpublishing can break consumers and blocks re-publishing the same
   version+name for 24h. Treat it as a last resort.
4. **Clean up git/GitHub** if you unpublished: delete the tag
   (`git push origin :refs/tags/@kerkit/core@0.2.0`) and the matching GitHub
   Release so tags/Releases/npm stay in agreement.
5. **If a secret leaked**, revoke the token in npm → Access Tokens and rotate
   the `NPM_TOKEN` secret immediately; the recovery owner assists if you are
   locked out.

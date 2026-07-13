# Public launch runbook — source repository

This is the operator checklist for flipping `JuanseHevia/kerkit` from **private**
to **public** and putting merge protection on `main`. It covers issue
[#9](https://github.com/JuanseHevia/kerkit/issues/9).

Everything here is a **manual, credentialed step**: it changes repository
settings, visibility, or rulesets, and therefore needs a repo-admin token or a
click in the GitHub web UI. None of it runs in CI. The in-repo artifacts this
runbook references (the ruleset JSON, the apply script, `CODEOWNERS`,
`SUPPORT.md`, the issue-form contact links) are already committed — this
document is how you apply them.

> **This is the npm-free launch.** Do **not** publish to npm as part of this.
> npm scope authority and the first-publish workflow are a separate milestone
> (issues #11 and #14).

## Preconditions (launch gate)

Do not start until **all** of these hold:

- [ ] #12 (upgrade Drizzle, gate high/critical advisories) is merged.
- [ ] #13 (`createRedactedChat` is the canonical AI quickstart) is merged.
- [ ] #10 (author guide refreshed, source links repaired) is merged.
- [ ] The latest CI run on `main` is green.
- [ ] You are authenticated as a repo admin: `gh auth status` and
      `gh api user --jq .login` show the right account.

## Step 1 — Description, homepage, and topics

Communicates the four required facets: **caretaker logistics**, **TypeScript
SDK**, **privacy**, and **Argentina-first** scope.

```bash
gh repo edit JuanseHevia/kerkit \
  --description "Privacy-first TypeScript SDK for caretaker-logistics apps (appointments, trámites, recetas) — Argentina-first. Not a medical device." \
  --homepage "https://github.com/JuanseHevia/kerkit#readme" \
  --add-topic typescript \
  --add-topic sdk \
  --add-topic privacy \
  --add-topic pii-redaction \
  --add-topic data-privacy \
  --add-topic caregiving \
  --add-topic caretaker \
  --add-topic healthcare-logistics \
  --add-topic healthtech \
  --add-topic argentina \
  --add-topic es-ar \
  --add-topic llm \
  --add-topic ai \
  --add-topic monorepo
```

Verify:

```bash
gh repo view JuanseHevia/kerkit --json description,homepageUrl,repositoryTopics
```

## Step 2 — Support / community channel (decision: Issues)

**Decision:** support lives in **GitHub Issues**; **Discussions stays disabled**
for launch. Rationale: a single maintainer is best served by one triage surface,
and the two issue forms (bug, eval scenario) plus the private security path in
`SECURITY.md` already cover every request type. This is documented for visitors
in [`SUPPORT.md`](../SUPPORT.md) and surfaced from the new-issue chooser via the
"Questions & support" contact link in
[`.github/ISSUE_TEMPLATE/config.yml`](../.github/ISSUE_TEMPLATE/config.yml).

No settings action is required to keep support in Issues. **Only if** you later
decide to open Discussions: enable it under *Settings → General → Features →
Discussions*, then update `SUPPORT.md` to point there.

## Step 3 — Make the repository public

UI: *Settings → General → Danger Zone → Change visibility → Make public*.

CLI equivalent:

```bash
gh repo edit JuanseHevia/kerkit \
  --visibility public \
  --accept-visibility-change-consequences
```

## Step 4 — Protect `main` with a ruleset

The ruleset is committed at
[`.github/rulesets/main-branch-protection.json`](../.github/rulesets/main-branch-protection.json).
It requires a pull request, requires the five CI checks
(`PII / secret scan (gitleaks)`, `Build & test`,
`Dependency audit (high/critical gate)`, `Packed-consumer verification`,
`npm pack content audit`),
blocks force pushes (`non_fast_forward`), and blocks branch deletion
(`deletion`). `bypass_actors` is empty, so the rules apply to everyone — including
the owner.

Apply it (idempotent — creates on first run, updates thereafter):

```bash
scripts/apply-main-ruleset.sh           # or: DRY_RUN=1 scripts/apply-main-ruleset.sh
```

Or by hand:

```bash
gh api --method POST repos/JuanseHevia/kerkit/rulesets \
  --input .github/rulesets/main-branch-protection.json
```

> **Status-check name matching.** The `context` values must match the check-run
> names GitHub actually reports — these equal the CI job `name:` fields in
> `.github/workflows/ci.yml`. If a required check never turns green, open a
> recent run, copy the exact check name, and update the JSON.

> **Break-glass (optional).** If you ever need a direct push to `main`, prefer a
> temporary bypass: add your account to `bypass_actors` in the JSON, re-run the
> apply script, do the push, then revert. Do not weaken the rules permanently.

**Classic branch-protection alternative** (if you prefer the older API to a
ruleset — pick one, not both):

```bash
gh api --method PUT repos/JuanseHevia/kerkit/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=PII / secret scan (gitleaks)' \
  -f 'required_status_checks[contexts][]=Build & test' \
  -f 'required_status_checks[contexts][]=Dependency audit (high/critical gate)' \
  -f 'required_status_checks[contexts][]=Packed-consumer verification' \
  -f 'required_status_checks[contexts][]=npm pack content audit' \
  -f 'required_pull_request_reviews[required_approving_review_count]=0' \
  -F 'enforce_admins=true' \
  -F 'restrictions=null' \
  -F 'allow_force_pushes=false' \
  -F 'allow_deletions=false'
```

Verify protection is live:

```bash
gh api repos/JuanseHevia/kerkit/rulesets --jq '.[] | {name, enforcement}'
```

## Step 5 — Re-run CI after the repository is public

Visibility changes can alter the `GITHUB_TOKEN` permission surface, so confirm CI
is still green on the public repo:

```bash
gh workflow run ci.yml --ref main            # if manual dispatch is enabled, else push a no-op commit via PR
gh run list --workflow ci.yml --limit 1
gh run watch "$(gh run list --workflow ci.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

All five jobs must pass: **PII / secret scan (gitleaks)**, **Build & test**,
**Dependency audit (high/critical gate)**, **Packed-consumer verification**,
**npm pack content audit**.

## Step 6 — Anonymous `npx` smoke test

Run from an environment with **no** GitHub credentials. The `env -i` wrapper
strips your shell's auth so it truly mimics an anonymous user:

```bash
env -i PATH="$PATH" HOME="$(mktemp -d)" \
  npx --yes github:JuanseHevia/kerkit 2>&1 | tee /tmp/kerkit-npx.log
```

Acceptance:

- [ ] It runs without asking for GitHub credentials and prints the demo output
      ending in `✅ PASS — no raw identifier reached the model.`
- [ ] **No npm packaging warning** appears:
      `! grep -i 'npm warn' /tmp/kerkit-npx.log` (command should find nothing).
      If a warning does appear, note which field it names (`description`,
      `repository`, `license`, `version`, …) and add it to the root
      `package.json`, then re-test.

## Step 7 — Signed-out verification

In a private/incognito window (logged out of GitHub), confirm each of these
loads for an anonymous visitor:

- [ ] Repo landing page and README render.
- [ ] README images resolve (they use repo-relative paths under
      `docs/assets/gallery/`):
      `landing.png`, `privacy-xray.png`, `privacy-sweep.png`, `assistant.png`,
      `dashboard.png`.
- [ ] Both issue forms open from *Issues → New issue*:
      **Bug report** and **Eval scenario (share domain knowledge)**.
- [ ] The new-issue chooser shows the **Questions & support** and
      **Security or PII-leak report** contact links, and both open.
- [ ] `SECURITY.md` is reachable and shows the security contact.

## Step 8 — Secrets / environments / artifacts exposure audit

Making a repo public does not expose Actions secrets, but confirm nothing
unexpected exists and no artifact carries sensitive data:

```bash
gh api repos/JuanseHevia/kerkit/actions/secrets       --jq '.secrets[].name'
gh api repos/JuanseHevia/kerkit/environments          --jq '.environments[]?.name'
gh api repos/JuanseHevia/kerkit/actions/artifacts     --jq '.artifacts[].name'
gh api repos/JuanseHevia/kerkit/actions/permissions   # confirm workflow permissions are least-privilege
```

- [ ] No secret is unexpected (CI uses only the built-in `GITHUB_TOKEN`).
- [ ] No environment holds production credentials.
- [ ] No build artifact ships non-synthetic data (the `npm pack content audit`
      job already enforces this on every run).

## Done

When Steps 1–8 pass, the source launch is complete. Leave npm publication for the
separate milestone (#11, #14).

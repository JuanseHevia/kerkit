# kerkit public-launch readiness

**Audit date:** 2026-07-10
**Commit reviewed:** `eb0497242eb9f49a84b9befebad70c30409461ff` (`main`)
**Scope:** source release, contributor onboarding, npx demo, minimal caretaker app,
gallery container, privacy boundary, package tarballs, CI, security posture, and first npm
publication.

## Verdict

**HOLD for the public flip, with a short and concrete fix list.** The SDK's value proposition
is visible, the mock apps work, the current privacy sink is materially stronger than the
author guide says, and all 204 tests pass. The current hold is not about product quality. It is
about removing three avoidable trust failures before strangers inspect the repository:

1. the lockfile and `@kerkit/server` compatibility range still permit a Drizzle version with a
   current high-severity SQL-injection advisory;
2. `packages/ai/README.md` teaches the old low-level loop without a `RedactionSession`, even
   though that is the exact path M1 identifies as unsafe for free-text names;
3. `AUTHOR_GUIDE.md` still says M1 is unimplemented and labels already-fixed bugs as critical.

After those are fixed, the **GitHub source launch is a GO**. npm publication is a separate
gate and is not ready yet.

| Launch surface | Status | Why |
|---|---|---|
| npx evaluation demo | **PASS, authenticated** | GitHub install completed in 11.38 s and its name+DNI provider-ingress check passed; repeat anonymously after the visibility flip. |
| Source clone / contributor setup | **PASS with polish** | Clean install, forced build, lint, and 204 tests passed; README count is stale. |
| Mock apps | **PASS** | Minimal API and all gallery scenes worked; Docker built and ran from the documented path. |
| Privacy claim | **PASS on the documented safe factory** | `createRedactedChat` and sink canaries cover message history, tools, errors, and external output. Low-level APIs remain opt-in. |
| Public GitHub launch | **HOLD** | Fix the three trust failures above, then set metadata/protection during the visibility flip. |
| First npm publish | **HOLD** | Registry auth/scope, release automation, package legal files, and strict consumer typing need closure. |

## Evidence collected

| Check | Result |
|---|---|
| Workspace state | `main` equals `origin/main`; only the pre-existing `.gitignore` edit was present. |
| Clean dependency install | `npm ci`: **PASS**, 398 packages, 3.50 s. |
| Forced build | `npm run build -- --force`: **PASS**, 7/7 workspaces, 4.00 s. |
| Forced lint | `npm run lint -- --force`: **PASS**, 7/7 workspaces, 3.81 s. |
| Forced tests | `npm run test -- --force`: **PASS**, 11/11 suites, **204/204 tests**. |
| Latest GitHub CI | **PASS** at current HEAD: gitleaks, build/test, and tarball PII audit all green ([run 28867673235](https://github.com/JuanseHevia/kerkit/actions/runs/28867673235)). |
| npx GitHub path | `npx --yes github:JuanseHevia/kerkit`: **PASS** on this GitHub-authenticated machine, 11.38 s, raw name and DNI absent from every recorded model input. This was not an anonymous-public test because the repository is still private. |
| Demo bundle freshness | Rebuilt to `/tmp`; byte-for-byte identical to committed `scripts/demo.bundle.mjs`. |
| Minimal app | `/health`, `/context`, `/chat`, `/privacy/export`: **PASS**; missing message returns JSON 400. |
| Gallery production app | Landing, Privacy X-Ray, Assistant, Dashboard: **PASS**; no browser console errors; desktop and 390 px mobile rendered. |
| Gallery assistant | **PASS**; two rounds, one tool call, visible `No PII leaked` result. |
| Gallery Docker path | Fresh Node 22 image build: **PASS**; container health 200; final image 141 MB. |
| Package tarballs | Five packages packed; expected JS, declarations, READMEs, and documented subpath exports present. |
| Fresh packed consumer | All public package/subpath imports compiled with `skipLibCheck: true` and ran successfully. |
| Strict packed consumer | **FAIL** with `skipLibCheck: false`; `@kerkit/server` declarations require `@types/express`, which the package does not ship. |
| Dependency audit | **FAIL**: 1 high, 1 moderate, 1 low. |
| Local Markdown targets | **FAIL**: seven `path.ts:line` links are not real files/anchors; use GitHub `#L<n>` anchors. |
| Real OpenAI path | **NOT RUN**; no `OPENAI_API_KEY` was available. Mock provider and adapter unit paths were exercised. |

The first sandboxed test attempt failed because Supertest could not bind `0.0.0.0`
(`EPERM`). The same unchanged suite passed outside that sandbox. This is an environment
restriction, not a repository failure.

## Must fix before making the repository public

### 1. Remove the known high-severity Drizzle exposure

`npm audit` resolves `drizzle-orm` to `0.39.3`. GitHub's reviewed advisory marks versions
below `0.45.2` as affected by identifier-escaping SQL injection
([GHSA-gpj5-g38j-94v9](https://github.com/advisories/GHSA-gpj5-g38j-94v9)). The current
code appears to use static schema identifiers, which reduces direct exploitability, but a
privacy-focused SDK should not launch with a known high advisory and a peer range that tells
consumers `>=0.38.0` is supported.

Required closure:

- upgrade the server workspace to `drizzle-orm >=0.45.2`;
- raise the published peer floor to `>=0.45.2`;
- run the full build/test/tarball consumer matrix;
- add a CI dependency gate at least for high/critical advisories.

The other audit findings are a moderate transitive `js-yaml` issue and a low Windows-only
esbuild development-server issue. Both have fixes available and should be cleared in the same
dependency pass.

### 2. Make the safe AI path the first and only quickstart

The root README now correctly says to use `createRedactedChat`. The package README does not.
Its flagship example assembles context without the shared session, and its loop example calls
`runChatLoop` with a tool executor whose context has no session. M1's own canary proves that
this no-session path can leak a free-text name.

Required closure:

- lead `packages/ai/README.md` with `createRedactedChat`;
- move hand-threading and raw `runChatLoop` to an explicitly advanced section;
- make every advanced snippet pass the same `RedactionSession` through patient block,
  assembler, tool context, and loop;
- clarify that structural row redaction alone does not guarantee free-text name recall;
- compile the documented snippet in CI.

For pre-1.0, the optional session plus a warning is an acceptable compatibility choice. Before
1.0, reconsider whether provider-bound input should be unrepresentable without a session.

### 3. Refresh or archive the author guide

`AUTHOR_GUIDE.md` was written against `434f1ff`; current HEAD is three commits later. Its
known-gaps section says the collision-safe token allocator, provider sink, tool-path sweep, and
canary tests do not exist. They now do. It also reports roughly 160 tests instead of 204 and
contains broken `file.ts:line` Markdown links.

Required closure:

- rewrite sections 3, 6, 9, 11, 13, and 14 against M1; or move the old guide under a clearly
  dated historical-notes directory;
- change source links to `path/to/file.ts#L123` style;
- update README and guide test counts;
- keep the remaining honest limitation: arbitrary free-text sweep recall is measured, not
  guaranteed.

## npm publication gate

The source release can precede npm. Do not publish the five packages until all of these are
true:

1. **Registry authority is proven.** `npm whoami` returned `ENEEDAUTH`, no `NPM_TOKEN` was
   present, and the `@kerkit` scope could not be verified from this machine. Confirm the npm
   org/scope, maintainer access, 2FA, and a publish token or trusted publisher.
2. **The release path is reproducible.** There is no release workflow. `npm run release`
   builds and publishes but does not run `changeset version`. Write a maintainer runbook or
   add a Changesets release action, provenance, tag, and GitHub Release.
3. **The first version is deliberate.** The pending fixed changeset plans all five public
   packages at `0.2.0`, not `0.1.0`. That is valid, but should be an explicit launch choice.
4. **Every tarball carries legal text.** Current package tarballs omit the repository's
   `LICENSE` and `NOTICE`; add them to every distributable package.
5. **Strict consumers compile.** Ship the Express declaration dependency (for example,
   `@types/express`) or remove it from the public declaration surface, then run a strict
   packed-consumer smoke test in CI.
6. **Runtime support is machine-readable.** README says Node 22+, but publishable package
   manifests have no `engines` field.
7. **The actual tarballs are the release candidates.** Run `npm publish --dry-run`, inspect
   file lists, install all tarballs into a fresh non-workspace project, typecheck, and execute
   representative imports before publish.

Nice polish for the npx path: add an explicit root `.npmignore`/package file allowlist so the
first line is not npm's `gitignore-fallback` warning.

## Contributor and repository launch setup

The contributor surface is unusually good for a pre-launch project: contribution lanes,
synthetic-data rules, a security policy, Code of Conduct, PR checklist, structured bug form,
and a no-code eval-scenario form are all present.

At the visibility flip:

- add a one-sentence GitHub description and repository topics; both are currently empty;
- decide whether GitHub Discussions is the support/community surface (currently disabled) or
  state clearly that Issues are the only supported channel;
- enable branch protection/rulesets on `main` after the repo becomes public and require the
  three CI jobs;
- verify Actions permissions and rerun CI after the visibility change;
- create the first tagged GitHub release when npm packages exist;
- avoid promising an issue-response SLA beyond what one maintainer can sustain.

## DX scorecard

| Dimension | Score | Evidence |
|---|---:|---|
| Getting started | 9/10 | **TESTED with auth.** GitHub npx path in 11.38 s; source setup/build is seconds with dependencies available. Anonymous access must be repeated after the visibility flip. |
| API / SDK ergonomics | 7/10 | **TESTED/PARTIAL.** Clear package seams and a good safe factory; low-level safety remains optional and package docs lead with it. |
| Error messages | 6/10 | **TESTED.** Missing input is clear JSON; malformed JSON/404s are generic Express HTML; sink warnings include problem and fix. |
| Documentation | 6/10 | **TESTED/INFERRED.** Strong root README and package docs, but the author guide is stale, local line links break, and there is no searchable reference site. |
| Upgrade path | 4/10 | **INFERRED.** Changesets and a good M1 migration note exist; no changelog/release automation or proven first-publish path exists yet. |
| Developer environment | 8/10 | **TESTED.** Fast clean build/lint/test, synthetic fixtures, Docker, CI; strict packed-consumer typing and engine declarations need work. |
| Community | 7/10 | **INFERRED/CURRENT GITHUB.** Excellent templates and boundaries; repository metadata, discussions decision, and branch protection remain launch actions. |
| DX measurement | 4/10 | **INFERRED.** Eval-scenario and bug forms exist; no documented activation/feedback measurement or consumer smoke telemetry. |
| **Overall** | **6.5/10** | Strong first value and product credibility; release/documentation plumbing is the gap. |

**Measured time to hello world:** 11.38 seconds for the npx privacy proof, a champion result.
The most recent planning review targeted 8/10. Live reality is 6.5/10: the demo exceeded the
plan, while npm/release/docs readiness trails it.

## Recommended order

1. Patch Drizzle and add the audit gate.
2. Replace the unsafe AI package quickstart with the factory path.
3. Refresh the author guide and broken line links; update test counts.
4. Add repository description/topics and prepare protection rules for the public flip.
5. Make the repository public, rerun CI, and repeat the public npx smoke test.
6. Treat npm as a second milestone: scope/auth, legal files, strict consumer CI, release
   automation, provenance, tag, and publish.

## Final confidence statement

The hard part is working. kerkit has a crisp problem, a convincing demonstration, credible
privacy architecture, fast feedback, and a contributor story that respects the sensitivity of
the domain. The current hold is a one-pass launch-hardening job. Clear the three public-repo
blockers, and this is ready to invite people into. Do not let npm publishing pressure delay the
source launch; make it an explicit second gate.

---

## 2026-07-12 closure record

This appendix preserves the original audit above as the historical evidence record and records
the pre-publish hardening closure after reconciling with `main` at `145c25f`.

**Updated verdict:** **GO to merge the hardening PR; HOLD publication.** The source, package,
security, and deterministic privacy gates are green. npm scope ownership, 2FA, the one-time
bootstrap credential, and trusted-publisher activation remain external release-day gates. No
publish command or protected publish workflow was invoked.

| Original blocker | Closure |
|---|---|
| Drizzle advisory and permissive peer floor | `drizzle-orm` is `>=0.45.2`; production audit reports zero vulnerabilities; CI blocks high/critical advisories. |
| Unsafe AI quickstart and optional session boundary | `createRedactedChat` is canonical; low-level context, prompt, loop, tool, and MCP APIs require one session; provider input is branded. |
| Stale author guide and broken source anchors | The private author guide was removed from the public tree; the tracked anonymization framework now carries current M1/M2 status and repaired source links. |
| Incomplete package tarballs and strict-consumer failure | All five tarballs contain `LICENSE`, `NOTICE`, README, JS, and declarations; a fresh consumer passes the Kerkit declaration gate with `skipLibCheck: false` and executes 23 public-entrypoint checks. |
| Missing release authority/workflow | Changesets and the protected trusted-publishing workflow are present. The hardening Changeset resolves the fixed package group to `0.2.0`; publication remains deliberately uninvoked. |

### Final local verification

| Check | Result |
|---|---|
| Forced build | **PASS**, 7/7 workspaces. |
| Forced lint | **PASS**, 7/7 workspaces. |
| Forced tests | **PASS**, 11/11 tasks, **188/188 tests**. The sandboxed Supertest bind still needs an unsandboxed local run; that unchanged run passed. |
| Production dependency audit | **PASS**, zero vulnerabilities. |
| Publish dry-run | **PASS**, 5/5 packages validate public access. |
| Packed fresh consumer | **PASS**, legal/metadata inspection, strict Kerkit declaration check, build, and 23 runtime entrypoint checks. |
| M2 corpus | **PASS**, high-confidence recall 100%; heuristic recall 0.833 and false-positive rate 0.000 on synthetic `es-ar-v1`. The deliberate OCR substitution miss remains reported, not hidden or promoted to a false guarantee. |
| GBrain reconciliation | **BLOCKED EXTERNALLY** on both required probes: the local PGLite configuration reported `broken-config`. The sync skill stopped as required, so no conflicting project decision was available. |
| Real provider call | **NOT RUN**; no provider credential was required for the recording-provider boundary proof. |

The remaining privacy limitation is explicit: structural direct-identifier redaction is the
enforced invariant, while arbitrary free-text recall is measured against a versioned corpus and
can be extended with consumer-supplied sync or async detectors. It is not guaranteed over all
language or encodings.

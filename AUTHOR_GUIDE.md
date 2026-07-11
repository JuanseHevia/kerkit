# kerkit — Author's Guide

> A full rundown of the repository for its author: what ships, how it works, where the
> bodies are buried, and what to check before you call it 1.0-ready.
> Written 2026-07-02, refreshed 2026-07-11 against `main` @ `eb04972` — M1, the
> `RedactionSession` provider sink, is now shipped. `npm run test` is green: 161 tests
> across the five workspace packages, plus 11 in the two example apps (172 total, 18 suites).

---

## Table of contents

1. [What kerkit is, in three sentences](#1-what-kerkit-is-in-three-sentences)
2. [Repo at a glance](#2-repo-at-a-glance)
3. [Architecture: how the five packages fit together](#3-architecture-how-the-five-packages-fit-together)
4. [Package deep dive: @kerkit/core](#4-package-deep-dive-kerkitcore)
5. [Package deep dive: @kerkit/pack-argentina](#5-package-deep-dive-kerkitpack-argentina)
6. [Package deep dive: @kerkit/ai](#6-package-deep-dive-kerkitai)
7. [Package deep dive: @kerkit/server](#7-package-deep-dive-kerkitserver)
8. [Package deep dive: @kerkit/ui](#8-package-deep-dive-kerkitui)
9. [The privacy model, end to end](#9-the-privacy-model-end-to-end)
10. [The compliance framework](#10-the-compliance-framework)
11. [Examples and demos](#11-examples-and-demos)
12. [CI, release machinery, contributor surface](#12-ci-release-machinery-contributor-surface)
13. [Known gaps, bugs, and the approved roadmap](#13-known-gaps-bugs-and-the-approved-roadmap)
14. [Author's self-check](#14-authors-self-check)
15. [Docs map](#15-docs-map)

---

## 1. What kerkit is, in three sentences

kerkit is an open-source TypeScript SDK of building blocks for **caretaker apps** — the
logistics layer a family caretaker runs while accompanying a chronic/oncology patient
through Argentina's obra social system: appointments, insurance authorizations (trámites),
prescriptions-as-documents, notes, tasks, and inbound insurer email signals. Its
differentiator is **privacy enforced in code**: every entity field carries a data
classification, direct identifiers are tokenized before any LLM call, and consent, export,
delete, and audit are shipped primitives rather than roadmap items. It was extracted from a
real treatment case, is explicitly **not a medical device**, and models caretaker-authored
logistics data — never clinical records.

## 2. Repo at a glance

```
kerkit/
├── packages/
│   ├── core/            # entities, Zod schemas, domain logic, privacy + compliance primitives
│   ├── pack-argentina/  # es-AR locale pack: strings, insurers, signal patterns, DNI/CUIL regexes
│   ├── ai/              # ContextAssembler, chat loop, MCP tools, OpenAI adapter
│   ├── ui/              # "Calm Confidence" design tokens (components not shipped yet)
│   └── server/          # Drizzle schema factory, repositories, privacy routes, cron skeletons
├── examples/
│   ├── minimal-caretaker/  # ~100-line Express demo, zero keys, zero DB
│   └── gallery/            # Docker showcase: Privacy X-Ray, Assistant, Dashboard scenes
├── scripts/demo.mjs        # the `npx github:JuanseHevia/kerkit` privacy X-ray (+ esbuild bundle)
├── docs/                   # anonymization plan, domain fidelity review, compliance docs
└── .github/                # CI (gitleaks + build/test + pack audit), issue/PR templates
```

**Facts worth having in your head:**

- All five packages are at **0.1.0**, versioned in lockstep via Changesets, **not yet published to npm**. The README says so truthfully.
- **18 commits**, June 12 → July 7, 2026. The five package-landing milestone commits shipped in one day (June 12); everything since is domain fidelity, privacy planning, compliance, demos, contributor onboarding, and — most recently — the M1 privacy-sink implementation (`eb04972`, July 7) this refresh documents.
- Tooling: npm workspaces + Turborepo + TypeScript 5 (strict, ESM, NodeNext) + Vitest + Zod. `@kerkit/core` has **one runtime dependency: zod**.
- Node ≥ 22 required. `npm run build && npm run test` → 18 suites, 172 tests, all green as of this writing (161 across the five packages, 11 across the two example apps).
- The **canonical synthetic persona** is load-bearing across the whole repo: Marta Pérez (patient, DNI 12.345.678), Carlos Pérez (caretaker), Dra. Laura Gómez, "Obra Social Demo Salud". Every fixture, test, doc example, and demo uses it; the gitleaks config allowlists exactly these values and flags any other Argentine-identifier-shaped string.

## 3. Architecture: how the five packages fit together

Dependency graph (arrows = "depends on"):

```
pack-argentina ─┐
                ├──▶ core ◀── ui (types only)
ai ─────────────┤
server ─────────┘

examples ──▶ all five
```

- **core** is the foundation and depends on nothing but Zod. It defines entities, schemas,
  domain logic, the privacy primitives (`Classification`, `redactEntityForLlm`, `sweepText`,
  consent, audit, `DELETION_ORDER`), the compliance harness, the repository *interfaces*,
  the `LocalePack` interface, and the fixtures.
- **pack-argentina** is the reference `LocalePack` implementation: 65 es-AR copy keys
  (voseo), 9 insurers, 12 email signal-classification rules, 5 identifier regexes, statutory
  rules (30-day receta validity, 48 h auth deadline), and prompt tone/examples. Other
  locales are meant to fork it.
- **ai** consumes core's classifications and redaction primitives and a `LocalePack`. It
  owns the LLM boundary: `ContextAssembler`, `runChatLoop`, the 9 MCP tools, prompt
  builders, and the OpenAI Responses adapter. Provider types never leak into kerkit's
  public surface — `ProviderAdapter.generate()` is the only seam.
- **server** implements core's repository interfaces over Drizzle/Postgres (17 tables via
  `createKerkitSchema`), ships the Ley 25.326 data-rights Express router, and three cron
  job templates. It is pack-agnostic; the consumer wires the pack in.
- **ui** is design tokens only for now; it imports a single type
  (`AuthorizationStatus`) from core.

**The invariant that ties it together:** data flows repos → sources → `ContextAssembler`
(structural redaction + sweep) → prompt → provider, and repos → tool handler →
`redactedRowsResult` (same discipline) → provider. As of M1 (`eb04972`) a shared
`RedactionSession` also sweeps **every application-originated string at the provider
boundary** inside `runChatLoop` — instructions, message history, tool output, and
tool-error strings — so the previously porous ingresses (external-tool output, raw user
messages, exceptions, `write_note` echo) close at one chokepoint whenever the session is
threaded. `createRedactedChat` wires that session for you. (Section 13 covers the residual
limitations — chiefly that the guarantee is opt-in via the session, and free-text sweep
recall is measured, not proven.)

## 4. Package deep dive: @kerkit/core

**Everything below lives in [packages/core/src](packages/core/src).**

### entities/ — 12 generic domain types

Every entity is generic over `TExt` (`Patient<TExt = Record<never, never>>`) so consumers
add fields without forking — see [EXTENDING.md](EXTENDING.md) for the four coordinated
hooks (type slot, Zod `.extend()`, Drizzle `extend` map, `extendClassification`).

| Entity | What it models | Notable |
|---|---|---|
| `Patient` | Identity for paperwork: name, DNI, credential, insurer, diagnosis | diagnosis/treatmentPhase optional, classified sensitive |
| `Appointment` | Turnos typed by care-event kind | `type` is an open union over `CareEventKindId` |
| `Prescription` | A *document with an expiry date* — never dosing logic | status: active/expiring/expired/renewed |
| `Authorization` | The trámite lifecycle | immutable timeline trail; see state machine below |
| `Note` | Freeform scratchpad, text or voice | content is assumed to contain PII → always swept |
| `Checkpoint` | Doctor-visit milestone ("where are we?") | bundles prescriptions/notes/summary |
| `Task` / `Checklist` | Daily chores with dependencies | `dependsOn: string[]` gives "lab before consult" |
| `Institution` / `Person` | Clinics, insurers, care-team members | institutions carry escalation SOPs |
| `Signal` | Classified inbound insurer email | 13 signal types, links to authorizations |
| `User` / `Conversation` | Caretaker + assistant history | auth provider is the consumer's choice |

### domain/ — pure business logic

- **[state-machine.ts](packages/core/src/domain/state-machine.ts):** the authorization graph
  — `needed → requested → pending → confirmed` (terminal), with `escalation` reachable from
  every active state and able to return to any. `planTransition()` is pure: it returns
  `{ updates, timelineEntry }` and throws `InvalidTransitionError` on illegal moves; the
  persistence layer (server) applies the plan.
- **[care-events.ts](packages/core/src/domain/care-events.ts):** `CARE_EVENT_KINDS` — chemo,
  imaging, consultation, procedure, lab, ambulatory_medication, other — each with
  `requiresAuthorization`, `requiresPrep`, `generatesResultDocument`,
  `typicalDurationMinutes`. This is the "no lookup tables, just TypeScript" README pitch.
- **[dates.ts](packages/core/src/domain/dates.ts):** `calculateAuthDeadline` (48 h before
  the appointment by default), `isEscalationNeeded`, `calculateExpiryDate`,
  `getPrescriptionStatus` (active → expiring → expired against an alert window).
- **[treatment.ts](packages/core/src/domain/treatment.ts):** descriptive `TreatmentPlan` +
  `cycleProgress` / `nextExpectedSession` / `totalSessions`. Estimative, never prescriptive.
- **[tasks.ts](packages/core/src/domain/tasks.ts):** `checklistProgress`,
  `blockingDependencies`, `canComplete` (cancelled counts as settled; a missing dep blocks).

### privacy/ — the crown jewel (detail in §9)

`classification.ts` (the `Classification<T>` mapped type — an unclassified field is a
**compile error**), `classifications.ts` (pre-built maps for every entity),
`redaction.ts` (`redactEntityForLlm` + `sweepText` + the exported `tokenBaseName` seam),
[`session.ts`](packages/core/src/privacy/session.ts) (the M1 `RedactionSession` — the
request-scoped, collision-safe token allocator + shared known-value map the provider sink
is built on), `consent.ts` (`ConsentRecord`, `isConsentActive`, `DELETION_ORDER`,
`ExportBundle`), `audit.ts` (7 `AuditAction`s).

### compliance/ — the Argentine control catalog (detail in §10)

23 controls in [controls.ts](packages/core/src/compliance/controls.ts), a probe-based
harness in [harness.ts](packages/core/src/compliance/harness.ts), and green/red reference
probes in [fixture-probe.ts](packages/core/src/compliance/fixture-probe.ts).

### schemas/, i18n/, fixtures/, repositories.ts

- **schemas/**: per-entity `createXSchema` / `updateXSchema` Zod pairs, un-frozen so
  consumers `.extend()`. Pragmatic limits (note content 10 k chars, 20 tags, 50 deps).
- **i18n/**: core ships **zero display strings** — 65 `COPY_KEYS` and the `LocalePack`
  interface; packs supply everything.
- **fixtures/**: the canonical persona with deterministic dates (T0 = 2026-01-05).
  `fixtureNote` deliberately embeds "Marta Pérez, DNI 12.345.678" in free text so sweep
  tests exercise the real algorithm.
- **repositories.ts**: interface-only data-access contracts (all methods take `userId`);
  plus the optional `ExternalSources` bridge (searchEmail, listCalendarEvents,
  listDocuments) that ai's external tools degrade gracefully without.

**Tests:** 7 files, 93 cases — state-machine matrix, date boundaries, task blocking,
classification completeness (every fixture field classified), the "marketing-claim"
redaction test (no direct identifier survives), green/red compliance-probe paths, and the
`RedactionSession` suite (collision-safe per-value tokens, value dedup, longest-first
fail-closed sweep, foreign-token escaping).

## 5. Package deep dive: @kerkit/pack-argentina

**Lives in [packages/pack-argentina/src](packages/pack-argentina/src).** The template every
other locale should fork.

- **[index.ts](packages/pack-argentina/src/index.ts):** the `argentina: LocalePack` object —
  locale `es-AR`, rules (`prescriptionValidityDays: 30`, `prescriptionAlertWindowDays: 5`,
  `authorizationDeadlineHours: 48`), and prompts (rioplatense voseo tone + 3 examples,
  including a medical-advice-boundary refusal example).
- **[identifiers.ts](packages/pack-argentina/src/identifiers.ts):** 5 regexes — dotted DNI,
  labeled DNI (dotted or not), CUIL/CUIT with valid prefixes, labeled CUIL/CUIT, and
  labeled credential/afiliado numbers. These feed `sweepText`. Note what's *not* here:
  unlabeled undotted DNI, phones, emails, addresses (that's A5 in the approved plan, §13).
- **[signal-patterns.ts](packages/pack-argentina/src/signal-patterns.ts):** 12
  sender+subject regex rules mapping insurer email to signal types
  (`auth_approved`, `med_ready_for_pickup`, `med_shortage`, `prescription_detected`, …),
  each with a voseo suggested-action template and a priority for tie-breaking. Vocabulary
  ("Nueva orden", "preparando", "listo para entregar", `comunicaciones@` senders) comes
  from the real corpus; patterns are robust to `Fwd:` prefixes because in the real workflow
  **every insurer email arrives as a forward from the patient**.
- **[insurers.ts](packages/pack-argentina/src/insurers.ts):** 9 insurers; only the
  synthetic `demo-salud` carries SLA data (medication 5 d, procedure/imaging 7 d). The 8
  real ones (OSDE, Swiss Medical, Galeno, PAMI, IOMA…) are names only — insurer data rows
  are an explicitly welcomed no-discussion-needed contribution lane.
- **[strings.ts](packages/pack-argentina/src/strings.ts):** the full 65-key copy map,
  including the **non-removable prompt blocks**: never ask for identifiers, don't echo
  sensitive data, transparency, and not-medical-advice.
- **[docs/ley-25326.md](packages/pack-argentina/docs/ley-25326.md):** the compliance
  checklist that the core compliance framework later formalized.

**Tests** ([pack.test.ts](packages/pack-argentina/src/pack.test.ts)): LocalePack
conformance (every key present, voseo not tuteo), pattern compilation, a 7-subject
**anonymized real-world corpus** covering the medication chain end-to-end, Fwd: handling,
a no-real-institution-names check, and identifier sweep behavior.

## 6. Package deep dive: @kerkit/ai

**Lives in [packages/ai/src](packages/ai/src)** (~1,600 lines). Four entry points:
`@kerkit/ai` (main — including `createRedactedChat`, the M1 safe default),
`@kerkit/ai/mcp`, `@kerkit/ai/openai`, `@kerkit/ai/demo` (fixture repos — deliberately
excluded from the main index so test data can't leak into production imports by accident).

### The context pipeline

- **[context/source.ts](packages/ai/src/context/source.ts):** the `ContextSource<T>`
  contract — key, heading, priority, maxItems, `fetch(userId)`, a **required**
  `classification`, optional `allowSensitiveFields`, and `formatItem(redacted)`. The shape
  makes bypassing redaction structurally impossible: the assembler redacts between fetch
  and format, and a source can't opt out.
- **[context/sources.ts](packages/ai/src/context/sources.ts):** six production-proven
  defaults in priority order — appointments (10), prescriptions (20, opts in
  `medicationName`), authorizations (30), notes (40, pinned first), checkpoints (50),
  signals (60).
- **[context/assembler.ts](packages/ai/src/context/assembler.ts):** `assemble(userId,
  { knownTokens? })` fetches all sources in parallel, structurally redacts each item,
  formats, joins into headed blocks, then runs `sweepText` over the whole thing with the
  pack's identifier patterns **plus the accumulated token map** — so a patient name hiding
  in note text becomes the same `«NAME»` token as the structured field. Returns
  `{ contextText, redactionMap, explain() }`; `explain()` powers the transparency
  report (fetched/included/dropped/tokenized per section, sweep match count).

### The loop and prompts

- **[loop/chat-loop.ts](packages/ai/src/loop/chat-loop.ts):** `runChatLoop` — up to
  `maxRounds` (default 5) of `provider.generate()` → execute tool calls → feed results
  back. Tool errors are caught and returned to the model as `{ error }`, never thrown.
  Provider `state` is threaded through opaquely. Fallback copy
  (`assistant.fallback.empty` / `toolRoundsExhausted`) comes from the pack. **M1 added the
  provider-sink pass:** when a `RedactionSession` is supplied, every application-originated
  string — instructions, message history, tool output, and tool-error strings — is swept
  through the session immediately before `generate()`
  ([chat-loop.ts#L84](packages/ai/src/loop/chat-loop.ts#L84) and
  [#L131](packages/ai/src/loop/chat-loop.ts#L131)), and `result.redaction` exposes what the
  sink did. Omit the session and a one-time `[KRK_NO_SESSION]` warning fires if a patient
  context is present. The model-emitted `message` it returns is **not** sink-swept — keep
  your own output leak-check.
- **[factory.ts](packages/ai/src/factory.ts):** `createRedactedChat` — the M1 safe default.
  It constructs **one** `RedactionSession` and threads it through the patient block, context
  assembly, tool execution, and the sink, so a caller wires one object instead of four call
  sites. `respond({ message, history })` runs a turn; `.session.tokenToValue()` rehydrates
  the UI and `.session.explain()` debugs. Hand-threading `session` into
  `buildPatientContextBlock` / `assemble` / `runChatLoop` yourself is the lower-level path,
  kept for advanced use.
- **[prompts/builder.ts](packages/ai/src/prompts/builder.ts):** `buildSystemPrompt` always
  includes the pack's privacy and boundary blocks — `extraInstructions` can only *append*,
  never replace; there is no override parameter by design. `buildPatientContextBlock`
  pre-redacts the patient (name → token, diagnosis/treatmentPhase opt-in only) and returns
  the token map so the app can pass it to `assemble()` as `knownTokens`.
- **[messages.ts](packages/ai/src/messages.ts):** kerkit-owned `ChatMessage` / `ToolSpec` /
  `ProviderTurn` / `ProviderAdapter` shapes — the seam that keeps provider SDKs out.
- **[providers/openai-responses.ts](packages/ai/src/providers/openai-responses.ts):** the
  only shipped adapter (OpenAI Responses API, function calling). It takes a
  `ResponsesClientLike`, so the gallery drives it with a bare `fetch` client and no
  `openai` npm dependency. Other providers are contribution-sized.

### The MCP toolkit

- **[mcp/tools.ts](packages/ai/src/mcp/tools.ts):** 9 tools — `read_appointments`,
  `read_prescriptions` (opts in `medicationName`), `read_authorizations`, `read_notes`,
  `read_checkpoints` (opts in `treatmentPhase`), `write_note`, and three external tools
  (`read_email` / `read_calendar` / `read_documents`) that degrade gracefully when
  `ExternalSources` isn't wired.
- **[mcp/redact-rows.ts](packages/ai/src/mcp/redact-rows.ts):** `redactedRowsResult` —
  every read tool funnels rows through structural redaction + sweep before returning. When
  the `ToolContext` carries the shared `RedactionSession` (as `createRedactedChat` wires
  it), rows redact through the session's allocator and known-value map, so a patient name
  sitting in a note's free text becomes the **same** token as the structured field — this
  is what closed the old tool-path name leak. The legacy no-session path still exists
  (structural redaction + local-token sweep only) and is exactly what the Layer-0 canary
  test proves leaks the name. See §13.
- **[mcp/executor.ts](packages/ai/src/mcp/executor.ts):** `toToolSpecs` (via the small
  purpose-built Zod→JSON-Schema converter in
  [json-schema.ts](packages/ai/src/mcp/json-schema.ts)) and `createToolExecutor`
  (Zod-validates args, runs the handler, unwraps text).
- **[mcp/server.ts](packages/ai/src/mcp/server.ts):** `registerKerkitTools` for a real MCP
  server, with two user modes — `injected` (a `_userId` param the system supplies; missing
  = hard error, no fallback user) and `static` (personal single-user deployments).

**Tests:** 5 files, 26 cases — assembler leak checks (DNI never survives, even in free
text), prompt non-removability, chat-loop rounds/errors/fallbacks, tool-level checks
(sweeps, opt-ins respected, Zod rejection, external degradation), and the **Layer-0
sink-canary** ([sink-canary.test.ts](packages/ai/src/sink-canary.test.ts)): it asserts the
`createRedactedChat` safe path scrubs both the DNI *and* the non-regex name from every
provider input, that the raw no-session path **leaks** the name (proving the guarantee is
opt-in), and that the note-text name maps to the same token as the patient field.

## 7. Package deep dive: @kerkit/server

**Lives in [packages/server/src](packages/server/src).** Express + Drizzle; auth is
deliberately not kerkit's problem — every factory takes `getUserId(req)`.

- **[schema/factory.ts](packages/server/src/schema/factory.ts):** `createKerkitSchema`
  returns **17 pgTable definitions** (users → auditEvents), all user-owned tables cascading
  on delete, statuses stored as text (validated by Zod at the API edge so new kinds don't
  need migrations), and an `extend` map for consumer columns. Column names are
  deliberately generic (`national_id`, not `dni`).
- **[repositories/drizzle.ts](packages/server/src/repositories/drizzle.ts):**
  `createKerkitRepositories(db, tables)` implements every core repository interface,
  everything scoped by `userId`.
- **[repositories/transition.ts](packages/server/src/repositories/transition.ts):**
  `transitionAuthorization` — ownership check, pure `planTransition` from core, apply
  updates, insert the immutable timeline entry. The clean pure-logic/persistence split.
- **[privacy/router.ts](packages/server/src/privacy/router.ts) + [store.ts](packages/server/src/privacy/store.ts):**
  the Ley 25.326 data-rights surface — `GET /export` (full `ExportBundle` with the
  transparency notice, in Spanish), `DELETE /data` (walks `DELETION_ORDER`),
  `GET|POST|DELETE /consents` (scope + policyVersion, soft revocation). **Every operation
  writes an audit event.** The `PrivacyStore` interface has a Drizzle implementation and
  in-memory implementations in both examples.
- **[cron/jobs.ts](packages/server/src/cron/jobs.ts):** three run-once templates —
  **escalation** (overdue unconfirmed authorizations → `escalation` status + callback),
  **expiry** (recompute prescription statuses against the pack's alert window, fire
  `onExpiring` once), **reminder** (upcoming appointments within N hours). No scheduler
  shipped; the consumer picks cron/queue. All accept `now()` for testability.

**Tests:** router lifecycle with audit assertions (via Supertest + in-memory store), and
schema-factory checks including a "no Argentine column names" guard.

## 8. Package deep dive: @kerkit/ui

**Lives in [packages/ui/src/tokens](packages/ui/src/tokens).** Tokens only — the README's
"React Native components shipping in waves" have not started shipping. Honest, but worth
remembering when describing the package.

- **Colors:** warm-undertone palette (no clinical teal, no cold blues); semantic tokens
  where **green is exclusively for forward progress**; five authorization-status badge
  pairs keyed by core's `AuthorizationStatus`; a `darkSemantic` override set.
- **Typography:** Source Serif 4 display, DM Sans body, JetBrains Mono; 9-role scale with a
  **15 px body floor** and an 11 px absolute minimum; `resolveFontName(role, platform)`
  handles PostScript vs family names.
- **Spacing:** 4 px scale, radii, `MIN_TOUCH_TARGET = 44` (a hard floor), shadows as last
  resort (hairline borders preferred).
- **Animations:** 100–500 ms durations, three easings, nothing bounces.

**Tests actually enforce the design rules:** WCAG contrast (≥3:1 badges, ≥7:1 body text),
"no green outside semantic.action", the touch-target floor, and platform font resolution.

## 9. The privacy model, end to end

This is kerkit's reason to exist, so here is the full pipeline in one place.

### The four data classes

Every entity field is one of `direct-identifier` / `sensitive-health` / `logistics` /
`public`, declared in [classifications.ts](packages/core/src/privacy/classifications.ts).
`Classification<T>` is a mapped type, so **forgetting to classify a field fails the
build**; at runtime, an unclassified extension field defaults to `sensitive-health`
(fail-closed).

### Pass 1 — structural redaction

[`redactEntityForLlm(entity, classification, { allowSensitiveFields, allocateToken, pseudonymizeFields })`](packages/core/src/privacy/redaction.ts)
(usually reached through `RedactionSession.redactEntity`):

- `direct-identifier` → replaced with a placeholder token. Standalone, the token is derived
  from the field name (`nationalId` → `«NATIONAL_ID»`). Under a `RedactionSession` the
  `allocateToken` seam mints **collision-safe, per-value** tokens (`«PERSON_NAME_1»`,
  `«PERSON_NAME_2»`) with value→token dedup, so two different people never share one token.
  Original values go into a `tokens: Map<token, value>` for UI rehydration.
- `sensitive-health` → **omitted** unless the field is explicitly listed in
  `allowSensitiveFields` at the call site (an in-code, per-call opt-in — e.g. the
  prescriptions source opts in `medicationName`).
- `logistics` / `public` → pass through, **except** the opt-in `pseudonymizeContacts`
  policy (default off): when on, a `Person`/`Institution` `phone`/`email`/`address` is
  tokenized like a direct identifier via the `pseudonymizeFields` seam.

### Pass 2 — the free-text sweep

[`sweepText(text, patterns, knownValues)`](packages/core/src/privacy/redaction.ts) runs two
sub-passes: first replace any **known value** from the token map with its token (catches
"Marta Pérez" typed into a note), then run the pack's **identifier regexes** and replace
matches with `«REDACTADO»`.

### Where the passes are applied

1. **Context assembly** — `ContextAssembler.assemble()` structurally redacts every item
   from every source, then sweeps the joined text with patterns + the accumulated token map
   (from `buildPatientContextBlock`, either as `knownTokens` or, preferably, a shared
   `session`).
2. **Tool output** — every read tool returns through `redactedRowsResult`, which
   structurally redacts each row and sweeps the serialized JSON. With a shared session it
   uses the session's allocator + known-value map; without one it falls back to *that
   call's own* tokens (the legacy path that can't see the patient name).
3. **The provider sink (M1)** — `runChatLoop`, given the shared `RedactionSession`, sweeps
   **every application-originated string** — instructions, message history, tool output,
   and tool-error strings — immediately before each `provider.generate()`. This is the
   single chokepoint that catches the ingresses the first two passes miss (external-tool
   output, raw user messages, exceptions, `write_note` echo).

A single `RedactionSession` threaded through all three — which `createRedactedChat` does
for you — is what makes a name in a note's free text map to the **same** token as the
patient field. Its `tokenToValue()` map lets the app show real names in its own UI while
the model only ever sees tokens.

### Consent, deletion, audit

- Consent scopes: `store_logistics`, `llm_assistant`, `external_sources` — each
  `ConsentRecord` pins a `policyVersion` (the "informed" in informed consent).
- `DELETION_ORDER` is a total child-before-parent ordering (signals → … → patients →
  users) so erasure can't orphan rows; the server router and compliance controls both
  enforce it.
- Seven audit actions cover export/delete/consent/LLM-context events;
  a compliance control asserts audit context itself contains no PII.

### What's honestly claimed vs measured

The privacy plan ([docs/anonymization-testing-framework.md](docs/anonymization-testing-framework.md))
draws a line you should keep drawing in public messaging: the **PROVEN** claim is the
structural invariant (a classified `direct-identifier` field's value never appears in
provider-bound text); free-text sweep recall is **MEASURED, never 100%** on arbitrary
input. The README currently only makes the provable claim. Keep it that way.

## 10. The compliance framework

Shipped in `@kerkit/core/compliance` (commit `0551659`), documented in
[docs/compliance/](docs/compliance/).

- **The catalog** ([controls.ts](packages/core/src/compliance/controls.ts)): 23
  `ComplianceControl`s, each with a machine id (`AR-REDACT-SINK`,
  `AR-RETENTION-FLOOR`, …), category, `appliesTo` profiles, rationale, and cited
  `LegalBasis` (law + article + URL + confidence tag `verified|partial|sourced` — only
  verified/partial may gate CI). Automatable controls carry a `check(probe)`; operational
  ones (publish a policy, AAIP registration, digital signatures, 48 h clinical-copy SLA)
  are **attestations** — surfaced in the report, never silently passed, never gating.
- **Profiles**: `logistics` → `llm_assistant` → `external_sources` → `eprescription`.
  Profile gating exists because of the **retention-vs-erasure tension**: Ley 25.326
  demands erasure in 5 business days, Ley 26.529 demands a 10-year clinical-record floor,
  Ley 27.553 a 3-year e-prescription floor. They coexist because they govern different
  record kinds (`RETENTION_FLOOR_DAYS`: logistics 0, clinical 3650, eprescription 1095),
  and the legal-duty-to-preserve carve-out in Arts. 16–17 defeats erasure inside a floor.
  A logistics-only app is never failed for clinical obligations.
- **The harness** ([harness.ts](packages/core/src/compliance/harness.ts)):
  `runComplianceSuite(probe, { profile })` → `ComplianceReport` with
  `compliant`, per-control results, required attestations, and `format('markdown'|'text')`.
- **The probes** ([fixture-probe.ts](packages/core/src/compliance/fixture-probe.ts)):
  `createFixtureProbe()` runs green over the synthetic persona using the *real* redaction
  primitives; `createLeakyProbe()` is deliberately broken (leaks identifiers, skips
  consent, PII in audit, no-op deletion) and the tests assert it fails **exactly** the
  controls it targets — you test the tests.
- **Consumers** implement `ComplianceProbe` against their wired app and run the suite in
  their own CI. Planned but not built: `createServerProbe()` in `@kerkit/server` (slice 2
  of the framework doc) and a published `@kerkit/compliance-testing` package (slice 4).

## 11. Examples and demos

Three tiers of "show, don't tell", all over the synthetic persona, all key-free by default:

1. **The npx demo** ([scripts/demo.mjs](scripts/demo.mjs), bundled to
   `demo.bundle.mjs` via esbuild and exposed as the repo `bin`): prints the raw patient
   record and the redacted projection, then — since M1 — runs a real tool-calling turn
   through `createRedactedChat` and greps every model input for **both** the raw DNI *and*
   the raw name (which hides in a note's free text). Exits 1 on failure, `✅ PASS`
   otherwise. The old demo only checked the regex-matchable DNI, so it green-lit the name
   bug. Remember: **the bundle is a build artifact committed to the repo** —
   `npm run build:demo` must be re-run when ai/core/pack change, or
   `npx github:JuanseHevia/kerkit` serves stale code.
2. **examples/minimal-caretaker** — the copy-me starter: an ~80-line Express app wiring
   fixture repos + `createRedactedChat` (one shared session across the patient block,
   context assembly, tools, and the sink — its `/chat` route now redacts free-text names,
   which it didn't before M1), a scripted `MockProvider` (or OpenAI with a key), and the
   privacy router over an in-memory store. Endpoints: `/health`, `/context`, `/chat`,
   `/privacy/*`. The pitch: swapping MockProvider→OpenAIResponsesAdapter and
   fixtures→Drizzle repos is the whole path to production; the wiring shape doesn't change.
3. **examples/gallery** — the Docker showcase (React/Vite/Tailwind + Express). Four
   scenes: Landing, **Privacy X-Ray** (per-field raw vs model view with disposition badges
   — tokenized/dropped/allowed/swept/passthrough — plus before/after free-text sweep),
   **Assistant** (live tool-call trace with a per-response leak-check pill that scans the
   response for the persona's raw identifiers), **Dashboard** (cycle progress ring, care
   events with auth/prep pills, dependency-aware checklist). Since M1 it threads one shared
   `RedactionSession` through the patient block, assembly, and the chat sink, and its old
   manual `sweepText` workaround is deleted (the SDK sink owns that now); the leak-check
   pill stays green. That pill is still a demo device — a hardcoded list of the persona's
   sensitive values scanned against the JSON response — not the real enforcement.

## 12. CI, release machinery, contributor surface

**CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) — three jobs:

1. **pii-scan** — gitleaks with [.gitleaks.toml](.gitleaks.toml): custom Argentine rules
   (DNI 7–8 digits dotted or not, CUIL/CUIT) with the synthetic persona allowlisted.
   A finding blocks merge. This is the enforcement behind the "canonical persona only" rule.
2. **build-test** — `npm ci` → build → lint → test on Node 22.
3. **pack-audit** — packs each publishable tarball and greps the *actual shipped
   contents* for non-synthetic DNI patterns. Nice defense-in-depth that most repos don't have.

**Release**: Changesets in lockstep-linked mode across all `@kerkit/*`; `npm run release`
= build + `changeset publish`. Pre-1.0, a minor may be breaking (documented policy).
Nothing has been published yet.

**Contributor surface** ([CONTRIBUTING.md](CONTRIBUTING.md), issue/PR templates): three
explicit lanes — direct-PR (bug fixes with tests, insurer data rows, a11y, docs),
issue-first (locale packs, prompt changes *with eval deltas*, entity changes, providers),
and out-of-scope (generic core refactor, medical advice, ORM swaps). The **eval-scenario
issue template** lets caretakers contribute domain knowledge with no code — arguably the
most distinctive part of the contributor story.

**Security** ([SECURITY.md](SECURITY.md)): email disclosure, 90-day coordinated window,
and an important scoping line: *unredacted identifier reaching an LLM through documented
APIs is a security bug in kerkit*, while auth is the consumer's.

## 13. Known gaps, bugs, and the approved roadmap

You approved a hardening plan (PR #1,
[docs/anonymization-testing-framework.md](docs/anonymization-testing-framework.md)).
**M1 — the `RedactionSession` provider sink — shipped in `eb04972`** and closed the token
collision, the tool-path name leak, and the un-swept ingresses (items 1–3 below). This
section is the honest delta between what the code does today and what the plan still
commits to; fixed findings are marked ✅ and kept as historical context (with a *Was:* /
*Now:* split) so the before/after stays legible.

### Findings and their current status

1. **`«NAME»` token collision — ✅ FIXED in M1 (plan item A3).**
   *Was:* `placeholderFor()` derived tokens from *field names*, so two different people both
   became `«NAME»` and the redaction map kept only the last value. *Now:* `RedactionSession`
   allocates per-value, collision-safe tokens (`«PERSON_NAME_1»`, `«PERSON_NAME_2»`) with
   value→token dedup, and `escapeForeignTokens` neutralizes token-shaped substrings in user
   input so someone typing `«NAME»` can't poison the map
   ([session.ts#L108](packages/core/src/privacy/session.ts#L108)).

2. **The MCP tool-path token leak (the "SDK gap") — ✅ FIXED in M1.**
   *Was:* [`redactedRowsResult`](packages/ai/src/mcp/redact-rows.ts) swept tool output with
   the pack's regexes plus only *its own rows'* structural tokens; the session's known
   identifiers — most importantly the **patient's name** from `buildPatientContextBlock`
   — were never threaded in, so a name sitting inside a note's free text returned by
   `read_notes` reached the model raw. *Now:* when the `ToolContext` carries the shared
   `RedactionSession`, rows redact through the session's allocator and known-value map
   ([redact-rows.ts#L25](packages/ai/src/mcp/redact-rows.ts#L25)), and the tokens are the
   session's, so the app can rehydrate them. **Caveat:** this holds only on the session
   path — the legacy no-session tool path still leaks the name, which the Layer-0 canary
   test asserts on purpose (proving the guarantee is opt-in).

3. **Un-swept provider ingresses — ✅ FIXED in M1 (at the sink).**
   *Was:* external tool output (email/calendar/docs) returned raw; inbound **user messages**
   were sent raw; **tool exception messages** went to the model unswept; `write_note` echoed
   unswept `note.content`; `instructions` accepted unrestricted strings. *Now:* `runChatLoop`
   with a session sweeps instructions, message history, tool output, and tool-error strings
   at the provider boundary ([chat-loop.ts#L84](packages/ai/src/loop/chat-loop.ts#L84) and
   [#L131](packages/ai/src/loop/chat-loop.ts#L131)) — one chokepoint covering all five.
   *Residual:* the guarantee is **opt-in** (you must thread the session — use
   `createRedactedChat` or pass `{ session }`); the model-emitted answer is not sink-swept;
   and branded `SafeProviderInput` types (plan A2) were deliberately deferred to keep the
   signature non-breaking, so "forgot to redact" is not yet a compile error.

4. **PII classified `logistics` — ◑ partially addressed (plan item A7).**
   `Signal.sender` is now reclassified to `direct-identifier`
   ([classifications.ts#L148](packages/core/src/privacy/classifications.ts#L148)), and the
   opt-in `pseudonymizeContacts` policy (default off) tokenizes `Person`/`Institution`
   contact fields when a deployment wants it. *Residual (by design):* `prescriberName`,
   `personName`, and institution `email`/`phone`/`address` still flow to the model by
   default — a clinic's phone is the payload of a logistics assistant, not patient PHI — so
   the mosaic-re-identification risk is documented, not eliminated.

5. **Narrow sweep patterns — ⚠️ still open (plan items A4/A5).**
   Five regexes; no unlabeled undotted DNI, no AR phones, emails, or addresses; no
   normalization pre-pass (zero-width chars, spaced digits still defeat the sweep). This is
   the residual limitation behind the honest "free-text recall is measured, never 100%"
   posture — unchanged by M1.

### Structural/roadmap gaps (not bugs)

- **@kerkit/ui ships no components** — tokens only, despite the README's "shipping in
  waves" phrasing. Fine pre-1.0; just keep the phrasing honest.
- **Domain fidelity gaps** ([docs/domain-fidelity-review.md](docs/domain-fidelity-review.md)):
  no *Receta vs Orden* distinction, no *Trámite N°* external reference on
  `Authorization`, no provision/delivery entity (only signal types), no *Reclamo*
  primitive, per-insurer SLAs exist only for the demo insurer, no `Study`/`Result`,
  no structured visit notes / `MedicationRegimen` / care-phase machine. The review names
  these as the recommended next slice.
- **Compliance framework slices 2–4 unbuilt**: `createServerProbe()` in server, the
  `compliance` npm script + CI job, the Presidio/GLiNER de-identification oracle
  (trigger-gated per D2), and the published consumer package.
- **Minor code observations**: `Conversation` entity is defined but unused by domain
  logic or probes; the absent-`ExternalSources` state has no test coverage;
  gallery's leak check is a demo-only hardcoded list.

### Suggested order of attack

M1 shipped (`RedactionSession` + provider-boundary enforcement + the token-collision fix +
A7 `Signal.sender` reclassification + the `pseudonymizeContacts` policy + Layer-0 canary
tests), fixing items 1–3 and part of 4 above. What remains, roughly in order:

1. **A2 — branded `SafeProviderInput` types**, so "forgot to redact" is a compile error, not
   a convention (deferred from M1 to keep the signature non-breaking).
2. **A4/A5 — normalization pre-pass + widened, tiered patterns** (item 5), the prerequisite
   for a measured per-type recall posture.
3. **The es-AR corpus and de-identification oracle** (plan M2).

Until A2 lands, the sink guarantee is opt-in: the safe path is `createRedactedChat`, and the
README privacy claim stays honestly scoped to the proven structural invariant.

## 14. Author's self-check

You should feel comfortable if you can answer yes to each of these:

**Can I explain…**
- [ ] …why `confirmed` is terminal but `escalation` can return to any state, and where the
  timeline entry for a transition is produced (core) vs persisted (server)?
- [ ] …the difference between the PROVEN structural invariant and the MEASURED sweep
  recall, and which one the README claims?
- [ ] …why `sensitive-health` fields are *omitted* rather than tokenized, and where the
  opt-in lives (in code, per call site — sources, tools, patient block)?
- [ ] …why erasure can be legally blocked (retention floors as the Arts. 16–17
  legal-preservation exception) and how profiles gate that?
- [ ] …which ingress paths to `provider.generate()` the M1 sink sweeps (instructions,
  message history, tool output, tool-error strings — via a threaded `RedactionSession`),
  and why the guarantee is opt-in until branded types (A2) land (§13.3)?

**Do I remember the operational traps…**
- [ ] `scripts/demo.bundle.mjs` is a committed build artifact — rebuild it
  (`npm run build:demo`) after touching core/ai/pack, or the npx demo goes stale.
- [ ] All packages version in lockstep; every PR needs a changeset.
- [ ] Every example/fixture/test must use Marta Pérez — gitleaks and the pack-audit job
  will block anything else that looks like an Argentine identifier.
- [ ] Prompt changes require an eval delta per CONTRIBUTING.md — including your own.

**Before the first npm publish…**
- [x] M1 (the sink) implemented (`eb04972`) — the README privacy claim now matches the code
  on the session path.
- [x] `«NAME»` collision fixed — per-value collision-safe tokens ship in `RedactionSession`.
- [ ] Decide whether to land A2 (branded `SafeProviderInput`) before publish or ship with
  the opt-in sink and document it — until then the guarantee depends on callers threading a
  session (`createRedactedChat`).
- [ ] Decide whether `@kerkit/ui` publishes as tokens-only or waits for the first
  component wave.
- [ ] Re-run the pack audit against the real tarballs (`npm pack`) and skim the file lists.

## 15. Docs map

| Doc | What it actually contains |
|---|---|
| [README.md](README.md) | Pitch, quickstart (npx + clone), "is this for me" matrix, package table, privacy model summary |
| [EXTENDING.md](EXTENDING.md) | The four-hook extension pattern (TExt, Zod extend, Drizzle extend, classification) — deliberately no runtime plugin system |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution lanes, PII rules, eval-scenario pathway |
| [SECURITY.md](SECURITY.md) | Disclosure process; PII-to-LLM leaks are in scope, auth is not |
| [NOTICE](NOTICE) | Not-a-medical-device scope disclaimer |
| [docs/anonymization-testing-framework.md](docs/anonymization-testing-framework.md) | The approved (D2) privacy hardening plan: RedactionSession sink, branded types, canary tests, es-AR corpus. **M1 shipped (`eb04972`); A2 branded types + M2 (A4–A7, corpus, oracle) still pending** |
| [docs/domain-fidelity-review.md](docs/domain-fidelity-review.md) | Real-workflow ground truth (7 loops), fidelity scorecard, next-primitive recommendations |
| [docs/compliance/argentina-standards.md](docs/compliance/argentina-standards.md) | Cited legal research: Ley 25.326 / 26.529 / 27.553 obligations as falsifiable requirements, confidence-tagged |
| [docs/compliance/evaluation-framework.md](docs/compliance/evaluation-framework.md) | The control-catalog + probe architecture; slices 1 (shipped) through 4 (deferred) |
| [packages/pack-argentina/docs/ley-25326.md](packages/pack-argentina/docs/ley-25326.md) | The original pack-level compliance checklist the framework formalized |

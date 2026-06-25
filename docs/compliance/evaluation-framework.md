# kerkit compliance evaluation framework

> A reproducible, test-driven way to prove an Argentine caretaker app built on kerkit
> upholds its data-protection obligations. Pairs with the cited
> [argentina-standards.md](./argentina-standards.md) and complements the redaction-focused
> [anonymization-testing-framework.md](../anonymization-testing-framework.md).

## Context — why this exists

kerkit already ships the *primitives* for compliance (classification, redaction, consent,
audit, export/delete) and a `pack-argentina/docs/ley-25326.md` checklist. What's missing is
the **bridge from "the law says X" to "a test proves the app does X."** Today a developer
integrating kerkit has no automated way to answer *"is my wiring of consent + redaction +
deletion actually compliant?"* — the obligations live in prose, the enforcement lives in
hand-written per-package tests, and the two aren't connected.

This framework closes that gap with a **machine-readable control catalog** (every obligation
from the research, with its citation and confidence) plus a **conformance harness** the SDK
*and its consumers* can run. The legal research is the input; the output is automation that
turns each falsifiable obligation into a pass/fail check.

## Two audiences, one catalog

| Audience | What they run | What it proves |
|---|---|---|
| **kerkit maintainers** (CI) | Invariant tests over the fixture probe | The SDK's primitives *can't* leak — redaction, deletion order, audit completeness hold for every entity. A new entity that forgets a classification fails the build. |
| **SDK consumers** (their CI) | `runComplianceSuite(probe, { profile })` against *their* wired app | Their integration honors consent gating, redaction at the LLM sink, export/delete, audit, and the right retention floor for their app profile. |

One catalog, two harness entry points. Consumers implement a small `ComplianceProbe`
adapter into their app; kerkit ships a `createFixtureProbe()` so the suite is runnable green
(and a deliberately-broken probe to prove the checks *fail* correctly — testing the tests).

## Architecture

```
@kerkit/core/compliance
├── controls.ts        # the catalog: ComplianceControl[] with LegalBasis citations
├── harness.ts         # ComplianceProbe interface + runComplianceSuite() + report types
├── fixture-probe.ts   # createFixtureProbe() (green) + createLeakyProbe() (red), for self-test
├── compliance.test.ts # invariants + catalog well-formedness + green/red probe behavior
└── index.ts
```

- **Reuses, doesn't reinvent.** Checks call the existing primitives: `redactEntityForLlm` /
  `sweepText` (`privacy/redaction.ts`), `isConsentActive` + `DELETION_ORDER` +
  `ExportBundle` (`privacy/consent.ts`), `AuditAction` (`privacy/audit.ts`),
  `Classification` (`privacy/classification.ts`). The pattern set comes from
  `@kerkit/pack-argentina` `identifierPatterns`.
- **Profile-gated.** Each control declares `appliesTo: AppProfile[]`. The runner selects
  controls for the consumer's declared profile, so a `logistics`-only app is never failed
  for lacking the 10-year clinical-record floor, and an `eprescription` app can't skip it.
- **Confidence-tagged.** Each `LegalBasis` carries `verified | partial | sourced` so a
  report can separate "proven obligation" from "best-practice scaffolding."
- **Automatable vs. attestation.** Controls that a test can decide (`check` present) run
  automatically; operational/legal ones (publish a privacy policy, register with AAIP) are
  reported as **required attestations** — surfaced, never silently passed.

## The requirements → tests matrix

Each obligation from the research becomes one control. `check` = decidable by the harness;
`attest` = operator must confirm (reported, not auto-passed).

| Control id | Obligation (source) | Profile | Kind | How it's verified |
|---|---|---|---|---|
| `AR-CLASS-HEALTH-SENSITIVE` | Health data is *datos sensibles* (25.326 Art. 2) | all | check | Every health field resolves to `sensitive-health` in its `Classification`; none defaults to `logistics`/`public`. |
| `AR-CONSENT-SENSITIVE` | Free/express/informed, written, prominent consent (25.326 Art. 5) | llm_assistant, external_sources, eprescription | check | A `ConsentRecord` exists for the scope, `isConsentActive` is true, and it carries a non-empty `policyVersion`. |
| `AR-LLM-CONSENT-GATE` | No sensitive processing without lawful basis (25.326 Art. 5/7) | llm_assistant | check | Provider was invoked **only** when `llm_assistant` consent active (probe: `providerInvoked ⇒ hasActiveConsent`). |
| `AR-REDACT-SINK` | Security + confidentiality; no unauthorized *consulta* (25.326 Arts. 9–10) | llm_assistant | check | **No** direct-identifier value appears in any captured provider input (the generalized "marketing-claim" invariant via `sweepText`). |
| `AR-DEIDENT-EXPORT` | Statistical/scientific use only if non-identifiable (25.326 Art. 7) | all (if analytics) | check | Any analytics/training export passes the de-identification oracle (Presidio/GLiNER) with zero direct-identifier hits. |
| `AR-DSR-ACCESS` | Right of access (25.326 Art. 14) | all | check | `exportData()` returns a well-formed `ExportBundle` with a transparency `notice`. |
| `AR-DSR-ERASURE` | Right of erasure (25.326 Art. 16) | all | check | After `deleteData()`, `exportData()` is empty for every entity class **whose retention floor allows it** (see retention gate). |
| `AR-DELETE-ORDER` | Erasure must actually complete (25.326 Art. 16) | all | check | Deletion follows `DELETION_ORDER` (children before parents); no orphaned rows remain. |
| `AR-AUDIT-COMPLETE` | Detect deviations / traceability (25.326 Art. 9) | all | check | Each of export/delete/consent-grant/consent-revoke emits its `AuditAction`. |
| `AR-AUDIT-NO-PII` | Audit must not itself leak (25.326 Arts. 9–10) | all | check | No `AuditEvent.context` value contains a known direct-identifier. |
| `AR-RETENTION-FLOOR` | Class-specific retention (25.326 Art. 16 vs 26.529 Art. 18 vs 27.553) | all | check | `retentionFloorDays(kind)` = 0 for logistics, ≥ 3650 for clinical, ≥ 1095 for e-prescription; erasure blocked inside the floor. |
| `AR-CLINICAL-ACCESS-48H` | Authenticated copy ≤ 48 h (26.529 Art. 14) | (custodian) | attest | Operator confirms an authenticated-export path with a 48 h SLA. |
| `AR-CLINICAL-INTEGRITY` | Inalterability / non-rewritable / field-change control (Decreto Art. 13) | (custodian) | attest | Operator confirms tamper-evident storage. |
| `AR-DIGITAL-SIGNATURE` | Ley 25.506 signature on clinical entries/prescriptions (Decreto Art. 13; 27.553 Art. 4) | eprescription | attest | Operator confirms valid digital signatures. |
| `AR-CONFIDENTIALITY-ACCESS` | Access bound to authorized principals (26.529; 27.553 Art. 4) | external_sources, eprescription | check | Every PHI read path requires an authenticated principal (probe: no `getUserId ⇒ 401`). |
| `AR-EPRESCRIPTION-RECEIPT` | Trazabilidad + constancia (27.553 Art. 13) | eprescription | check | Each prescription/dispensing event yields a retrievable, immutable receipt. |
| `AR-PRIVACY-POLICY` | Versioned policy the consent references (25.326 Art. 6) | all | attest | Operator confirms a published, versioned policy matching `policyVersion`. |
| `AR-AAIP-REGISTRATION` | Database registration / operator duties (25.326) | all (hosted) | attest | Operator confirms AAIP-registration assessment. |

## Layered enforcement (how it slots into CI)

Builds on the already-approved privacy test plan's layer model:

- **Layer 0 — invariants (kerkit CI, blocking).** Property/example tests over the fixture
  probe: redaction never leaks a direct-identifier (reuse + generalize the existing
  `redaction.test.ts` "marketing-claim" test with `fast-check`), deletion order is total
  and FK-safe, classification completeness (a new entity without a classification is a
  *compile* error already; the test asserts no field is misclassified).
- **Layer 1 — conformance suite (consumer CI, blocking on `check` controls).**
  `runComplianceSuite(probe, { profile })` → a `ComplianceReport`. `check` controls gate;
  `attest` controls print a checklist. Reuses the `pack-argentina` corpus + identifier
  patterns for the redaction checks.
- **Layer 2 — de-identification oracle (nightly, reporting).** Run Presidio/GLiNER over
  synthetic exports to *measure* redaction recall against the es-AR corpus. Report per-type
  recall; hard-gate only the structural invariant (never the ML recall — avoids the
  self-tightening-CI tarpit, per the privacy plan's D2 decision).
- **Layer 3 — adversarial red-team (deferred, advisory).** Promptfoo prompt-injection runs
  that try to make the assistant exfiltrate identifiers. Advisory only.

New CI job (mirrors the existing `pack-audit` style in `.github/workflows/ci.yml`):

```yaml
  compliance:
    name: Compliance conformance suite
    runs-on: ubuntu-latest
    needs: build-test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci && npm run build
      - run: npm run compliance   # runs the suite over the fixture profiles, fails on any `check`
```

## Public API sketch

```ts
import { runComplianceSuite, AR_CONTROLS, type ComplianceProbe } from '@kerkit/core';

// Consumers implement this against their wired app (one method each
// over their PrivacyStore, chat loop recorder, consent table…).
const probe: ComplianceProbe = createMyAppProbe();

const report = await runComplianceSuite(probe, { profile: 'llm_assistant', jurisdiction: 'AR' });

report.compliant;            // boolean — all applicable `check` controls passed
report.results;              // per-control: pass | fail | skip | attest, with evidence + citation
report.attestationsRequired; // operator checklist (the `attest` controls)
report.format('markdown');   // a shareable compliance report with citations
```

## What ships when (phasing)

- **Slice 1 (this change) — the spine.** Control catalog + harness + fixture/leaky probes +
  invariant & well-formedness tests, all green. Proves the model end-to-end on synthetic
  data. *No behavior change to existing packages.*
- **Slice 2 — wire the real probe.** A `createServerProbe()` in `@kerkit/server` backed by
  the real `PrivacyStore` + a recording provider in `@kerkit/ai`, so the demo app runs the
  suite for real. Add the `compliance` npm script + CI job.
- **Slice 3 — measurement.** Presidio/GLiNER oracle as an offline batch CLI over synthetic
  exports; recall reporting. (Deferred trigger from the privacy plan.)
- **Slice 4 — publish.** Extract `@kerkit/compliance-testing` as a consumer-facing package
  (internal `@kerkit/core/compliance` subpath first, per the privacy plan's M3 deferral).

## Reproducibility guarantees

- **Synthetic-only.** Every check runs against the canonical synthetic persona
  (`fixtures/persona.ts`) — no real PII, ever; the existing `pack-audit` CI gate already
  enforces this on published tarballs.
- **Deterministic.** No network in Layers 0–1; the oracle (Layer 2) runs offline batch, not
  a live service.
- **Versioned law.** The catalog tags each control with its source + confidence; a future
  reform (Ley PDP 2024) is a new ruleset, not a rewrite.
- **Honest claims.** Only `verified`/`partial` obligations become blocking `check` controls;
  `sourced`/best-practice items are advisory. Nothing in §8 of the standards doc ("Not
  asserted") is encoded as a hard gate.

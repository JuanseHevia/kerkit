<!-- /autoplan plan file v2 — authored 2026-06-18, revised after CEO/Eng/DX dual-voice review (Claude subagents + Codex gpt-5.5). No prior plan file existed; restore point N/A. -->

# Anonymization hardening + privacy test framework

> **Implementation status (0.2.0):** M1 and M2 are implemented. A0/A1/A3/A7
> and the Layer-0 provider canaries landed first; the final hardening change makes
> the boundary structural (A2) and adds A4-A6 plus the Layer-1 es-AR corpus and
> property gates. M3/M4 remain deferred. Free-text recall is measured against the
> versioned corpus, never guaranteed for arbitrary language.

**One line:** Enforce redaction at a single provider-boundary chokepoint, prove the boundary with canary tests, and measure free-text recall against a versioned es-AR corpus — replacing the current per-path, fixture-tested approach.

> **v2 note:** Review converged on a stronger architecture than v1. The headline change: stop bolting redaction onto each tool/path; enforce it **once, at the `provider.generate()` sink**, via a request-scoped `RedactionSession` and a branded `SafeProviderInput` type. This subsumes the old A1/A2 and closes three ingress holes the v1 "two holes" framing missed.

---

## North star (corrected — the v1 framing was overstated)

**Not** "prove zero PII leakage" — a finite corpus + fuzzing + ML sampling cannot quantify over arbitrary language, encodings, or consumer extensions. Both review models flagged "prove" as a credibility trap.

**The honest north star:** *Every kerkit-owned LLM ingress passes through an enforced redaction policy, with measured recall against a versioned threat corpus and published exclusions.* Two distinct guarantees, never conflated:

- **PROVEN (structural invariant):** any field classified `direct-identifier` is tokenized; its value never appears in provider-bound text. Universal, via `fast-check`. This is the only claim the README may make.
- **MEASURED (never 100% on arbitrary input):** free-text recall of the sweep/detector against the corpus — reported as a floor with corpus version, seed, detector version, per-type recall, and false-positive rate. Explicitly *not* a proof.

---

## Premises (gate D1: user confirmed "full plan"; review re-raised 4 + the oracle — see User Challenges)

1. **The marketing claim is the spec, scoped honestly.** Make "redaction before LLM calls is enforced" true on every kerkit-owned ingress; pin the public claim to the PROVEN invariant only.
2. **TS-native gate; Python only as an offline oracle** (never in consumer CI). *Review: keep the principle; the oracle's existence is challenged — see UC2.*
3. **The ingress holes are in scope** — and there are more than two (below).
4. **Privacy testing as a shippable primitive.** *Review: challenged for a 0-user 0.1.0 — see UC1.*

---

## Threat model — full provider-ingress inventory (v1 undercounted)

Everything that reaches `provider.generate()` (`instructions`, `input`, `toolResults`, and tool error strings — [messages.ts](../packages/ai/src/messages.ts), [chat-loop.ts](../packages/ai/src/loop/chat-loop.ts)):

| # | Ingress | 0.2.0 defense | Residual risk |
|---|---|---|---|
| 1 | Structured entity fields → context | collision-safe, value-deduplicated session tokens | token-map handling remains application-side |
| 2 | Identifier in free text (note content) | normalized, typed detector sweep | recall outside `es-ar-v1` is not guaranteed |
| 3 | **External tools** (email/calendar/docs) | session sweep at the provider sink | detector coverage varies by locale/policy |
| 4 | **Inbound user messages** | session sweep at the provider sink | novel names require a known value or consumer detector |
| 5 | **Tool exceptions** | fail-closed session sweep | generic placeholder can reduce diagnostics |
| 6 | **`write_note` echo** | session sweep at the provider sink | same measured free-text limits as #2 |
| 7 | **`instructions` / system prompt** | branded provider input minted by the session | unsafe adapters are rejected at compile time |
| 8 | Misclassified `logistics` PII | contact fields reclassified; optional contact pseudonymization | operational names retain mosaic risk by policy |
| 9 | Mosaic re-identification | documented policy residual | not eliminated or quantified |

"Robust anonymization" = a single enforced sink that covers 1-7, a classification fix for 8, and a measured posture for 9.

---

## What already exists (do not rebuild)

`Classification<T>` compile-time completeness, `redactEntityForLlm`, `sweepText`, enforced at `ContextAssembler` + `redactedRowsResult`, with an `explain()` transparency report. Existing tests are correct but example-based. (Files: [classification.ts](../packages/core/src/privacy/classification.ts), [redaction.ts](../packages/core/src/privacy/redaction.ts), [assembler.ts](../packages/ai/src/context/assembler.ts).)

---

## Deliverable A — Anonymization hardening (centralized at the sink)

### A0. `RedactionSession` — the request-scoped chokepoint (COMPLETE)
A per-request object threaded through context assembly, chat ingress, and tool execution. Owns: collision-safe token allocation, the normalized known-value map, accumulated findings, and the active policy. **Fixes the v1 bug that A1/A2 had no access to the live token map.**

### A1. Enforce redaction at the provider boundary (COMPLETE)
A `RedactedProviderClient` (or a redaction step inside `runChatLoop` immediately before `generate()`) sweeps **all application-originated inputs**: `instructions`, user/assistant history, `toolResults`, and tool error strings — using the session. External-tool output (#3), inbound text (#4), exceptions (#5), `write_note` echo (#6), and instructions (#7) are all covered at one point. *Model-emitted tool-call arguments are treated as an authorization/validation concern, not retroactive PII protection.*

### A2. Branded `SafeProviderInput` / `RedactedText` types (COMPLETE)
`ToolResult` and provider inputs use branded safe text. Raw handler results and their constructors stay internal; only the executor/session can mint provider-bound text. "Forgot to redact" becomes a **compile error**, mirroring how `Classification<T>` already works: a raw handler result cannot be passed where a provider-safe `ToolResult` is required.

### A3. Collision-safe token scheme (COMPLETE)
`placeholderFor()` derives `«NAME»` from the field name, so two people both become `«NAME»` and the map keeps only the last value ([redaction.ts#L19](../packages/core/src/privacy/redaction.ts#L19), overwrite at [assembler.ts#L80](../packages/ai/src/context/assembler.ts#L80)). Fix: per-request unique tokens (`«PERSON_NAME_1»`), value→token dedup within a request, reject token/value conflicts, and **escape token-shaped substrings in user input** so a user typing `«NAME»` can't poison the map.

### A4. Normalization engine + span core (COMPLETE)
A normalization pre-pass (NFKC, strip zero-width/control chars, collapse intra-token whitespace) with an **offset map back to original text**, then a **span-based detector core**: detectors return `{start, end, type, confidence}`; overlaps resolved deterministically (higher confidence, then longest span); replacements applied right-to-left. This is also the `PiiDetector` interface (A6) and what makes per-type recall measurable. `sweepText` becomes the default span-producing impl. **Do this before the harness.**

### A5. Widen + tier the patterns (COMPLETE)
Add AR phones, emails, undotted/unlabeled DNI, labeled addresses. Tier as `high-confidence` (gated, always redact) vs `heuristic` (redact + flag). CUIL/CUIT with a valid mod-11 check digit = high-confidence; invalid-but-shaped = heuristic. Tier is an explicit field on each pattern with a safe default (`heuristic`).

### A6. `PiiDetector` interface (COMPLETE)
`interface PiiDetector { detect(text: string): Span[] | Promise<Span[]> }` (async-capable for ML/remote). `Span` is unified with the corpus record shape. Default impl = the regex/normalization sweep. Documented as a consumer extension point ("bring your own detector").

### A7. Re-classify leaking `logistics` fields (#8) + document residual contact risk (COMPLETE)
Move contact identifiers that are genuinely PII (`sender` emails, institution `email`/`phone`, person `phone`) to redaction; keep operationally-needed names as `logistics` but document the residual mosaic risk and offer an optional `pseudonymizeContacts` mode (default off).

---

## Deliverable B — Privacy test framework (the proof)

### Layer 0 — Canary boundary tests (COMPLETE — per-commit)
Replaces v1's brittle "enumerate `allTools` and inspect handlers." **Test the sink, not the implementation:** feed known canary PII through every registered ingress (each tool, each context source, inbound message, a thrown tool error, instructions) into a **recording mock provider**, and assert the provider never received the canary value. A new ingress that bypasses the session fails here. This is the strongest, most durable layer.

### Layer 1 — Deterministic gate (COMPLETE — per-commit)
- **`fast-check` structural invariant** (the PROVEN claim): ∀ entity × classification, no `direct-identifier` value appears in `redactEntityForLlm` output. Plus token-collision and token-shaped-input properties.
- **Versioned es-AR corpus**, *hand-curated adversarial first* (~20-30 cases: dotted/undotted/labeled DNI, CUIL, phone, email, address, names, credential numbers, and obfuscated forms — spaced digits, zero-width, OCR noise). A seeded synthetic generator with valid check digits + an obfuscation grammar is a **later** add (it only emits shapes we already imagined — see taste decision T1).
- **Recall harness** over the span core: per-type recall + false-positive rate. **Hard gate only on the narrow invariant** (no known direct-identifier value survives) + 100% recall on `high-confidence` types. Per-type/heuristic recall is a **reported metric**, not a build-breaker, until patterns stabilize — avoids a self-tightening CI tarpit.
- **Actionable failures** (first-class deliverable): on failure print corpus case id, PII type, the boundary that leaked, masked excerpt, normalized form, seed, and a copy-paste focused-test command. **Never print raw production-derived PII.** Separate diagnostics for detection-miss (`assertDetectorRecall`) vs boundary-bypass (`assertProviderBoundarySafe`) — different fixes.

### Layer 2 — ML detection oracle (offline) — *challenged, see UC2*
Presidio + GLiNER `gliner_multi_pii-v1` (Apache-2.0) as a **batch CLI job over synthetic data**, not a REST service. Hardened: ephemeral no-network container, read-only mounts, no request logging, pinned image/model digests, emits hashes/corpus-ids not raw spans. Finds NER PII (names/addresses) the regex can't; residuals become new corpus cases. *Review: build only after the corpus produces a known escape ML closes.*

### Layer 3 — Adversarial red-team (Promptfoo) — *challenged, see UC3*
Promptfoo `pii:*` plugins + jailbreak/injection against a real-provider nightly. Advisory only (LLM-judge misclassifies up to 37%), files issues, never gates. *Review: low yield for an SDK whose findings mostly concern the consumer's prompt/provider.*

---

## Tool decision matrix (from /deep-research, cited & verified)

| Tool | Runtime | Role | License | Verdict |
|---|---|---|---|---|
| **Promptfoo** | TS/Node (npx) | red-team, advisory | MIT | ✅ Layer 3 (if kept) |
| **Presidio + GLiNER multi_pii** | Python batch | offline oracle | Apache-2.0 | ✅ Layer 2 (if kept) |
| `fast-check` | TS | property tests | MIT | ✅ Layer 1 |
| DeepTeam / Giskard | Python | red-team (LLM-judge) | — | ❌ redundant; judge ≠ gate |
| Piiranha-v1 | model | detector | **CC-BY-NC-ND** | ❌ license blocks SDK use |

Sources: promptfoo.dev/docs (pii plugin, CI exit-code gate), github.com/microsoft/presidio (completeness disclaimer), huggingface.co/urchade/gliner_multi_pii-v1 (Apache-2.0), arXiv:2410.16527 (judge ≤37% misclassification).

---

## Phasing (revised — leak fix is severable and urgent)

- **M1 — Close the sink (COMPLETE):** A0 session + A1 boundary enforcement + A2 branded types + A3 token fix + A7 reclassification + **Layer 0 canary tests**. This closes kerkit-owned ingress 1-8.
- **M2 — The measured gate (COMPLETE):** A4 normalization/span core + A5 tiers + A6 detector interface + Layer 1 corpus/harness/`fast-check` + masked diagnostics.
- **M3 — Consumer kit (DEFERRED per D2 — triggered, not scheduled):** ships as internal subpath `@kerkit/core/privacy-testing` only (corpus-as-pluggable-input + `assertNoLeak`/`assertProviderBoundarySafe`). A separate published `@kerkit/privacy-testing` package waits for a real external consumer.
- **M4 — Scouts (DEFERRED per D2 — triggered, not scheduled):** Layer 2 oracle is built **only if** M2's corpus review surfaces an ML-closable escape; Layer 3 Promptfoo waits for a reference app. Neither is on the calendar.

**Committed now (post-gate D2):** M1 + M2. The leak-closing boundary and the measured deterministic gate. M3/M4 are documented and deferred behind explicit triggers.

---

## NOT in scope (→ TODOS.md)
Encryption/key management; replacing the provider or adding a local/edge model (*but document why third-party-LLM-plus-redaction is the chosen posture vs on-device — CEO finding 9*); training our own NER; differential privacy; transparency-report UI. **Outbound external-tool query args** (a DNI in an email search query reaches Gmail) — note in threat model, accept as user searching own account.

---

## Dual-voice consensus tables

```
CEO — Claude subagent | Codex | Consensus
1. Premises valid?            partial | partial | DISAGREE→ UC1/UC2 (4 + oracle premature)
2. Right problem?             reframe | reframe | CONFIRMED (split proof/measured; enforce sink)
3. Scope calibration?         over    | over    | CONFIRMED → UC1/UC2/UC3 (ship M1+M2, defer rest)
4. Alternatives explored?     no(edge)| —       | Claude-only (document on-device alt)
5. Competitive/market risk?   yes     | yes     | CONFIRMED (maintenance > value @ 0 users)
6. 6-month trajectory?        regret  | regret  | CONFIRMED (porous sink + half-built layers)
```
```
ENG — Claude subagent | Codex | Consensus
1. Architecture sound?        per-path bad | per-path bad | CONFIRMED → centralize at sink + brand types
2. Test coverage sufficient?  overstated   | overstated   | CONFIRMED → canary sink + split proof/measured
3. Performance/correctness?   sweep order  | sweep order  | CONFIRMED bug (overlap, ordering)
4. Security threats?          token collide| token collide| CONFIRMED critical (collisions, injection, sidecar)
5. Error paths?               exceptions   | exceptions   | CONFIRMED (tool errors + instructions leak)
6. Deployment risk?           Python infra | Python infra | CONFIRMED → defer oracle
```
```
DX — Claude subagent | Codex | Consensus
1. Getting started <5min?     yes-if  | yes-if  | CONFIRMED (Python is maintainer not consumer friction)
2. API naming guessable?      under   | under   | CONFIRMED (pin assertNoLeak/PiiDetector/Span)
3. Error messages actionable? NO      | NO      | CONFIRMED (biggest adoption risk → Layer 1 failures)
4. Docs findable & complete?  no(demo)| —       | Claude-strong (extend example, ship recipe)
5. Upgrade path safe?         no      | no      | CONFIRMED (redactInput default = silent change → policy obj)
6. Dev env friction-free?     Python  | Python  | CONFIRMED (contributor Docker/model cache)
```

## Decision Audit Trail
<!-- AUTONOMOUS DECISION LOG -->

| # | Phase | Decision | Classification | Principle | Rationale |
|---|-------|----------|----------------|-----------|-----------|
| 1 | Gate | Confirm 4 premises + oracle (full plan) | Premise gate (user) | — | User chose "full plan" at D1 |
| 2 | Eng | Centralize redaction at provider sink (RedactionSession) vs per-path | Auto (confirmed by both) | P1,P5 | One enforced chokepoint covers ingress 1-7; per-path missed 3 holes |
| 3 | Eng | Brand `SafeProviderInput`; make raw constructors internal | Auto (confirmed) | P5 | Compile-error beats "MUST use" convention |
| 4 | Eng | Per-request unique tokens + conflict reject + escape token-shaped input | Auto (confirmed bug) | P1 | `«NAME»` collides across people; map overwrite |
| 5 | Eng | Normalization+span core before harness | Auto (confirmed) | P5 | Obfuscation is an engine task; flat match log can't do per-type recall |
| 6 | CEO/Eng | Split "proven structural invariant" vs "measured recall"; pin README to proven | Auto (confirmed) | P1 | "Prove no leakage" is false; protects credibility |
| 7 | DX | Actionable failure output (masked, never raw PII) + split detector/boundary diagnostics | Auto (confirmed) | P1 | A gate that says "recall<100%" gets disabled |
| 8 | DX/Eng | `redactInput` boolean → explicit policy object; loud unsafe bypass | Auto (confirmed) | P5 | Default-on mutation is a silent breaking change |
| 9 | Eng/DX | Corpus = pluggable input (PiiCorpus in core); AR is one provider | Auto (confirmed) | P4 | Premise-4 promise needs consumers' own corpora |
| 10 | Eng | Re-classify leaking `logistics` PII (emails/phones) | Auto (confirmed) | P1 | Gate must not be green while these flow |
| 11 | Eng | ML oracle = batch CLI over synthetic, hardened container (not REST) | Auto (confirmed) | P5 | Smaller attack surface; no PII-receiving service |
| 12 | Eng | Hard-gate only the narrow invariant; per-type recall reported not blocking | Auto (confirmed) | P3 | Avoid self-tightening CI tarpit |
| T1 | Eng | Hand-curated adversarial corpus first; synthetic generator later | Taste | P3,P5 | Generator only emits known shapes; obfuscation needs a grammar |
| UC1 | CEO | Defer `@kerkit/privacy-testing` package → internal subpath | User Challenge — **ACCEPTED at D2** | — | User adopted recommended phasing; ship internal subpath, publish later |
| UC2 | CEO | Defer Python oracle until corpus shows an ML-closable escape | User Challenge — **ACCEPTED at D2** | — | User adopted recommended phasing; oracle is trigger-gated |
| UC3 | CEO | Cut Promptfoo/Layer 3 until a reference app exists | User Challenge — **ACCEPTED at D2** | — | User adopted recommended phasing; Promptfoo deferred |

**Status: APPROVED (D2 — recommended phasing). Committed scope: M1 + M2.**

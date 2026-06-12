# @kerkit/core

Entities, Zod schemas, domain logic, and privacy primitives for building caretaker apps. Zero runtime dependencies except `zod`.

> ⚠️ **Not a medical device. Not medical advice.** kerkit models caretaker-authored *logistics* data (appointments, paperwork, prescriptions-as-documents, notes) — not clinical records. See the project [NOTICE](https://github.com/JuanseHevia/kerkit/blob/main/NOTICE).

## What's inside

- **Entities** — `Patient`, `Appointment`, `Prescription`, `Authorization`, `Note`, `Checkpoint`, `Person`, `Institution`, `Signal`, `User`, `Conversation`. All extensible via a `TExt` type slot; see [EXTENDING.md](https://github.com/JuanseHevia/kerkit/blob/main/EXTENDING.md).
- **Schemas** — Zod create/update schemas for every entity, exported un-frozen so you can `.extend()` them.
- **Domain** — the authorization (trámite) state machine as a pure transition planner, the care-event taxonomy (`chemo`, `imaging`, `ambulatory_medication`…) with per-kind metadata, treatment cycle helpers, and deadline/expiry date math.
- **Privacy** — data classification for every entity field, `redactEntityForLlm` (identifiers → placeholder tokens; sensitive health fields require written opt-in), `sweepText` (regex pass over free text using locale-pack identifier patterns), consent records, export/deletion manifests, audit events.
- **i18n** — the `LocalePack` interface and copy-key registry. Core ships no display strings; `@kerkit/pack-argentina` is the reference pack.
- **Fixtures** — the canonical synthetic persona (Marta Pérez, DNI 12.345.678, Obra Social Demo Salud). Use it for every test and demo; never invent new fake people.

## Quick taste

```ts
import {
  planTransition,
  redactEntityForLlm,
  patientClassification,
  fixturePatient,
} from '@kerkit/core';

// Pure state machine: validate + describe effects; persist however you like.
const plan = planTransition({ status: 'pending' }, 'confirmed');
// → { updates: { status: 'confirmed', confirmedDate, … }, timelineEntry: { … } }

// Privacy: identifiers never reach the model.
const { redacted, tokens } = redactEntityForLlm(fixturePatient, patientClassification, {
  allowSensitiveFields: ['treatmentPhase'], // health data passes only by written opt-in
});
// redacted.name === '«NAME»', redacted.nationalId === '«NATIONAL_ID»'
// redacted.diagnosis is omitted; tokens maps placeholders back for UI display
```

## License

Apache-2.0

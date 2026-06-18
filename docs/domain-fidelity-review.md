# Kerkit — Domain Fidelity Review (Argentina caretaker primitives)

> **Scope.** A review of how accurately `@kerkit/core` + `@kerkit/pack-argentina` represent the
> real primitives, entities, and processes a caretaker faces when managing chronic/oncological
> treatment inside Argentina's *obra social / prepaga* system — and a concrete plan to turn the SDK
> into a shareable standard for health-tech builders in Argentina (and the region).
>
> **Method.** Grounded in a real case study (an oncology patient on a major Argentine *prepaga*,
> treated across leading oncology, imaging, and nuclear-medicine institutes, with chemotherapy,
> radiotherapy, home hospitalization, and a transition to palliative care),
> reconstructed from the caretaker's own operational artifacts: a Drive case file, a Gmail
> *"Tratamiento"* label (~200 forwarded threads), and a Notion treatment project. **All identifiers,
> names, and clinical details in this document are anonymized or replaced with synthetic patterns**,
> consistent with the SDK's own privacy stance (`docs/ley-25326.md`, `privacy/*`).

---

## 0. Implementation status

A first slice of the recommendations below has already shipped (the rest of the analysis stands as
the roadmap):

- ✅ **`Task` + `Checklist` primitive** (§3.1) — new core entity (`entities/task.ts`), Zod schemas
  (`schemas/task.schema.ts`), dependency/roll-up domain logic (`domain/tasks.ts` + tests), privacy
  classification, `DELETION_ORDER` wiring, repository interfaces, `es-AR` strings, fixtures, and the
  Drizzle table/repository in `@kerkit/server`.
- ✅ **Anonymized signal-classification corpus** (§4.2, §6.3) — a reference corpus of real obra-social /
  clínica / recetario subject lines (synthetic persona, brand-neutral senders) in
  `pack-argentina/src/pack.test.ts`, plus pattern fixes so the real vocabulary (*Nueva orden*,
  `comunicaciones@` / `notificaciones@` senders, *preparando*, *listo para entregar*) classifies
  correctly and is robust to a `Fwd:` prefix.

Still open (recommended next): `MedicationOrder` + *Trámite N°* / *Reclamo*, `Study`/`Result`,
structured visit notes, `MedicationRegimen`, care-intent/phase machine — see §3 and §7.

---

## 1. Ground truth: what the real workflow actually looks like

The caretaker's day-to-day, reconstructed from primary sources, decomposes into **seven recurring
loops**. The labels in *italics* are the literal terms used by Argentine providers/insurers.

### 1.1 Medication: prescription → order → authorization → provision → delivery

This is **one chain of five distinct artifacts**, not a single "prescription" object:

| Real artifact | Source system (observed) | Notes |
|---|---|---|
| *Receta* (prescription) | `recetario.com.ar` ("Nueva receta") | Issued by the prescriber; PDF attached; has a validity window (~30 days). |
| *Orden* (order) | `recetario.com.ar` ("Nueva orden") | A **separate** document from the receta — the medication order itself. |
| *Autorización* (insurer approval) | obra social autogestión ("…descargá tus autorizaciones aprobadas") | Carries a ***Trámite N°*** (e.g. a 7-digit case number); downloadable comprobante (PDF). |
| *Provisión / pedido de medicación* | insurer logistics ("Estamos preparando tu pedido" → "listo para entregar") | A delivery lifecycle: **preparing → ready → delivered**, distinct from approval. |
| *Reclamo* (claim/escalation) | insurer CAS / Soporte ("Reclamo N° …") | Opened when something stalls or stocks out; has its **own tracking number**. |

**Key observation:** approval (*autorización*) and fulfilment (*provisión*) are two different state
machines, each with its own external reference. A caretaker frequently has an *approved*
authorization but an *undelivered* medication — and the failure path is a *reclamo*, not a simple
"escalation" flag.

### 1.2 Appointments (*turnos*) with pre-questions and feedback

- *Turnos* arrive from **multiple institutions** with their own portals/reminders (an oncology
  institute, an imaging/neuro center, day-hospital systems). Types observed: *consulta*,
  *diagnóstico por imágenes*, *medicina nuclear*, *laboratorio*, *quimioterapia*.
- **Before** a consult the caretaker maintains a **question list** ("Preguntas para la Dra. …") and a
  **prep checklist** ("llevar el último análisis de sangre", "laboratorio pre-consulta con CA").
- **After** a consult the caretaker writes **feedback notes** that are *clinical and actionable*, e.g.
  (paraphrased/anonymized): "continue oral chemo while doing radiotherapy; titrate the pain med
  +25 mg every 4 days based on response; post-radiotherapy do a CT and review." These notes
  **directly spawn new tasks, medication-schedule changes, and the next appointment**.

### 1.3 Treatment chores / checklists (the dominant daily reality)

The single largest category of work — and the one with **no SDK primitive today**:

- **Recurring weekly checklist** ("Checklist semanal + agenda de citas, lunes primera hora").
- **Dependency-ordered prep lists** ("Next steps": lab pre-chemo → authorizations → schedule CT →
  lab pre-consult → consult — i.e. *lab must precede consult*).
- **Episodic checklists** like a *discharge-prep* list: "coordinate discharge logistics with the home-care
  rep; request morphine-patch prescriptions; buy medications; request a walker from the insurer's
  orthopedics; map cash flow for the coming months."
- **Daily administration chores**: "medication AM/noon/PM; pick up dexamethasone; physiotherapist on
  the 27th."

These are caretaker **tasks** with: due dates, recurrence, dependencies, an assignee, links to
appointments / authorizations / prescriptions, and a completion state. **Appointments are one
subtype; most chores are not appointments.**

### 1.4 Studies & results (*estudios / informes*)

The Drive case file is organized **by study**: histopathology, biopsy (vertebra), imaging/diagnostics,
reports, nuclear medicine, radiotherapy (per region), catheter placement. Each *estudio* has a type,
a date, an ordering institution, and eventually a **result document** ("Resultados de estudio",
"informe disponible"). Results feed the next *consulta*.

### 1.5 Care-context transitions: active → home hospitalization → palliative

The treatment arc moved through **active treatment (Etapa I/II) → ad-hoc radiotherapy → discharge →
*internación domiciliaria* (home hospitalization, with its own team: physician, physiotherapist,
nurse) → palliative care**. The Notion weekly reviews explicitly mark "transición a cuidados
paliativos" and re-triage tasks accordingly (close active-treatment tasks; preserve future *turnos*).
This is a **care-intent** change that reshapes everything downstream.

### 1.6 Care team (many providers, including home care)

Multiple oncologists, several institutions, an insurer, **plus** a home-care team (physician,
physiotherapist, nurse) and a discharge department. The patient↔provider graph is many-to-many and
role-rich.

### 1.7 Financial / insurance side-quests

A life/health insurance *siniestro* (claim) ran in parallel (document requests, status updates), and
budgeting/cash-flow planning was an explicit caretaker task. The SDK's own `EXTENDING.md` already
hints at this with a `copayArs` example.

### 1.8 Ingestion reality: forwarded email

Every insurer/provider email reaches the caretaker **as a forward from the patient** (`Fwd:` subject,
original sender quoted in the body: "De: <obra social> <…>"). Signal classification must read the **original**
sender/subject from inside a forwarded message, not the envelope.

---

## 2. Fidelity assessment — how the current SDK scores

Legend: ✅ solid · ⚠️ partial · ❌ missing. File refs are to `packages/core/src` unless noted.

### 2.1 Primitive #1 — Medicine prescription authorizations

| Aspect | Status | Evidence / gap |
|---|---|---|
| Prescription as entity, with validity/expiry | ✅ | `entities/prescription.ts` + `domain/dates.ts` (`calculateExpiryDate`, `getPrescriptionStatus`); pack sets `prescriptionValidityDays: 30`. |
| Authorization as entity with lifecycle | ✅ | `entities/authorization.ts`, `domain/state-machine.ts` (`needed→requested→pending→confirmed`, any→`escalation`). Clean and correct. |
| Authorization timeline / audit trail | ✅ | `AuthorizationTimelineEntry` (`status_change`/`signal`/`manual_note`/`escalation_trigger`). |
| Deadline + auto-escalation | ✅ | `domain/dates.ts` `isEscalationNeeded`; `authorizationDeadlineHours: 48`. |
| **Receta vs. Orden distinction** | ❌ | Only `Prescription` exists; the separate *orden* document has no representation. |
| **Insurer trámite number / external reference** | ❌ | `Authorization` has no `externalReference` / *Trámite N°* field — yet this is the number a caretaker quotes on every phone call. |
| **Medication provision/delivery lifecycle** | ⚠️ | Captured only as `Signal` types (`med_ready_for_pickup`, `med_delivery_confirmed`, `med_shortage`). No entity tracks *preparing → ready → delivered*, pharmacy, or delivery method. Approval ≠ fulfilment. |
| **Reclamo (claim) as trackable object** | ❌ | Only an `escalation` status + `EscalationSopStep`. A *reclamo* has its own number and lifecycle and can coexist with an approved authorization. |
| Per-insurer SLA modeling | ⚠️ | `InsurerModel.authorizationSlaDays` exists but only the demo insurer has data; the real catalog entries (Omint, OSDE, Swiss Medical, PAMI, …) are name-only. |

### 2.2 Primitive #2 — Appointments with pre-questions & feedback notes

| Aspect | Status | Evidence / gap |
|---|---|---|
| Appointment entity + status machine | ✅ | `entities/appointment.ts` (`upcoming/completed/cancelled/rescheduled`), care-event kinds in `domain/care-events.ts`. |
| Care-event taxonomy (chemo/imaging/lab/…) with prep/auth flags | ✅ | `CARE_EVENT_KINDS` is excellent — `requiresAuthorization`, `requiresPrep`, `generatesResultDocument`. |
| Multi-institution + provider linkage | ✅ | `institutionId`, `personId`, `Institution`, `Person`. |
| **Pre-appointment questions** | ⚠️ | Representable as a pinned `Note` (the fixture even has "Preguntas para la Dra. Gómez"), but there's no `noteRole`, no question/answered state, no "bring-to-appointment" semantics. |
| **Post-appointment feedback notes** | ⚠️ | `Checkpoint` captures a visit summary string; `Note` can be linked to an appointment. But real feedback notes encode **decisions/instructions that spawn tasks and med changes** — there's no structure for that, and no link from a note to the tasks it generates. |
| Note ↔ appointment linkage | ✅ | `Note.linkedAppointmentId`. |
| Recurrence | ⚠️ | `Appointment.recurrencePattern` is a free string with no helper/parser. |

### 2.3 Primitive #3 — Treatment chores (appointments, checklists)

| Aspect | Status | Evidence / gap |
|---|---|---|
| **Generic task / chore entity** | ❌ | **None.** This is the biggest gap. Appointments and authorizations are specialized; the everyday "buy meds / request walker / coordinate discharge / pick up dexamethasone" chores have nowhere to live. |
| **Checklist (grouped items)** | ❌ | No grouping primitive; no roll-up completion. |
| **Task dependencies** | ❌ | No way to express "lab before consult". |
| **Recurring chores** | ❌ | No recurrence model for tasks (only the free-string field on appointments). |
| Assignee / delegation | ❌ | No assignee on any entity (single-caretaker assumption). |
| Treatment plan / cycle progress | ✅ | `domain/treatment.ts` (`TreatmentPlan`, `cycleProgress`, `nextExpectedSession`) — good descriptive model. |

### 2.4 Cross-cutting primitives

| Aspect | Status | Evidence / gap |
|---|---|---|
| **Study / result (estudio/informe)** | ❌ | No entity. Drive is literally organized by study; results drive consults. `report_available`/`lab_results_available` signals exist but nothing persists the study. |
| **Medication regimen / administration schedule** | ❌ | `Prescription` tracks issue/expiry, not dosing (AM/noon/PM), titration, or PRN — the core of daily caretaking. |
| **Care intent / phase transitions** | ⚠️ | `treatmentPhase` is a free string; no `careIntent` (curative/palliative/supportive), no *internación domiciliaria* context, no phase state machine. |
| **Care team** | ⚠️ | `Person` exists but `PersonRole` lacks `kinesiologo`/`enfermero`/`cuidador`/`paliativista`; no patient↔team relation. |
| **Signal ingestion from forwarded email** | ⚠️ | `signal-patterns.ts` matches sender/subject, but real mail is `Fwd:` with the original sender in the body. Needs a documented "unwrap forward" step. |
| Privacy: classification / redaction / consent / audit | ✅✅ | `privacy/*` is a genuine strength and a differentiator. Keep it central. |
| i18n / locale-pack abstraction | ✅ | `i18n/*` + `LocalePack` is the right seam for regional expansion. |
| Repository interfaces, userId-scoping | ✅ | `repositories.ts` clean; `ExternalSources` bridges email/calendar/docs. |

**Bottom line:** the SDK models the *insurer-approval* spine well and has best-in-class privacy
primitives, but it under-represents (a) **tasks/checklists**, (b) the **medication fulfilment chain +
reclamo + trámite**, (c) **studies/results**, and (d) **structured visit notes that drive action**.
Those four additions close ~80% of the real workflow gap.

---

## 3. Recommendations — new & extended primitives

Ordered by impact. Each is additive and backward-compatible with the existing generic `<TExt>` +
`extendClassification` pattern.

### 3.1 `Task` + `Checklist` (NEW core entity) — highest impact

```ts
type TaskKind = 'chore' | 'prep' | 'admin' | 'medication' | 'followup';
type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';

interface TaskBase {
  id: string;
  userId: string;
  title: string;
  description?: string;
  kind: TaskKind;
  status: TaskStatus;
  dueDate?: Date;
  recurrencePattern?: string;        // shared parser with Appointment
  assignee?: string;                 // caretaker delegation
  checklistId?: string;              // grouping; roll-up completion
  dependsOn?: string[];              // "lab before consult"
  // first-class links to the things a chore is about:
  linkedAppointmentId?: string;
  linkedAuthorizationId?: string;
  linkedPrescriptionId?: string;
  linkedStudyId?: string;
  sourceNoteId?: string;             // the feedback note that spawned it
  source?: string | null;
  sourceExternalId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- A **`Checklist`** is a lightweight group (`id`, `userId`, `title`, `templateId?`, `appointmentId?`)
  with computed progress (`done/total`). Model "weekly checklist", "discharge prep", "pre-consult
  prep" as checklists; an `Appointment` can own its prep checklist.
- Provide **checklist templates** in the locale pack (e.g. *pre-quimio*, *pre-consulta*, *alta /
  discharge*) so apps generate the right chores per care-event kind.

### 3.2 `MedicationOrder` (NEW) + `Authorization` enrichment — fulfilment vs. approval

```ts
type MedicationOrderStatus =
  | 'ordered' | 'authorized' | 'preparing' | 'ready_for_pickup' | 'in_transit'
  | 'delivered' | 'shortage' | 'cancelled';

interface MedicationOrderBase {
  id: string;
  userId: string;
  prescriptionId?: string;
  authorizationId?: string;
  insurerId: string;
  status: MedicationOrderStatus;     // its own state machine
  deliveryMethod?: 'pickup' | 'home_delivery';
  pharmacyName?: string;
  externalReference?: string;        // order/tracking number
  orderedDate?: Date;
  readyDate?: Date;
  deliveredDate?: Date;
  createdAt: Date; updatedAt: Date;
}
```

Add to `Authorization`: `externalReference?` (***Trámite N°***), `portalUrl?`, and either a `Claim`
entity or fields `claimNumber? / claimOpenedAt? / claimStatus?` for *reclamos*. A `med_shortage`
signal should be able to (a) push the order to `shortage` and (b) open a *reclamo* — wire this into
the state machine, not just a boolean `escalationTriggered`.

### 3.3 `Study` / `Result` (NEW core entity) — the estudio/informe spine

```ts
type StudyType =
  | 'histopathology' | 'imaging' | 'lab' | 'nuclear_medicine' | 'biopsy' | 'other';
type StudyStatus = 'ordered' | 'scheduled' | 'done' | 'report_available';

interface StudyBase {
  id: string; userId: string;
  type: StudyType; title: string;
  status: StudyStatus;
  date?: Date;
  institutionId?: string;
  linkedAppointmentId?: string;
  linkedCheckpointId?: string;
  reportUrl?: string; filePath?: string;
  createdAt: Date; updatedAt: Date;
}
```

Wire `report_available` / `lab_results_available` signals to create/advance `Study` records.

### 3.4 Structured visit notes — make primitive #2 first-class

- Add `noteRole?: 'pre_appointment_question' | 'post_appointment_feedback' | 'general'` and, for
  questions, a `resolved?: boolean` to `Note` (or a thin `AppointmentNote` view).
- Allow a **post-appointment feedback note to emit `Task`s and medication-schedule changes**
  (`Task.sourceNoteId`). This mirrors the real "Notas visita…" → next-steps behavior.
- Promote `Checkpoint` to optionally reference the `Study` results and the `Tasks` it generated.

### 3.5 `MedicationRegimen` (NEW or on `Prescription`) — daily administration

Frequency (`daily_am_noon_pm`, `q4d_titration`, `prn`), dose, times, titration rule, start/stop.
This unlocks the most frequent caretaker question of all: *"did she take X at noon?"*

### 3.6 Care-context & care team

- Add `careIntent?: 'curative' | 'palliative' | 'supportive'` to `Patient`/treatment context and a
  small **phase state machine** (`active → discharge → home_care → palliative`).
- Extend `PersonRole` with `'kinesiologo' | 'enfermero' | 'cuidador' | 'paliativista'`; add a
  `CareTeamMember` link (patient ↔ person, role-in-treatment, active range) to support
  *internación domiciliaria*.

### 3.7 Ingestion: documented "unwrap forwarded email" step

Add a `unwrapForward(raw): { sender, subject, body }` helper (or document the contract) so
`signal-patterns.ts` matches the **original** insurer / prescription-platform sender, not the caretaker's envelope.
Ship the regexes for the `Fwd:` / "De: … <…>" pattern in the pack.

---

## 4. Test cases to add

Grounded in the real corpus (anonymized). These double as living documentation.

### 4.1 Authorization + fulfilment lifecycle
1. `needed → requested → pending → confirmed` sets `requestedDate` then `confirmedDate`; records 3
   timeline entries. *(extends existing `state-machine.test.ts`.)*
2. Deadline breach with status ≠ `confirmed` ⇒ `isEscalationNeeded` true ⇒ transition to
   `escalation` sets `escalationTriggered`.
3. `confirmed` authorization + `MedicationOrder` advancing `authorized → preparing → ready_for_pickup
   → delivered`; assert approval and fulfilment are independent.
4. `med_shortage` signal on a `preparing` order ⇒ order → `shortage` **and** opens a reclamo with a
   tracking number; reclamo resolution returns order to `preparing`.
5. `Authorization.externalReference` (*Trámite N°*) round-trips through schema validation.

### 4.2 Signal classification against the real subject corpus
Feed anonymized real subjects and assert `(signalType, suggestedAction)`:

| Input subject (anonymized) | Expected `signalType` |
|---|---|
| `Fwd: Nueva receta - <APELLIDO>, <NOMBRE> (<AFIL>) - <Insurer>` | `prescription_detected` |
| `Fwd: Nueva orden - … - <Insurer>` | `prescription_detected` *(or new `medication_order_detected`)* |
| `Fwd: …, ya podés descargar tus autorizaciones aprobadas.` | `auth_approved` |
| `Fwd: Estamos preparando tu pedido de medicación` | `auth_preparing` *(or `med_preparing`)* |
| `Fwd: Tu pedido de medicación está listo para entregar` | `med_ready_for_pickup` |
| `Fwd: Reclamo N° …` | new `claim_update` |
| `Fwd: Recordatorio Turno Diagnóstico por imágenes` | `appointment_reminder` |
| `Fwd: …-Resultados de estudio` | `report_available` |

- **Forwarded-prefix robustness:** the same subjects with/without `Fwd:` must classify identically.
- **No false positives:** an unrelated forwarded email (e.g. a visa appointment) ⇒ `unknown`.

### 4.3 Tasks & checklists
1. Checklist roll-up: marking all items `done` ⇒ checklist progress `1.0`.
2. Dependency guard: a task with an unmet `dependsOn` cannot move to `done` (or surfaces `blocked`).
3. Recurring weekly chore regenerates next instance on completion.
4. A post-appointment feedback note with 2 action items emits 2 `Task`s carrying `sourceNoteId`.

### 4.4 Prescription / regimen / study
1. `getPrescriptionStatus` returns `expiring` inside the 5-day window, `expired` after 30 days.
2. Titration regimen (`+25mg q4d`) computes the correct dose on a given day.
3. `report_available` signal materializes a `Study` with `status: 'report_available'`.

### 4.5 Privacy (regression-protect the differentiator)
1. `redactEntityForLlm(patient)` tokenizes name / national id / credential; **omits** diagnosis
   unless `allowSensitiveFields: ['diagnosis']`.
2. `sweepText` catches `afiliado <N>`, dotted DNI, CUIL, and a credential label in free-text notes.
3. Consent gating: with `llm_assistant` revoked, context assembly refuses to send.
4. `DELETION_ORDER` deletes children before parents for the full graph **including the new entities**
   (tasks, orders, studies, claims).

---

## 5. Documentation example ideas

Each is a runnable, copy-pasteable vignette built on the synthetic fixture persona.

1. **"Model the real case in 30 lines"** — create patient + insurer + an upcoming chemo turno + its
   authorization + medication order, and print the next action. The flagship quickstart.
2. **The *trámite* lifecycle** — drive an authorization through `needed → confirmed`, attach the
   *Trámite N°*, then run the medication order to `delivered`; show the timeline.
3. **Weekly checklist generator** — from upcoming care-events, generate a *pre-consulta* /
   *pre-quimio* checklist via locale-pack templates; render progress.
4. **Pre-questions in, action items out** — attach a question list to a turno; after the visit, turn a
   feedback note into tasks + a regimen change.
5. **Signal ingestion from a forwarded obra-social email** — unwrap a `Fwd:` message, classify it,
   and show the suggested caretaker action in `es-AR`.
6. **A *reclamo* when the med doesn't arrive** — `med_shortage` ⇒ open and track a claim.
7. **Privacy walkthrough** — what the LLM sees vs. what's stored; export & delete (Ley 25.326).
8. **Build a new locale pack** — `pack-chile` / `pack-mexico` from the `LocalePack` interface: insurers,
   identifier regexes, signal patterns, strings, rules.
9. **From active treatment to palliative** — flip `careIntent`, re-triage tasks, preserve future turnos
   (the real, humane edge case).

---

## 6. Key components to become a shared standard

What turns a good SDK into a reference the Argentine (then regional) health-tech community adopts:

1. **Close the four primitive gaps** (Task/Checklist, MedicationOrder + Trámite/Reclamo,
   Study/Result, structured visit notes). These are the missing 20% that block real apps.
2. **Publish a canonical "Argentine obra-social workflow" spec** — `docs/workflow-obra-social.md`:
   the receta → orden → autorización → provisión → entrega chain, reclamo paths, and turno/estudio
   loops, as a vendor-neutral reference diagram. This is the artifact people will cite.
3. **Ship a reference signal corpus** — an anonymized fixture set of real subject lines (Recetario,
   obra social / prepaga, clínica and imaging-center reminders) as `pack-argentina` test fixtures. A shared corpus
   is how classification accuracy becomes comparable across implementations.
4. **A conformance test kit** — extend the existing `pack.test.ts` idea into a published
   `@kerkit/conformance` that any locale pack or backend adapter runs to claim "kerkit-compatible":
   copy-key completeness, signal-pattern validity, identifier-redaction coverage, full state-machine
   legality, and deletion-order integrity.
5. **Adapter packages, not just types** — reference connectors: email/calendar/Drive ingestion
   (`ExternalSources`), and a documented path for *autogestión* portals. Lower the integration cost.
6. **Privacy as the headline feature** — the Ley 25.326 mapping, classification/redaction/consent/
   audit are a real differentiator in LATAM health tech. Lead with it; keep "not a medical device"
   prominent.
7. **Regional expansion kit** — a "how insurers differ" matrix (AR *obra social/prepaga/PAMI* vs.
   MX *IMSS/seguro* vs. CL *Isapre/Fonasa*) plus `pack-*` scaffolds. The `LocalePack` seam already
   supports this; provide the on-ramp.
8. **Governance & trust** — versioned policy strings (already in `ConsentRecord.policyVersion`),
   `CONTRIBUTING`/`SECURITY` (present), and a clear "synthetic-data-only in repo" rule so contributors
   never commit real PHI.

---

## 7. Suggested sequencing

- **M-now (fidelity):** `Task`/`Checklist`, `Authorization.externalReference` + `Claim`, `MedicationOrder`,
  `Study`. Wire signals → these entities. Extend `DELETION_ORDER` + classifications. Add the test
  cases in §4.
- **M-next (depth):** `MedicationRegimen`, structured visit notes (`noteRole` + note→task), care
  intent/phase machine, care-team roles, forwarded-email unwrap helper.
- **M-standard (community):** workflow spec doc, reference signal corpus, `@kerkit/conformance`,
  ingestion adapters, regional `pack-*` scaffolds.

---

*Prepared as a design review. No code changes were made. Real-world references are anonymized; the
SDK's synthetic fixture persona should remain the only persona that ships in the repo.*

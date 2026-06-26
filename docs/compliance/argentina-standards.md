# Argentine privacy & health-data standards — compliance reference

> **Not legal advice.** This is an engineering reference: it maps the obligations in
> Argentine law onto *falsifiable, testable* requirements so they can be encoded as
> automated checks (see [evaluation-framework.md](./evaluation-framework.md)). If you
> operate a real app, consult a qualified professional.

## How this was produced

The legal claims below come from a fan-out web-research pass over **primary sources**
(the laws themselves on `infoleg.gob.ar`, `argentina.gob.ar`, `hcdn.gob.ar`,
`boletinoficial.gob.ar`) followed by **3-vote adversarial verification** — each claim
had to survive independent skeptics quoting the source text before being kept. Every
row carries its confidence:

| Tag | Meaning |
|---|---|
| **verified** | Confirmed 3-0 or 2-0 against a primary source with a quoted passage. |
| **partial** | Confirmed 2-1 — real, but one verifier dissented; treat the *requirement* as solid, the exact numeric detail as worth a lawyer's eye. |
| **sourced** | Has a primary/secondary source but was not individually fact-checked in this run (reform bill, transfers, international frameworks). |
| **unverified** | Surfaced but could not be confirmed (verifier abstained or refuted). Listed under "Not asserted" so we don't build tests on sand. |

---

## 1. Applicability — which laws bind a kerkit app

This is the most important decision in the whole framework, because it changes *which*
controls are mandatory. kerkit deliberately models **caretaker-authored logistics, not
clinical records** (see `NOTICE`, `pack-argentina/docs/ley-25326.md`). That distinction
is load-bearing:

| Regime | Applies to a kerkit app when… | Notes |
|---|---|---|
| **Ley 25.326** (Protección de Datos Personales / Habeas Data) | **Always.** Any app storing a real person's data is processing personal data; health data is *datos sensibles*. | The app operator is *responsable del tratamiento*; AAIP is the enforcement authority. |
| **Ley 26.529 + Decreto 1089/2012** (Derechos del Paciente, Historia Clínica) | Only if the app becomes a **clinical-record custodian** (a *historia clínica*). A pure caretaker-logistics app is **not** a custodian. | Brings the 10-year retention floor, 48 h authenticated-copy SLA, digital-signature and inalterability duties. kerkit is designed to stay *out* of this regime. |
| **Ley 27.553** (Recetas electrónicas / teleasistencia) | If the app issues **electronic prescriptions or teleassistance**. | Statutorily cross-references *both* 25.326 and 26.529 — so an e-prescription module pulls the clinical-record obligations back in. |

**Design consequence:** obligations are gated by an **app profile**
(`logistics` → `llm_assistant` → `external_sources` → `eprescription`). The framework
must not apply the 10-year clinical-record floor to a logistics-only app, nor let an
e-prescription app escape it. This is encoded directly in the control catalog.

---

## 2. Ley 25.326 — Personal Data Protection (always applies)

Primary source: [Ley 25.326 (texto)](https://www3.hcdn.gob.ar/dependencias/secparl/dgral_info_parlamentaria/dip/archivos/Ley_25326.pdf)

| # | Obligation | Article | Confidence | Testable requirement |
|---|---|---|---|---|
| 25326-1 | Health information **is** *datos sensibles*. | Art. 2 | **verified** (3-0) | Every health field (diagnosis, treatment phase, medication) must be classified as sensitive-category and never default to a looser class. |
| 25326-2 | Processing is unlawful without **free, express, informed** consent, **recorded in writing** (or equivalent), shown **"en forma expresa y destacada"** after Art. 6 notice. | Art. 5(1) | **verified** (3-0) | Sensitive processing requires a stored consent record: a free/express/informed grant, a *prominent* (not pre-ticked, not bundled) presentation, captured *after* notice, with the policy version the user saw. |
| 25326-3 | Nobody can be compelled to give sensitive data; it may be processed only for *interés general autorizado por ley*, or for statistics/science **when subjects cannot be identified**. | Art. 7 | **verified** (3-0) | Two checks: (a) lawful basis present for any sensitive processing; (b) any statistical/analytics/training export must be **de-identified to the point of non-re-identifiability**. |
| 25326-4 | Controller must adopt technical & organizational measures to guarantee security and confidentiality, prevent *adulteración, pérdida, consulta o tratamiento no autorizado*, and **detect deviations**; secreto profesional binds everyone in any processing phase. | Arts. 9–10 | **verified** (3-0) | Encryption in transit/at rest, access control, and an **audit trail that makes deviations detectable** — i.e. privacy-relevant operations must be logged. |
| 25326-5 | **Right of access** answered within **10 running days**; **rectification / suppression / update** completed within **5 business days**; cessionaries notified within 5 business days. | Arts. 14.2, 16.2, 16.4 | **verified** (3-0) | Export (access) and delete (erasure) must be *implemented* and *time-bounded*. The SDK can prove the operations exist and complete; the calendar SLA is the operator's to honor. |
| 25326-6 | **Resolución AAIP 47/2018** sets recommended security measures with **heightened treatment for *datos sensibles*** (incl. health). | AAIP 47/2018 | **verified** (3-0) | Sensitive/health data must be both *classified* and subject to stricter handling than ordinary personal data — the security posture must be data-class-aware. |

Source for AAIP 47/2018: [infoleg 312662](https://servicios.infoleg.gob.ar/infolegInternet/anexos/310000-314999/312662/norma.htm)

---

## 3. Ley 26.529 + Decreto 1089/2012 — Patient rights & clinical record (custodian profile only)

Primary sources: [Ley 26.529 (texto act.)](https://servicios.infoleg.gob.ar/infolegInternet/anexos/160000-164999/160432/texact.htm) ·
[Decreto 1089/2012](https://servicios.infoleg.gob.ar/infolegInternet/anexos/195000-199999/199296/norma.htm)

| # | Obligation | Article | Confidence | Testable requirement |
|---|---|---|---|---|
| 26529-1 | The patient is the **titular** of the historia clínica; on simple request an **authenticated copy** must be delivered within **48 hours**. | Ley 26.529 Art. 14 · Decreto Art. 14 | **verified** (3-0) | If the app *is* a clinical record: an authenticated export must be producible within 48 h of a verified request. |
| 26529-2 | **Minimum 10-year retention** of the historia clínica, counted from the **last registered interaction**; only then may it be delivered/archived/destroyed. | Ley 26.529 Art. 18 · Decreto Art. 18 | **verified** (3-0) / **partial** (2-1 on Decreto wording) | Clinical-record data has a **retention floor of ≥ 10 years**; erasure must be *blocked* inside that window. (Directly tensions Ley 25.326 Art. 16 erasure — resolved by data class, see §5.) |
| 26529-3 | Electronic/informatized records must ensure **integrity, authenticity, inalterability, durability**: restricted access with identification keys, **non-rewritable media**, and **field-modification control**. | **Ley 26.529 Art. 13** | **verified** (3-0) | Tamper-evidence + access control + change logging for any electronic clinical entry. (The integrity requirements are in the *statute* Art. 13; Decreto 1089/2012 Art. 13 only cross-refers to Ley 25.506.) |
| 26529-4 | Computerized clinical records must comply with the **digital-signature law (Ley 25.506)**. | Decreto Art. 13 | **partial** (2-1) | Each electronic clinical entry/prescription must carry a valid digital signature conforming to Ley 25.506. |
| 26529-5 | **Confidentiality binds *all* personnel** who access clinical documentation (incl. insurers, administrators); no disclosure without **express patient authorization** (narrow exceptions: public-health risk, judicial order, avoiding greater harm); breaches **logged in the record**. | Ley 26.529 Arts. 2(d), 8 | **verified** (3-0) | No PHI read/output without an authorized principal *and* a recorded basis; disclosures/breaches are audit events. |
| 26529-6 | Depositaries must implement means to **prevent access by unauthorized persons** to record contents. | Ley 26.529 Art. 18 | **verified** (2-0, 1 abstain) | Access-control gate on every PHI read path. |

Confidentiality source (Ley 26.529 PDF): [mpba.gov.ar](https://www.mpba.gov.ar/files/documents/ley_26.529-2009._Ds._del_paciente,_H._Cl._y_Cons._inf..pdf)

---

## 4. Ley 27.553 — Electronic prescriptions & teleassistance (e-prescription profile)

Primary sources: [Ley 27.553 (act.)](https://www.argentina.gob.ar/normativa/nacional/ley-27553-340919/actualizacion) ·
[Boletín Oficial 233439](https://www.boletinoficial.gob.ar/detalleAviso/primera/233439/20200811)

| # | Obligation | Article | Confidence | Testable requirement |
|---|---|---|---|---|
| 27553-1 | Teleassistance platforms are lawful **only "de conformidad con la ley 25.326 … y la ley 26.529"**. | Art. 1 inc. b) | **verified** (3-0) | An e-prescription/teleassistance profile **inherits** every 25.326 and 26.529 control as a precondition of validity. |
| 27553-2 | Responsible bodies must **guarantee custody** of the prescription/dispensing/archive databases and **establish authorization & access-control criteria**, with strict 25.326/26.529 compliance. | Art. 4 | **verified** (3-0) | RBAC + database access control + custody/integrity for prescription data. |
| 27553-3 | Restricted/archived prescriptions must be **retained ≥ 3 years** (paper or digital); only afterward may they be destroyed/erased, **with prior notice to the health authority**. | Art. 9 (mod. Ley 17.565) | **verified** (3-0) | E-prescription records get a **retention floor of ≥ 3 years (1095 days)**; erasure blocked inside the window. |
| 27553-4 | Digital signature on prescriptions must conform to **Ley 25.506**. | Art. 4 | **verified** (3-0) | Valid digital signature on each prescription. |
| 27553-5 | Systems must guarantee **trazabilidad** and issue the patient a **constancia** (verifiable receipt) of teleassistance, prescription, and dispensing. | Art. 13 | **verified** (3-0) | Every prescription/dispensing event produces an **immutable, retrievable receipt** (audit + proof-of-event). |

**Implementing regulation:** [Resolución MS 2214/2025](https://www.boletinoficial.gob.ar/detalleAviso/primera/328614/20250721) (BO 21 Jul 2025) operationalizes the receta-electrónica regime — prescriptions must issue through platforms registered in **ReNaPDiS**, introduces the **CUIR** prescription identifier, and reinforces the **≥ 3-year retention** floor (row 27553-3). It is the current implementing instrument for the e-prescription profile.

---

## 5. The retention-vs-erasure tension (why the framework is data-class-gated)

These three are all simultaneously true and **appear to contradict**:

- **Ley 25.326 Art. 16.2** — erase on request within **5 business days**.
- **Ley 26.529 Art. 18** — retain clinical records **≥ 10 years**.
- **Ley 27.553** — retain archived prescriptions **≥ 3 years**.

They coexist because they govern **different data classes**:

| Data class / record kind | Retention floor | Erasure on request |
|---|---|---|
| Caretaker logistics (kerkit default) | none | must honor (≤ 5 business days) |
| Clinical record (historia clínica) | ≥ 10 years from last entry | blocked inside window |
| E-prescription (archived) | ≥ 3 years | blocked inside window |

→ A compliant retention/erasure control is **not a single global policy**. It must be a
per-data-class rule set, and the erasure check must consult the applicable floor. This is
exactly what the framework's `retentionFloorDays(recordKind)` probe encodes.

**The legal mechanism (not merely "non-overlapping"):** the Ley 25.326 erasure right is *not
absolute* — Arts. 16–17 carve out cases where suppression does not proceed, including a
**legal duty to preserve the data**. The 10-year (26.529 Art. 18) and 3-year (27.553 Art. 9)
floors *are* that legal-preservation exception: while the floor runs, the retention duty
**defeats** an erasure request; once it lapses, the records become destroyable. So
`retentionFloorDays(recordKind)` models a statutory exception to Art. 16, not a separate
universe.

---

## 6. International frameworks — best-practice scaffolding (sourced)

These don't bind an Argentine app directly, but they sharpen the engineering controls and
give us *measurable* targets (especially de-identification quality):

- **GDPR Art. 9** — special-category data (health) mirrors *datos sensibles*; the
  "explicit consent / narrow legal basis" structure parallels Ley 25.326 Art. 7.
  [gdpr-info.eu/art-9](https://gdpr-info.eu/art-9-gdpr/)
- **HIPAA de-identification** — the **Safe Harbor** list (18 identifier types) and
  **Expert Determination** standard are a ready-made checklist for what the redaction
  layer must strip and a yardstick for "non-re-identifiable" (Ley 25.326 Art. 7).
  [hhs.gov de-identification](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html)
- **ISO 27799:2025** (Health informatics — information security controls in health based on
  ISO/IEC 27002) + **ISO/IEC 27001:2022** (ISMS) — controls for the Art. 9 "technical &
  organizational measures" duty (access control, encryption, audit).
  [ISO 27799:2025](https://www.iso.org/standard/84647.html) ·
  [ISO/IEC 27001:2022](https://www.iso.org/standard/27001)
- **Microsoft Presidio + GLiNER** — open-source PII/PHI detectors usable as an **offline
  de-identification oracle** to *measure* redaction recall (already the deferred M4 in the
  privacy plan). [presidio evaluation](https://microsoft.github.io/presidio/evaluation/)

es-AR identifier formats for redaction tests (DNI, CUIT/CUIL check digits):
[DNI (Wikipedia)](https://es.wikipedia.org/wiki/Documento_nacional_de_identidad_(Argentina)) ·
[CUIT validation](https://normadata.io/validators/ar/cuit) ·
[lookuptax AR tax-id guide](https://lookuptax.com/docs/tax-identification-number/argentina-tax-id-guide)

---

## 7. Regulatory horizon — the GDPR-modeled reform (sourced, monitor)

The AAIP-drafted Executive bill to replace Ley 25.326 with a GDPR-aligned regime
(**Mensaje 87/2023**) **lost parliamentary status (*perdió estado parlamentario*) at the end
of 2024**. As of 2026 it has been re-introduced as several competing GDPR/LGPD-aligned bills
(e.g. Dip. Carro; Sen. Doñate; Dip. Yeza's **Bill 1751-D-2026**), **none yet enacted** —
**Ley 25.326 remains in force**. If a successor passes, expect explicit data-subject rights
(portability, objection), breach-notification timelines, DPO/registry changes, and stricter
cross-border rules. Keep the control catalog **versioned** so a future `Ley-PDP` ruleset can
be added without rewriting the harness.

Separately, the AAIP adopted **new RIPD model contractual clauses for international transfers
via Resolución 198/2023** (BO 18 Oct 2023), which **complements — does not replace —
Disposición 60-E/2016**. Argentina also holds an **EU adequacy decision** (granted 2003,
reconfirmed by the European Commission on 15 Jan 2024).

- [IAPP — novedades legislativas (status: lapsed end-2024, re-introduced)](https://iapp.org/news/a/novedades-legislativas-en-argentina-sobre-protecci-n-de-datos-personales-e-inteligencia-artificial)
- [IAPP — nuevo proyecto de reforma 2026 (Bill 1751-D-2026)](https://iapp.org/news/a/se-impulsa-un-nuevo-proyecto-de-reforma-del-r-gimen-de-protecci-n-de-datos-en-argentina)
- [AAIP Resolución 198/2023 — cláusulas contractuales modelo (BO 296189)](https://www.boletinoficial.gob.ar/detalleAviso/primera/296189/20231018)
- _Note: the older [proyecto_leypdp2023.pdf](https://www.argentina.gob.ar/sites/default/files/2018/10/proyecto_leypdp2023.pdf) is the **defunct** 2023 Executive draft — retained only for historical reference._

---

## 8. Not asserted (surfaced but unverified — do **not** build tests on these)

Honesty matters more than coverage. These were refuted or could not be confirmed in this
run, so the framework does **not** encode them as hard requirements:

- ❌ That **AAIP 47/2018 mandates RBAC/authentication for production environments** (1-2) or
  **secure-erase / verifiable secure-wipe** (0-3). The *security-measures* duty is real
  (Ley 25.326 Art. 9); these *specific mechanisms* are best-practice, not a cited mandate.
- ❌ The **consent-revocation witness/initials mechanics** (2 witnesses + signatures) from
  Decreto 1089/2012 (0-3). Consent capture itself **is** required (Ley 25.326 Art. 5).
- ❌ **Decreto 1089/2012 Art. 12** as the source of "secrecy binds all personnel" (0-3) —
  but the *duty itself* **is** confirmed via Ley 26.529 Arts. 2(d) + 8 (§3, 26529-5).
- ✓ (resolved on re-check) **Art. 2 inc. d** confidentiality wording — initially abstained
  on a rate limit, now **confirmed verbatim** (Ley 26.529 Art. 2 inc. d + Art. 8) and
  encoded in §3 row 26529-5. Only the "historia clínica is **inviolable**" framing remains
  unverified and is therefore not asserted.

---

## Source quality ledger

19 claims confirmed / 6 killed out of 25 verified (from 117 extracted across 27 sources).
All core obligations trace to **primary** government sources. Full machine-readable
provenance (URL + quoted passage + vote) is mirrored in the control catalog at
`packages/core/src/compliance/controls.ts`.

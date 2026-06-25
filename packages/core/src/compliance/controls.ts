import { isConsentActive, DELETION_ORDER } from '../privacy/consent.js';
import type { ConsentScope } from '../privacy/consent.js';
import {
  ALL_PROFILES,
  RETENTION_FLOOR_DAYS,
  type AppProfile,
  type ComplianceControl,
  type ComplianceProbe,
  type ControlOutcome,
  type RecordKind,
} from './types.js';

const pass = (evidence: string): ControlOutcome => ({ status: 'pass', evidence });
const fail = (evidence: string): ControlOutcome => ({ status: 'fail', evidence });
const skip = (evidence: string): ControlOutcome => ({ status: 'skip', evidence });

/** The consent scope a profile must hold to lawfully process under Ley 25.326 Art. 5. */
function requiredScope(profile: AppProfile): ConsentScope {
  switch (profile) {
    case 'llm_assistant':
      return 'llm_assistant';
    case 'external_sources':
      return 'external_sources';
    case 'logistics':
    case 'eprescription':
      return 'store_logistics';
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * The Argentine compliance control catalog. Every entry traces to a primary
 * source (see docs/compliance/argentina-standards.md) and carries the
 * confidence it was verified at. Controls with a `check` run automatically;
 * the rest are operator attestations.
 */
export const AR_CONTROLS: ComplianceControl[] = [
  {
    id: 'AR-CLASS-HEALTH-SENSITIVE',
    title: 'Health data is classified as sensitive (datos sensibles)',
    category: 'classification',
    appliesTo: ALL_PROFILES,
    rationale:
      'Ley 25.326 Art. 2 lists health information as datos sensibles; health fields must never default to a looser class.',
    basis: [
      {
        law: 'Ley 25.326',
        article: 'Art. 2',
        url: 'https://www3.hcdn.gob.ar/dependencias/secparl/dgral_info_parlamentaria/dip/archivos/Ley_25326.pdf',
        confidence: 'verified',
        quote:
          'Datos sensibles: … información referente a la salud o a la vida sexual.',
      },
    ],
    check: (probe) => {
      const classes = probe.healthFieldClasses();
      if (classes.length === 0) return skip('no health fields declared');
      const bad = classes.filter((c) => c !== 'sensitive-health');
      return bad.length === 0
        ? pass(`${classes.length} health field(s) classified sensitive-health`)
        : fail(`health field(s) misclassified as: ${unique(bad).join(', ')}`);
    },
  },
  {
    id: 'AR-CONSENT-SENSITIVE',
    title: 'Free, express, informed, written consent recorded',
    category: 'consent',
    appliesTo: ALL_PROFILES,
    rationale:
      'Ley 25.326 Art. 5 makes processing unlawful without consent recorded in writing; an active ConsentRecord with a policy version is the proof.',
    basis: [
      {
        law: 'Ley 25.326',
        article: 'Art. 5(1)',
        url: 'https://www3.hcdn.gob.ar/dependencias/secparl/dgral_info_parlamentaria/dip/archivos/Ley_25326.pdf',
        confidence: 'verified',
        quote:
          'El tratamiento de datos personales es ilícito cuando el titular no hubiere prestado su consentimiento libre, expreso e informado, el que deberá constar por escrito…',
      },
    ],
    check: (probe) => {
      const scope = requiredScope(probe.profile);
      const rec = probe.consentFor(scope);
      if (!rec) return fail(`no ConsentRecord for scope "${scope}"`);
      if (!isConsentActive(rec)) return fail(`consent "${scope}" exists but is not active`);
      if (!rec.policyVersion) return fail('consent record missing policyVersion');
      return pass(`active consent "${scope}" @ policy ${rec.policyVersion}`);
    },
  },
  {
    id: 'AR-LLM-CONSENT-GATE',
    title: 'LLM provider invoked only with active consent',
    category: 'consent',
    appliesTo: ['llm_assistant'],
    rationale:
      'Sending (redacted) context to an LLM is processing; it requires the llm_assistant consent to be active first.',
    basis: [
      {
        law: 'Ley 25.326',
        article: 'Arts. 5, 7',
        url: 'https://www3.hcdn.gob.ar/dependencias/secparl/dgral_info_parlamentaria/dip/archivos/Ley_25326.pdf',
        confidence: 'verified',
      },
    ],
    check: (probe) => {
      if (!probe.providerInvoked()) return pass('provider not invoked this session');
      const rec = probe.consentFor('llm_assistant');
      return rec && isConsentActive(rec)
        ? pass('provider invoked with active llm_assistant consent')
        : fail('provider invoked WITHOUT active llm_assistant consent');
    },
  },
  {
    id: 'AR-REDACT-SINK',
    title: 'No direct identifier reaches the LLM sink',
    category: 'security',
    appliesTo: ['llm_assistant'],
    rationale:
      'Ley 25.326 Arts. 9–10 require preventing unauthorized consulta of personal data and bind everyone to secreto profesional; the redaction boundary must let no direct identifier through to the provider.',
    basis: [
      {
        law: 'Ley 25.326',
        article: 'Arts. 9–10',
        url: 'https://www3.hcdn.gob.ar/dependencias/secparl/dgral_info_parlamentaria/dip/archivos/Ley_25326.pdf',
        confidence: 'verified',
        quote:
          'El responsable o usuario del archivo de datos debe adoptar las medidas técnicas y organizativas que resulten necesarias para garantizar la seguridad y confidencialidad…',
      },
    ],
    check: (probe) => {
      const ids = probe.directIdentifiers().filter((v) => v.length > 0);
      const inputs = probe.capturedProviderInputs();
      const leaks: string[] = [];
      for (const input of inputs) {
        for (const id of ids) {
          if (input.includes(id)) leaks.push(id);
        }
      }
      return leaks.length === 0
        ? pass(`${inputs.length} provider input(s) inspected, 0 identifier leaks`)
        : fail(`direct identifier(s) reached the provider: ${unique(leaks).join(', ')}`);
    },
  },
  {
    id: 'AR-DEIDENT-EXPORT',
    title: 'Analytics/scientific exports are non-re-identifiable',
    category: 'minimization',
    appliesTo: ALL_PROFILES,
    rationale:
      'Ley 25.326 Art. 7 allows statistical/scientific processing only when subjects cannot be identified.',
    basis: [
      {
        law: 'Ley 25.326',
        article: 'Art. 7(2)',
        url: 'https://www3.hcdn.gob.ar/dependencias/secparl/dgral_info_parlamentaria/dip/archivos/Ley_25326.pdf',
        confidence: 'verified',
        quote:
          'También podrán ser tratados con finalidades estadísticas o científicas cuando no puedan ser identificados sus titulares.',
      },
    ],
    check: (probe) => {
      const exporter = probe.analyticsExport;
      if (!exporter) return skip('app produces no analytics/scientific export');
      const rows = exporter.call(probe);
      const ids = probe.directIdentifiers().filter((v) => v.length > 0);
      const leaks = rows.flatMap((row) => ids.filter((id) => row.includes(id)));
      return leaks.length === 0
        ? pass(`${rows.length} analytics row(s), 0 identifiers`)
        : fail(`analytics export is re-identifiable: ${unique(leaks).join(', ')}`);
    },
  },
  {
    id: 'AR-DSR-ACCESS',
    title: 'Right of access — data export with transparency notice',
    category: 'data-subject-rights',
    appliesTo: ALL_PROFILES,
    rationale:
      'Ley 25.326 Art. 14 grants a right of access (answered within 10 running days); the app must produce a complete export bundle.',
    basis: [
      {
        law: 'Ley 25.326',
        article: 'Art. 14.2',
        url: 'https://www3.hcdn.gob.ar/dependencias/secparl/dgral_info_parlamentaria/dip/archivos/Ley_25326.pdf',
        confidence: 'verified',
      },
    ],
    check: async (probe) => {
      const bundle = await probe.exportData();
      const hasNotice = typeof bundle.notice === 'string' && bundle.notice.length > 0;
      const hasStamp = bundle.exportedAt instanceof Date;
      return hasNotice && hasStamp
        ? pass('export bundle includes transparency notice and timestamp')
        : fail('export bundle missing notice or exportedAt');
    },
  },
  {
    id: 'AR-DSR-ERASURE',
    title: 'Right of erasure — erasable data is removed',
    category: 'data-subject-rights',
    appliesTo: ALL_PROFILES,
    rationale:
      'Ley 25.326 Art. 16 requires suppression within 5 business days — for data with no retention floor, deletion must actually remove it.',
    basis: [
      {
        law: 'Ley 25.326',
        article: 'Art. 16.2',
        url: 'https://www3.hcdn.gob.ar/dependencias/secparl/dgral_info_parlamentaria/dip/archivos/Ley_25326.pdf',
        confidence: 'verified',
        quote:
          '…proceder a la rectificación, supresión o actualización … en el plazo máximo de cinco días hábiles…',
      },
    ],
    check: async (probe) => {
      await probe.deleteData();
      const after = await probe.exportData();
      const remaining = Object.entries(after)
        .filter(([k]) => k !== 'exportedAt' && k !== 'notice')
        .filter(([k, v]) => Array.isArray(v) && v.length > 0)
        .filter(([k]) => probe.retentionFloorDays(probe.recordKindOf(k as never)) === 0)
        .map(([k, v]) => `${k}:${(v as unknown[]).length}`);
      return remaining.length === 0
        ? pass('all erasable data removed after deleteData()')
        : fail(`data remained after erasure: ${remaining.join(', ')}`);
    },
  },
  {
    id: 'AR-DELETE-ORDER',
    title: 'Erasure follows foreign-key-safe deletion order',
    category: 'data-subject-rights',
    appliesTo: ALL_PROFILES,
    rationale:
      'A complete erasure must not orphan rows — deletion must respect DELETION_ORDER (children before parents).',
    basis: [
      {
        law: 'Ley 25.326',
        article: 'Art. 16',
        url: 'https://www3.hcdn.gob.ar/dependencias/secparl/dgral_info_parlamentaria/dip/archivos/Ley_25326.pdf',
        confidence: 'verified',
      },
    ],
    check: (probe) => {
      const seq = probe.deletionSequence();
      const idx = seq.map((e) => DELETION_ORDER.indexOf(e));
      if (idx.some((v) => v < 0)) return fail('deletion sequence contains an unknown entity');
      const monotonic = idx.every((v, i) => i === 0 || v >= idx[i - 1]!);
      return monotonic
        ? pass(`deletion order respects DELETION_ORDER (${seq.length} entities)`)
        : fail('deletion sequence violates DELETION_ORDER — risks orphaned rows');
    },
  },
  {
    id: 'AR-AUDIT-COMPLETE',
    title: 'Privacy operations are audited',
    category: 'audit',
    appliesTo: ALL_PROFILES,
    rationale:
      'Ley 25.326 Art. 9 requires being able to detect deviations; every export/delete/consent change must emit an audit event.',
    basis: [
      {
        law: 'Ley 25.326',
        article: 'Art. 9',
        url: 'https://www3.hcdn.gob.ar/dependencias/secparl/dgral_info_parlamentaria/dip/archivos/Ley_25326.pdf',
        confidence: 'verified',
      },
    ],
    check: (probe) => {
      const actions = new Set(probe.auditLog().map((e) => e.action));
      const required = [
        'export_requested',
        'export_delivered',
        'deletion_requested',
        'deletion_completed',
        'consent_granted',
      ] as const;
      const missing = required.filter((a) => !actions.has(a));
      return missing.length === 0
        ? pass('all privacy-relevant actions are audited')
        : fail(`missing audit actions: ${missing.join(', ')}`);
    },
  },
  {
    id: 'AR-AUDIT-NO-PII',
    title: 'Audit log carries no direct identifiers',
    category: 'audit',
    appliesTo: ALL_PROFILES,
    rationale:
      'The audit trail must itself respect confidentiality (Arts. 9–10) — context must never contain PII.',
    basis: [
      {
        law: 'Ley 25.326',
        article: 'Arts. 9–10',
        url: 'https://www3.hcdn.gob.ar/dependencias/secparl/dgral_info_parlamentaria/dip/archivos/Ley_25326.pdf',
        confidence: 'verified',
      },
    ],
    check: (probe) => {
      const ids = probe.directIdentifiers().filter((v) => v.length > 0);
      for (const event of probe.auditLog()) {
        const blob = JSON.stringify(event.context ?? {});
        for (const id of ids) {
          if (blob.includes(id)) return fail(`audit context for "${event.action}" contains an identifier`);
        }
      }
      return pass('no identifier found in any audit context');
    },
  },
  {
    id: 'AR-RETENTION-FLOOR',
    title: 'Retention floors are enforced per record kind',
    category: 'retention',
    appliesTo: ALL_PROFILES,
    rationale:
      'Erasure (25.326 Art. 16) is gated by record-kind floors: ≥10 yr for clinical records (26.529 Art. 18), ≥3 yr for archived prescriptions (27.553). Logistics has no floor.',
    basis: [
      {
        law: 'Ley 26.529',
        article: 'Art. 18',
        url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/160000-164999/160432/texact.htm',
        confidence: 'verified',
        quote: 'Plazo mínimo de DIEZ (10) años … computo desde la última actuación registrada.',
      },
      {
        law: 'Ley 27.553',
        article: 'Art. 9 (mod. Ley 17.565)',
        url: 'https://www.argentina.gob.ar/normativa/nacional/ley-27553-340919/texto',
        confidence: 'verified',
        quote:
          'Deben conservarse las recetas … durante un plazo no menor de tres (3) años, después de dicho plazo pueden ser destruidas o borradas…',
      },
    ],
    check: (probe) => {
      const kinds = probe.recordKindsInUse();
      if (kinds.length === 0) return skip('no record kinds declared in use');
      const problems: string[] = [];
      for (const kind of kinds) {
        const expected = RETENTION_FLOOR_DAYS[kind];
        const actual = probe.retentionFloorDays(kind);
        if (actual < expected) problems.push(`${kind}: floor ${actual}d < required ${expected}d`);
        if (expected > 0 && !probe.erasureBlockedWithinFloor(kind)) {
          problems.push(`${kind}: erasure not blocked within retention floor`);
        }
      }
      return problems.length === 0
        ? pass(`retention floors enforced for: ${kinds.join(', ')}`)
        : fail(problems.join('; '));
    },
  },
  {
    id: 'AR-CONFIDENTIALITY-ACCESS',
    title: 'PHI read paths require an authenticated principal',
    category: 'confidentiality',
    appliesTo: ['external_sources', 'eprescription'],
    rationale:
      'Ley 26.529 / Ley 27.553 Art. 4 require access control and custody — no PHI read without an authorized principal.',
    basis: [
      {
        law: 'Ley 27.553',
        article: 'Art. 4',
        url: 'https://www.argentina.gob.ar/normativa/nacional/ley-27553-340919/actualizacion',
        confidence: 'verified',
        quote:
          '…establecer los criterios de autorización y control de acceso a dichas bases de datos…',
      },
      {
        law: 'Ley 26.529',
        article: 'Art. 18',
        url: 'https://www.mpba.gov.ar/files/documents/ley_26.529-2009._Ds._del_paciente,_H._Cl._y_Cons._inf..pdf',
        confidence: 'verified',
      },
    ],
    check: (probe) =>
      probe.rejectsUnauthenticatedRead()
        ? pass('unauthenticated PHI reads are rejected')
        : fail('PHI is readable without an authenticated principal'),
  },
  {
    id: 'AR-EPRESCRIPTION-RECEIPT',
    title: 'Prescription/dispensing events produce a retrievable receipt',
    category: 'audit',
    appliesTo: ['eprescription'],
    rationale:
      'Ley 27.553 Art. 13 requires trazabilidad and a constancia (verifiable receipt) issued to the patient.',
    basis: [
      {
        law: 'Ley 27.553',
        article: 'Art. 13',
        url: 'https://www.boletinoficial.gob.ar/detalleAviso/primera/233439/20200811',
        confidence: 'verified',
        quote: '…trazabilidad … constancia de teleasistencia, prescripción y dispensación.',
      },
    ],
    check: (probe) =>
      probe.prescriptionReceiptsRetrievable()
        ? pass('prescription/dispensing receipts are retrievable')
        : fail('no retrievable receipt for prescription/dispensing events'),
  },

  // --- Operator attestations (no automated check) ---
  {
    id: 'AR-CLINICAL-ACCESS-48H',
    title: 'Authenticated clinical-record copy within 48 hours',
    category: 'data-subject-rights',
    appliesTo: ['eprescription'],
    rationale:
      'If the app holds historia clínica, Ley 26.529 Art. 14 requires an authenticated copy within 48h of a simple request.',
    basis: [
      {
        law: 'Ley 26.529 / Decreto 1089/2012',
        article: 'Art. 14',
        url: 'https://www.argentina.gob.ar/normativa/nacional/decreto-1089-2012-199296/texto',
        confidence: 'verified',
        quote: '…copia autenticada … dentro del plazo de CUARENTA Y OCHO (48) horas.',
      },
    ],
  },
  {
    id: 'AR-CLINICAL-INTEGRITY',
    title: 'Electronic clinical records are tamper-evident',
    category: 'security',
    appliesTo: ['eprescription'],
    rationale:
      'Ley 26.529 Art. 13: integrity, authenticity, inalterability — restricted access with claves, non-rewritable media, field-change control (Decreto 1089/2012 Art. 13 cross-refers to Ley 25.506).',
    basis: [
      {
        law: 'Ley 26.529',
        article: 'Art. 13',
        url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/160000-164999/160432/texact.htm',
        confidence: 'verified',
      },
    ],
  },
  {
    id: 'AR-DIGITAL-SIGNATURE',
    title: 'Prescriptions carry a valid digital signature (Ley 25.506)',
    category: 'security',
    appliesTo: ['eprescription'],
    rationale: 'Ley 27.553 Art. 4 requires e-prescriptions to conform to digital-signature law 25.506.',
    basis: [
      {
        law: 'Ley 27.553',
        article: 'Art. 4',
        url: 'https://www.boletinoficial.gob.ar/detalleAviso/primera/233439/20200811',
        confidence: 'verified',
        quote: '…debe adecuarse a la ley 25.506, de firma digital.',
      },
    ],
  },
  {
    id: 'AR-PRIVACY-POLICY',
    title: 'Published, versioned privacy policy referenced by consent',
    category: 'consent',
    appliesTo: ALL_PROFILES,
    rationale:
      'Ley 25.326 Art. 6 requires prior notice; the ConsentRecord.policyVersion must reference a real, published policy.',
    basis: [
      {
        law: 'Ley 25.326',
        article: 'Art. 6',
        url: 'https://www3.hcdn.gob.ar/dependencias/secparl/dgral_info_parlamentaria/dip/archivos/Ley_25326.pdf',
        confidence: 'verified',
      },
    ],
  },
  {
    id: 'AR-AAIP-REGISTRATION',
    title: 'AAIP database-registration obligations assessed',
    category: 'security',
    appliesTo: ALL_PROFILES,
    rationale:
      'A hosted-app operator is responsable del tratamiento and must assess registration/security duties before the AAIP.',
    basis: [
      {
        law: 'Resolución AAIP 47/2018',
        article: 'Medidas de seguridad',
        url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/310000-314999/312662/norma.htm',
        confidence: 'verified',
      },
    ],
  },
];

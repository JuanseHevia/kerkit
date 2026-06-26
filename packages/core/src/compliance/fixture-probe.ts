import { redactEntityForLlm, sweepText } from '../privacy/redaction.js';
import { patientClassification, prescriptionClassification } from '../privacy/classifications.js';
import { DELETION_ORDER } from '../privacy/consent.js';
import type { ConsentRecord, ConsentScope, DeletableEntityName, ExportBundle } from '../privacy/consent.js';
import type { AuditEvent } from '../privacy/audit.js';
import {
  fixtureNote,
  fixturePatient,
  fixturePrescription,
  fixtureTaskBuyMeds,
  fixtureTaskLab,
} from '../fixtures/persona.js';
import { RETENTION_FLOOR_DAYS, type AppProfile, type ComplianceProbe, type RecordKind } from './types.js';

/** Reference es-AR identifier patterns (the real set ships in @kerkit/pack-argentina). */
const AR_PATTERNS = [/\b\d{1,2}\.\d{3}\.\d{3}\b/, /\bDNI:?\s*\d{7,8}\b/i];

const T0 = new Date('2026-01-05T12:00:00.000Z');

const DIRECT_IDENTIFIERS: string[] = [
  fixturePatient.name, // 'Marta Pérez'
  fixturePatient.nationalId, // '12.345.678'
  fixturePatient.credentialNumber, // 'DEMO-0001-00'
].filter((v): v is string => typeof v === 'string' && v.length > 0);

function makeConsent(scope: ConsentScope): ConsentRecord {
  return {
    id: '00000000-0000-4000-8000-0000000000c0',
    userId: fixturePatient.userId,
    scope,
    policyVersion: 'v1.0.0',
    grantedAt: T0,
    revokedAt: null,
  };
}

/** A redacted provider input built by actually running the redaction primitives. */
function redactedProviderInputs(): string[] {
  const { redacted, tokens } = redactEntityForLlm(
    fixturePatient as unknown as Record<string, unknown>,
    patientClassification,
  );
  const sweptNote = sweepText(fixtureNote.content, AR_PATTERNS, tokens).text;
  return [JSON.stringify(redacted), sweptNote, 'system: nunca reveles identificadores del paciente'];
}

function freshStore(): Partial<Record<DeletableEntityName, unknown[]>> {
  return {
    patients: [fixturePatient],
    notes: [fixtureNote],
    prescriptions: [fixturePrescription],
    tasks: [fixtureTaskLab, fixtureTaskBuyMeds],
  };
}

function seedAuditLog(): AuditEvent[] {
  const mk = (action: AuditEvent['action'], context?: Record<string, unknown>): AuditEvent => ({
    id: '00000000-0000-4000-8000-0000000000d0',
    actor: fixturePatient.userId,
    action,
    at: T0,
    context,
  });
  return [
    mk('consent_granted', { scope: 'llm_assistant', policyVersion: 'v1.0.0' }),
    mk('export_requested'),
    mk('export_delivered', { entities: ['patients', 'notes', 'prescriptions', 'tasks'] }),
    mk('deletion_requested'),
    mk('deletion_completed', { deleted: { patients: 1, notes: 1 } }),
  ];
}

interface FixtureOptions {
  profile?: AppProfile;
}

/**
 * A fully-compliant probe over the canonical synthetic persona. Running the
 * suite against it should report COMPLIANT. The redaction-sink input is built
 * by actually invoking `redactEntityForLlm` + `sweepText`, so this also
 * exercises the real primitives.
 */
export function createFixtureProbe(options: FixtureOptions = {}): ComplianceProbe {
  const profile = options.profile ?? 'llm_assistant';
  const store = freshStore();
  const audit = seedAuditLog();

  return {
    jurisdiction: 'AR',
    profile,
    healthFieldClasses: () => [
      patientClassification.diagnosis,
      patientClassification.treatmentPhase,
      prescriptionClassification.medicationName,
    ],
    consentFor: (scope) => makeConsent(scope),
    providerInvoked: () => true,
    directIdentifiers: () => [...DIRECT_IDENTIFIERS],
    capturedProviderInputs: redactedProviderInputs,
    exportData: async (): Promise<ExportBundle> => ({
      ...store,
      exportedAt: T0,
      notice: 'Exportación de todos tus datos almacenados. Podés solicitar su borrado en cualquier momento.',
    }),
    deleteData: async () => {
      const deleted: Partial<Record<DeletableEntityName, number>> = {};
      for (const entity of DELETION_ORDER) {
        const rows = store[entity];
        if (rows && rows.length > 0) {
          deleted[entity] = rows.length;
          store[entity] = [];
        }
      }
      return { deleted };
    },
    deletionSequence: () => DELETION_ORDER.filter((e) => e in store),
    recordKindOf: () => 'logistics',
    auditLog: () => audit,
    recordKindsInUse: () => ['logistics'],
    retentionFloorDays: (kind: RecordKind) => RETENTION_FLOOR_DAYS[kind],
    erasureBlockedWithinFloor: (kind: RecordKind) => kind !== 'logistics',
    rejectsUnauthenticatedRead: () => true,
    prescriptionReceiptsRetrievable: () => true,
  };
}

/**
 * A deliberately-broken probe — used to prove the checks actually FAIL when an
 * app is non-compliant (testing the tests). Each override below maps to a
 * specific control that must turn red.
 */
export function createLeakyProbe(options: FixtureOptions = {}): ComplianceProbe {
  const base = createFixtureProbe(options);
  const store = freshStore();

  return {
    ...base,
    // AR-REDACT-SINK: raw identifiers reach the provider.
    capturedProviderInputs: () => [
      `Recordá que la paciente es ${fixturePatient.name}, DNI ${fixturePatient.nationalId}.`,
    ],
    // AR-LLM-CONSENT-GATE + AR-CONSENT-SENSITIVE: no consent on record.
    consentFor: () => undefined,
    // AR-AUDIT-NO-PII (context leaks a DNI) + AR-AUDIT-COMPLETE (missing deletion_completed).
    auditLog: () => [
      {
        id: '00000000-0000-4000-8000-0000000000d1',
        actor: fixturePatient.userId,
        action: 'export_delivered',
        at: T0,
        context: { note: `paciente ${fixturePatient.nationalId}` },
      },
      {
        id: '00000000-0000-4000-8000-0000000000d2',
        actor: fixturePatient.userId,
        action: 'consent_granted',
        at: T0,
      },
    ],
    // AR-DSR-ERASURE: deletion is a no-op, data remains.
    deleteData: async () => ({ deleted: {} }),
    exportData: async (): Promise<ExportBundle> => ({
      ...store,
      exportedAt: T0,
      notice: 'parcial',
    }),
    // AR-DELETE-ORDER: parents before children.
    deletionSequence: () => ['users', 'patients', 'notes'],
  };
}

export {
  extendClassification,
  type DataClass,
  type Classification,
} from './classification.js';

export {
  patientClassification,
  appointmentClassification,
  prescriptionClassification,
  noteClassification,
  authorizationClassification,
  checkpointClassification,
  institutionClassification,
  personClassification,
  signalClassification,
  userClassification,
} from './classifications.js';

export {
  redactEntityForLlm,
  sweepText,
  SWEEP_PLACEHOLDER,
  type RedactEntityOptions,
  type RedactionResult,
  type SweepResult,
} from './redaction.js';

export {
  consentScopeEnum,
  consentRecordSchema,
  isConsentActive,
  DELETION_ORDER,
  type ConsentScope,
  type ConsentRecord,
  type DeletableEntityName,
  type ExportBundle,
} from './consent.js';

export {
  auditActionEnum,
  auditEventSchema,
  type AuditAction,
  type AuditEvent,
  type NewAuditEvent,
} from './audit.js';

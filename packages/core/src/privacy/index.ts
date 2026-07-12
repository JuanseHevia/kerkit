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
  taskClassification,
  checklistClassification,
  institutionClassification,
  personClassification,
  signalClassification,
  userClassification,
} from './classifications.js';

export {
  redactEntityForLlm,
  sweepText,
  tokenBaseName,
  SWEEP_PLACEHOLDER,
  type RedactEntityOptions,
  type RedactionResult,
  type SweepResult,
} from './redaction.js';

export {
  RegexPiiDetector,
  coercePiiPatterns,
  detectPiiSpans,
  normalizeForPii,
  replacePiiSpans,
  resolvePiiSpans,
  type NormalizedText,
  type PiiConfidence,
  type PiiCorpusCase,
  type PiiDetector,
  type PiiPattern,
  type PiiSpan,
  type PiiType,
} from './detector.js';

export {
  RedactionSession,
  DEFAULT_REDACTION_POLICY,
  type RedactionPolicy,
  type RedactionSessionOptions,
  type RedactionFinding,
  type RedactionExplain,
} from './session.js';

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

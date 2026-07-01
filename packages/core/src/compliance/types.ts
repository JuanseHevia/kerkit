import type { ConsentRecord, ConsentScope, DeletableEntityName, ExportBundle } from '../privacy/consent.js';
import type { AuditEvent } from '../privacy/audit.js';
import type { DataClass } from '../privacy/classification.js';

/** Supported compliance jurisdictions. Argentina ships first. */
export type Jurisdiction = 'AR';

/**
 * What an app built on kerkit *does* — this gates which obligations apply.
 * Profiles are roughly cumulative (an `llm_assistant` app is also `logistics`);
 * `eprescription` is the one that statutorily pulls in the clinical-record
 * regime (Ley 26.529) via Ley 27.553.
 */
export type AppProfile = 'logistics' | 'llm_assistant' | 'external_sources' | 'eprescription';

export const ALL_PROFILES: readonly AppProfile[] = [
  'logistics',
  'llm_assistant',
  'external_sources',
  'eprescription',
];

/** Categories of compliance obligation. */
export type ControlCategory =
  | 'classification'
  | 'consent'
  | 'data-subject-rights'
  | 'minimization'
  | 'security'
  | 'audit'
  | 'retention'
  | 'confidentiality';

/**
 * The kind of record being retained — retention floors differ by kind, which is
 * how the framework resolves the erasure-vs-retention tension (see
 * docs/compliance/argentina-standards.md §5).
 */
export type RecordKind = 'logistics' | 'clinical_record' | 'eprescription';

/** Statutory minimum retention, in days, by record kind. */
export const RETENTION_FLOOR_DAYS: Record<RecordKind, number> = {
  /** Caretaker logistics carry no statutory floor — erasure must be honored. */
  logistics: 0,
  /** Historia clínica: ≥ 10 years from last entry (Ley 26.529 Art. 18). */
  clinical_record: 3650,
  /** Archived prescriptions: ≥ 3 years (Ley 27.553). */
  eprescription: 1095,
};

/** How sure we are an obligation is real and cited — never overstate. */
export type Confidence = 'verified' | 'partial' | 'sourced';

/** A citation to a specific legal source, with the confidence it was verified at. */
export interface LegalBasis {
  law: string;
  article: string;
  url: string;
  confidence: Confidence;
  quote?: string;
}

/** Outcome of running a single control's check. */
export interface ControlOutcome {
  status: 'pass' | 'fail' | 'skip';
  evidence: string;
}

export type CheckFn = (probe: ComplianceProbe) => ControlOutcome | Promise<ControlOutcome>;

/**
 * One obligation, made executable. `check` present → the harness decides it
 * automatically. `check` absent → it's an operator attestation (reported, never
 * silently passed).
 */
export interface ComplianceControl {
  id: string;
  title: string;
  category: ControlCategory;
  basis: LegalBasis[];
  appliesTo: readonly AppProfile[];
  rationale: string;
  check?: CheckFn;
}

/**
 * The adapter an SDK consumer implements against their wired app. kerkit ships
 * `createFixtureProbe()` so the suite runs green on synthetic data, and
 * `createLeakyProbe()` to prove the checks fail when they should.
 */
export interface ComplianceProbe {
  jurisdiction: Jurisdiction;
  profile: AppProfile;

  // --- classification (AR-CLASS-HEALTH-SENSITIVE) ---
  /** The data classes kerkit assigns to the app's known health fields. */
  healthFieldClasses(): DataClass[];

  // --- consent (AR-CONSENT-SENSITIVE, AR-LLM-CONSENT-GATE) ---
  consentFor(scope: ConsentScope): ConsentRecord | undefined;
  /** Was the LLM provider invoked at all this session? */
  providerInvoked(): boolean;

  // --- redaction sink (AR-REDACT-SINK) + audit hygiene (AR-AUDIT-NO-PII) ---
  /** Direct-identifier values that must never appear downstream. */
  directIdentifiers(): string[];
  /** Everything that actually reached `provider.generate()`. */
  capturedProviderInputs(): string[];

  // --- data-subject rights (AR-DSR-*) ---
  exportData(): Promise<ExportBundle>;
  deleteData(): Promise<{ deleted: Partial<Record<DeletableEntityName, number>> }>;
  /** The order in which the app deletes entities (must respect DELETION_ORDER). */
  deletionSequence(): DeletableEntityName[];
  /** Map an entity to its retention record-kind (defaults to logistics). */
  recordKindOf(entity: DeletableEntityName): RecordKind;

  // --- audit (AR-AUDIT-*) ---
  auditLog(): AuditEvent[];

  // --- retention (AR-RETENTION-FLOOR) ---
  recordKindsInUse(): RecordKind[];
  retentionFloorDays(kind: RecordKind): number;
  erasureBlockedWithinFloor(kind: RecordKind): boolean;

  // --- access control (AR-CONFIDENTIALITY-ACCESS) ---
  rejectsUnauthenticatedRead(): boolean;

  // --- e-prescription (AR-EPRESCRIPTION-RECEIPT) ---
  prescriptionReceiptsRetrievable(): boolean;

  // --- optional: de-identification oracle (AR-DEIDENT-EXPORT) ---
  /** A de-identified analytics/training export, if the app produces one. */
  analyticsExport?(): string[];
}

export type ResultStatus = 'pass' | 'fail' | 'skip' | 'attest';

export interface ControlResult {
  id: string;
  title: string;
  category: ControlCategory;
  kind: 'check' | 'attest';
  appliesTo: readonly AppProfile[];
  status: ResultStatus;
  evidence: string;
  basis: LegalBasis[];
}

export interface ComplianceReport {
  jurisdiction: Jurisdiction;
  profile: AppProfile;
  results: ControlResult[];
  /** True iff no applicable `check` control failed. Attestations don't gate. */
  compliant: boolean;
  attestationsRequired: ControlResult[];
  format(fmt: 'markdown' | 'text'): string;
}

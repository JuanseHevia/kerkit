export type PrescriptionSource = 'email' | 'document_store' | 'manual';
export type PrescriptionStatus = 'active' | 'expiring' | 'expired' | 'renewed';

/**
 * A prescription as a *document with an expiry date* — the thing a caretaker
 * tracks so refills and authorizations don't lapse. Never dosing logic.
 */
export interface PrescriptionBase {
  id: string;
  userId: string;
  medicationName: string;
  /** Prescribing professional's name as written on the document. */
  prescriberName?: string;
  institutionId?: string;
  dateIssued: Date;
  dateExpires: Date;
  source: PrescriptionSource;
  sourceUrl?: string;
  filePath?: string;
  treatmentPhase?: string;
  status: PrescriptionStatus;
  expiryAlertSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type Prescription<TExt = Record<never, never>> = PrescriptionBase & TExt;

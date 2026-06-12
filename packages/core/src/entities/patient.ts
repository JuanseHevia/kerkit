/**
 * A patient as seen by their caretaker: identity needed for paperwork plus
 * the minimum treatment context needed for logistics. This is NOT a clinical
 * record — see NOTICE.
 */
export interface PatientBase {
  id: string;
  userId: string;
  name: string;
  /** National identity document (DNI in Argentina). Classified direct-identifier. */
  nationalId: string;
  /** Health insurer (obra social in Argentina). References an Institution of type 'insurer'. */
  insurerId: string;
  credentialNumber?: string;
  diagnosis?: string;
  treatmentPhase?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Patient<TExt = Record<never, never>> = PatientBase & TExt;

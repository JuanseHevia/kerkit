export type InstitutionType = 'hospital' | 'clinic' | 'lab' | 'imaging_center' | 'insurer';

/** A healthcare org the caretaker deals with: clinics, labs, and the insurer (obra social). */
export interface InstitutionBase {
  id: string;
  name: string;
  type: InstitutionType;
  address?: string;
  phone?: string;
  email?: string;
  createdAt: Date;
}

export type Institution<TExt = Record<never, never>> = InstitutionBase & TExt;

export interface InstitutionContact {
  id: string;
  institutionId: string;
  department?: string;
  phone?: string;
  email?: string;
  notes?: string;
  sortOrder: number;
  createdAt: Date;
}

/** A step in an institution's escalation SOP ("if the authorization stalls, call X, then Y"). */
export interface EscalationSopStep {
  id: string;
  institutionId: string;
  authorizationType: string;
  stepNumber: number;
  description: string;
  contactId?: string;
  fallbackText?: string;
  contact?: InstitutionContact;
  createdAt: Date;
}

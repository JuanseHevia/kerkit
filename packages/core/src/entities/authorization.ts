export type AuthorizationType = 'medication_supply' | 'procedure' | 'imaging';

/**
 * Lifecycle of an insurance authorization (trámite):
 * needed → requested → pending → confirmed, with escalation reachable from
 * any active state. The valid transition graph lives in domain/state-machine.
 */
export type AuthorizationStatus = 'needed' | 'requested' | 'pending' | 'confirmed' | 'escalation';

export interface AuthorizationBase {
  id: string;
  userId: string;
  type: AuthorizationType;
  description: string;
  /** The insurer (obra social) this authorization is requested from. */
  insurerId: string;
  status: AuthorizationStatus;
  linkedAppointmentId?: string;
  linkedPrescriptionId?: string;
  linkedCheckpointId?: string;
  requestedDate?: Date;
  expectedResolutionDate?: Date;
  confirmedDate?: Date;
  deadline: Date;
  escalationTriggered: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Authorization<TExt = Record<never, never>> = AuthorizationBase & TExt;

export type TimelineEntryType = 'status_change' | 'signal' | 'manual_note' | 'escalation_trigger';

/** Immutable audit trail of an authorization's lifecycle. */
export interface AuthorizationTimelineEntry {
  id: string;
  authorizationId: string;
  entryType: TimelineEntryType;
  description: string;
  fromStatus?: AuthorizationStatus;
  toStatus?: AuthorizationStatus;
  timestamp: Date;
}

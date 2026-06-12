/**
 * A doctor-visit milestone: bundles what happened at a key appointment
 * (prescriptions issued, notes taken, a summary) so the caretaker can answer
 * "where are we in the treatment?" without re-reading everything.
 */
export interface CheckpointBase {
  id: string;
  userId: string;
  number: number;
  title: string;
  treatmentPhase: string;
  date: Date;
  /** Name of the professional seen, as the caretaker recorded it. */
  personName: string;
  institutionId: string;
  linkedAppointmentId: string;
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Checkpoint<TExt = Record<never, never>> = CheckpointBase & TExt;

/**
 * Treatment chores. The everyday caretaker work that is neither an
 * appointment nor an authorization: buy medication, request a walker, pick up
 * a prescription, coordinate a discharge, follow up on a result. Tasks group
 * into checklists (weekly routines, pre-appointment prep, discharge plans) and
 * can depend on one another ("lab before consult").
 */

export type TaskKind =
  /** General logistics chore (buy meds, request equipment, make a call). */
  | 'chore'
  /** Preparation for an upcoming care-event (bring labs, fast, paperwork). */
  | 'prep'
  /** Administrative/insurer paperwork not tracked as a formal authorization. */
  | 'admin'
  /** Day-to-day medication management (pick up, refill, administer). */
  | 'medication'
  /** A follow-up triggered by a result, a note, or a previous task. */
  | 'followup';

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';

export interface TaskBase {
  id: string;
  userId: string;
  title: string;
  description?: string;
  kind: TaskKind;
  status: TaskStatus;
  dueDate?: Date;
  /** iCal-style recurrence source; shares the Appointment recurrence convention. */
  recurrencePattern?: string;
  /** Free-text owner for delegation across a caretaking team. */
  assignee?: string;
  /** The checklist this task belongs to, if any (enables roll-up progress). */
  checklistId?: string;
  /** Ordering within a checklist. */
  sortOrder?: number;
  /** Task ids that must be `done` before this one can complete ("lab before consult"). */
  dependsOn?: string[];
  linkedAppointmentId?: string;
  linkedAuthorizationId?: string;
  linkedPrescriptionId?: string;
  /** The note (e.g. post-appointment feedback) this task was generated from. */
  sourceNoteId?: string;
  source?: string | null;
  sourceExternalId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type Task<TExt = Record<never, never>> = TaskBase & TExt;

export type ChecklistKind =
  /** Hand-authored grouping. */
  | 'manual'
  /** Questions/prep to bring to a specific appointment. */
  | 'pre_appointment'
  /** Recurring weekly caretaker routine. */
  | 'weekly'
  /** Hospital-discharge / start-of-home-care plan. */
  | 'discharge'
  /** Chores tied to entering a treatment phase. */
  | 'treatment_phase';

export interface ChecklistBase {
  id: string;
  userId: string;
  title: string;
  kind: ChecklistKind;
  /** Optional locale-pack template id this checklist was generated from. */
  templateId?: string;
  /** Set when the checklist is the prep for a specific appointment. */
  linkedAppointmentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Checklist<TExt = Record<never, never>> = ChecklistBase & TExt;

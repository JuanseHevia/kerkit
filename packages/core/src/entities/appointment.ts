import type { CareEventKindId } from '../domain/care-events.js';

export type AppointmentStatus = 'upcoming' | 'completed' | 'cancelled' | 'rescheduled';

export interface AppointmentBase {
  id: string;
  userId: string;
  title: string;
  /** Care-event kind. Default kinds live in CARE_EVENT_KINDS; consumers may add their own ids. */
  type: CareEventKindId;
  date: Date;
  institutionId: string;
  personId?: string;
  locationDetail?: string;
  notes?: string;
  source?: string | null;
  sourceExternalId?: string | null;
  status: AppointmentStatus;
  recurrencePattern?: string;
  reminderSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type Appointment<TExt = Record<never, never>> = AppointmentBase & TExt;

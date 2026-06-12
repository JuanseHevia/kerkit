import { z } from 'zod';
import { CARE_EVENT_KINDS } from '../domain/care-events.js';

/** Default care-event kinds as a Zod enum, for apps that don't add custom kinds. */
export const careEventKindEnum = z.enum(
  Object.keys(CARE_EVENT_KINDS) as [string, ...string[]],
);

export const appointmentStatusEnum = z.enum(['upcoming', 'completed', 'cancelled', 'rescheduled']);

export const createAppointmentSchema = z.object({
  title: z.string().min(1).max(200),
  /** Open string to allow consumer-registered kinds; validate against careEventKindEnum if you only use defaults. */
  type: z.string().min(1).max(50),
  date: z.coerce.date(),
  institutionId: z.string().uuid(),
  personId: z.string().uuid().optional(),
  locationDetail: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  source: z.string().max(100).optional(),
  sourceExternalId: z.string().max(500).optional(),
  recurrencePattern: z.string().max(100).optional(),
});

export const updateAppointmentSchema = createAppointmentSchema.partial().extend({
  status: appointmentStatusEnum.optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

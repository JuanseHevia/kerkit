import { z } from 'zod';

export const createCheckpointSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1).max(200),
  treatmentPhase: z.string().min(1).max(100),
  date: z.coerce.date(),
  personName: z.string().min(1).max(200),
  institutionId: z.string().uuid(),
  linkedAppointmentId: z.string().uuid(),
  summary: z.string().max(5000).optional(),
});

export const updateCheckpointSchema = createCheckpointSchema.partial();

export type CreateCheckpointInput = z.infer<typeof createCheckpointSchema>;
export type UpdateCheckpointInput = z.infer<typeof updateCheckpointSchema>;

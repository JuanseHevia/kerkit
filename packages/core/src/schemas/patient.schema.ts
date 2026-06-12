import { z } from 'zod';

export const createPatientSchema = z.object({
  name: z.string().min(1).max(200),
  nationalId: z.string().min(1).max(20),
  insurerId: z.string().uuid(),
  credentialNumber: z.string().max(50).optional(),
  diagnosis: z.string().max(500).optional(),
  treatmentPhase: z.string().max(100).optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

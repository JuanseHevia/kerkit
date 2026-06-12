import { z } from 'zod';

export const prescriptionSourceEnum = z.enum(['email', 'document_store', 'manual']);
export const prescriptionStatusEnum = z.enum(['active', 'expiring', 'expired', 'renewed']);

export const createPrescriptionSchema = z.object({
  medicationName: z.string().min(1).max(200),
  prescriberName: z.string().max(200).optional(),
  institutionId: z.string().uuid().optional(),
  dateIssued: z.coerce.date(),
  dateExpires: z.coerce.date(),
  source: prescriptionSourceEnum,
  sourceUrl: z.string().url().optional(),
  filePath: z.string().max(500).optional(),
  treatmentPhase: z.string().max(100).optional(),
});

export const updatePrescriptionSchema = createPrescriptionSchema.partial().extend({
  status: prescriptionStatusEnum.optional(),
  expiryAlertSent: z.boolean().optional(),
});

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export type UpdatePrescriptionInput = z.infer<typeof updatePrescriptionSchema>;

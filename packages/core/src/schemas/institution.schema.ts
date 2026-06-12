import { z } from 'zod';

export const institutionTypeEnum = z.enum(['hospital', 'clinic', 'lab', 'imaging_center', 'insurer']);

export const createInstitutionSchema = z.object({
  name: z.string().min(1).max(200),
  type: institutionTypeEnum,
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
});

export const updateInstitutionSchema = createInstitutionSchema.partial();

export const createInstitutionContactSchema = z.object({
  institutionId: z.string().uuid(),
  department: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  notes: z.string().max(500).optional(),
  sortOrder: z.number().int().default(0),
});

export const createEscalationSopStepSchema = z.object({
  institutionId: z.string().uuid(),
  authorizationType: z.enum(['medication_supply', 'procedure', 'imaging']),
  stepNumber: z.number().int().positive(),
  description: z.string().min(1).max(500),
  contactId: z.string().uuid().optional(),
  fallbackText: z.string().max(500).optional(),
});

export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>;
export type UpdateInstitutionInput = z.infer<typeof updateInstitutionSchema>;
export type CreateInstitutionContactInput = z.infer<typeof createInstitutionContactSchema>;
export type CreateEscalationSopStepInput = z.infer<typeof createEscalationSopStepSchema>;

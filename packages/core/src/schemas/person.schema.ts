import { z } from 'zod';

export const personRoleEnum = z.enum(['doctor', 'nurse', 'administrative', 'other']);

export const createPersonSchema = z.object({
  name: z.string().min(1).max(200),
  role: personRoleEnum.default('doctor'),
  specialty: z.string().max(200).optional(),
  institutionId: z.string().uuid().optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
});

export const updatePersonSchema = createPersonSchema.partial();

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

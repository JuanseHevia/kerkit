import { z } from 'zod';

export const authorizationTypeEnum = z.enum(['medication_supply', 'procedure', 'imaging']);
export const authorizationStatusEnum = z.enum([
  'needed',
  'requested',
  'pending',
  'confirmed',
  'escalation',
]);

export const createAuthorizationSchema = z.object({
  type: authorizationTypeEnum,
  description: z.string().min(1).max(500),
  insurerId: z.string().uuid(),
  linkedAppointmentId: z.string().uuid().optional(),
  linkedPrescriptionId: z.string().uuid().optional(),
  linkedCheckpointId: z.string().uuid().optional(),
  requestedDate: z.coerce.date().optional(),
  expectedResolutionDate: z.coerce.date().optional(),
  deadline: z.coerce.date(),
  notes: z.string().max(2000).optional(),
});

export const updateAuthorizationSchema = createAuthorizationSchema.partial().extend({
  status: authorizationStatusEnum.optional(),
  confirmedDate: z.coerce.date().optional(),
  escalationTriggered: z.boolean().optional(),
});

export const authorizationTransitionSchema = z.object({
  toStatus: authorizationStatusEnum,
  note: z.string().max(500).optional(),
});

export type CreateAuthorizationInput = z.infer<typeof createAuthorizationSchema>;
export type UpdateAuthorizationInput = z.infer<typeof updateAuthorizationSchema>;
export type AuthorizationTransitionInput = z.infer<typeof authorizationTransitionSchema>;

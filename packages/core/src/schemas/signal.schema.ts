import { z } from 'zod';

export const signalTypeEnum = z.enum([
  'auth_preparing',
  'auth_approved',
  'med_ready_for_pickup',
  'med_delivery_confirmed',
  'auth_docs_needed',
  'auth_not_required',
  'auth_pdf_received',
  'med_shortage',
  'report_available',
  'lab_results_available',
  'prescription_detected',
  'appointment_reminder',
  'unknown',
]);

export const createSignalSchema = z.object({
  channel: z.string().min(1).max(50).default('email'),
  externalId: z.string().min(1),
  signalType: signalTypeEnum,
  subject: z.string().min(1).max(500),
  sender: z.string().min(1).max(200),
  detectedAt: z.coerce.date(),
  suggestedAction: z.string().max(500).optional(),
  linkedAuthorizationId: z.string().uuid().optional(),
  institutionId: z.string().uuid().optional(),
});

export const updateSignalSchema = z.object({
  acknowledged: z.boolean().optional(),
  linkedAuthorizationId: z.string().uuid().optional(),
});

export type CreateSignalInput = z.infer<typeof createSignalSchema>;
export type UpdateSignalInput = z.infer<typeof updateSignalSchema>;

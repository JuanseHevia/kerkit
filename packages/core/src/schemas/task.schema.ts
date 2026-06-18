import { z } from 'zod';

export const taskKindEnum = z.enum(['chore', 'prep', 'admin', 'medication', 'followup']);
export const taskStatusEnum = z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']);
export const checklistKindEnum = z.enum([
  'manual',
  'pre_appointment',
  'weekly',
  'discharge',
  'treatment_phase',
]);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  kind: taskKindEnum.default('chore'),
  dueDate: z.coerce.date().optional(),
  recurrencePattern: z.string().max(100).optional(),
  assignee: z.string().max(200).optional(),
  checklistId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).optional(),
  dependsOn: z.array(z.string().uuid()).max(50).optional(),
  linkedAppointmentId: z.string().uuid().optional(),
  linkedAuthorizationId: z.string().uuid().optional(),
  linkedPrescriptionId: z.string().uuid().optional(),
  sourceNoteId: z.string().uuid().optional(),
  source: z.string().max(100).optional(),
  sourceExternalId: z.string().max(500).optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: taskStatusEnum.optional(),
});

export const createChecklistSchema = z.object({
  title: z.string().min(1).max(200),
  kind: checklistKindEnum.default('manual'),
  templateId: z.string().max(100).optional(),
  linkedAppointmentId: z.string().uuid().optional(),
});

export const updateChecklistSchema = createChecklistSchema.partial();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;

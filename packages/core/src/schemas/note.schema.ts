import { z } from 'zod';

export const noteInputTypeEnum = z.enum(['text', 'voice']);

export const createNoteSchema = z.object({
  title: z.string().max(200).nullish(),
  content: z.string().min(1).max(10000),
  inputType: noteInputTypeEnum,
  category: z.string().max(100).nullish(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  isPinned: z.boolean().default(false),
  audioUrl: z.string().url().optional(),
  linkedAppointmentId: z.string().uuid().nullish(),
  linkedPrescriptionId: z.string().uuid().nullish(),
  source: z.string().max(100).optional(),
  sourceExternalId: z.string().max(500).optional(),
});

export const updateNoteSchema = createNoteSchema.partial();

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

import { z } from 'zod';

export const messageRoleEnum = z.enum(['user', 'assistant', 'system']);

export const conversationMessageSchema = z.object({
  role: messageRoleEnum,
  content: z.string().min(1).max(50000),
  timestamp: z.coerce.date(),
});

export const contextSnapshotSchema = z.object({
  recentAppointments: z.array(z.string()),
  activePrescriptions: z.array(z.string()),
  recentNotes: z.array(z.string()),
  pinnedNotes: z.array(z.string()),
  activeAuthorizations: z.array(z.string()),
  recentCheckpoints: z.array(z.string()),
});

export const createConversationSchema = z.object({
  messages: z.array(conversationMessageSchema).min(1),
  contextSnapshot: contextSnapshotSchema,
});

export const appendMessageSchema = z.object({
  message: conversationMessageSchema,
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type AppendMessageInput = z.infer<typeof appendMessageSchema>;

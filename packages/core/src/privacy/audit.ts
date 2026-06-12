import { z } from 'zod';

export const auditActionEnum = z.enum([
  'export_requested',
  'export_delivered',
  'deletion_requested',
  'deletion_completed',
  'consent_granted',
  'consent_revoked',
  'llm_context_sent',
]);
export type AuditAction = z.infer<typeof auditActionEnum>;

/**
 * Minimal audit event for privacy-relevant operations. Retention is the
 * consumer's policy; kerkit only guarantees the events get written.
 */
export const auditEventSchema = z.object({
  id: z.string().uuid(),
  /** Who performed the action (usually the userId; 'system' for cron jobs). */
  actor: z.string().min(1).max(200),
  action: auditActionEnum,
  entityType: z.string().max(100).optional(),
  entityId: z.string().max(100).optional(),
  at: z.coerce.date(),
  /** Free-form context: counts, scope, policy version. Never put PII here. */
  context: z.record(z.string(), z.unknown()).optional(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export type NewAuditEvent = Omit<AuditEvent, 'id' | 'at'> & { at?: Date };

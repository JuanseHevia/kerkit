import { z } from 'zod';

/**
 * What the user consented to. Scopes are deliberately coarse — they map to
 * the promises an app makes in plain language, not to API permissions.
 */
export const consentScopeEnum = z.enum([
  /** Store caretaker-authored data (the app's basic function). */
  'store_logistics',
  /** Send redacted context to an LLM provider to power the assistant. */
  'llm_assistant',
  /** Read external sources (email, calendar, files) to detect signals. */
  'external_sources',
]);
export type ConsentScope = z.infer<typeof consentScopeEnum>;

export const consentRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  scope: consentScopeEnum,
  /** Version identifier of the policy text the user saw when granting. */
  policyVersion: z.string().min(1).max(50),
  grantedAt: z.coerce.date(),
  revokedAt: z.coerce.date().nullish(),
});
export type ConsentRecord = z.infer<typeof consentRecordSchema>;

export function isConsentActive(record: ConsentRecord, now: Date = new Date()): boolean {
  if (record.grantedAt > now) return false;
  return record.revokedAt == null || record.revokedAt > now;
}

/**
 * Entity names in an export bundle / deletion manifest, ordered so deletion
 * respects foreign-key direction (children before parents).
 */
export const DELETION_ORDER = [
  'signals',
  'authorizationTimelineEntries',
  'authorizations',
  'checkpoints',
  'notes',
  'prescriptions',
  'appointments',
  'conversations',
  'consents',
  'patients',
  'users',
] as const;
export type DeletableEntityName = (typeof DELETION_ORDER)[number];

/** Everything a user stored, keyed by entity name. The shape of a data-export response. */
export type ExportBundle = Partial<Record<DeletableEntityName, unknown[]>> & {
  exportedAt: Date;
  /** Human-readable transparency note included with every export. */
  notice: string;
};

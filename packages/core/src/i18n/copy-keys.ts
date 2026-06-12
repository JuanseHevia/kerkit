/**
 * The copy-key registry: every user-facing string kerkit components or
 * prompts emit is referenced by key and resolved through the active locale
 * pack. Core ships no display strings — es-AR lives in @kerkit/pack-argentina.
 */
export const COPY_KEYS = [
  // Appointment statuses
  'status.appointment.upcoming',
  'status.appointment.completed',
  'status.appointment.cancelled',
  'status.appointment.rescheduled',
  // Authorization statuses
  'status.authorization.needed',
  'status.authorization.requested',
  'status.authorization.pending',
  'status.authorization.confirmed',
  'status.authorization.escalation',
  // Authorization compact display labels (badges)
  'status.authorization.badge.needed',
  'status.authorization.badge.requested',
  'status.authorization.badge.pending',
  'status.authorization.badge.confirmed',
  'status.authorization.badge.escalation',
  // Prescription statuses
  'status.prescription.active',
  'status.prescription.expiring',
  'status.prescription.expired',
  'status.prescription.renewed',
  // Care-event kinds
  'careEvent.chemo',
  'careEvent.imaging',
  'careEvent.consultation',
  'careEvent.procedure',
  'careEvent.lab',
  'careEvent.ambulatory_medication',
  'careEvent.other',
  // Assistant prompt blocks (resolved into system prompts by @kerkit/ai)
  'prompt.privacy.neverAskIdentifiers',
  'prompt.privacy.dontEchoSensitive',
  'prompt.privacy.transparency',
  'prompt.boundaries.notMedicalAdvice',
  'prompt.tone.description',
] as const;

export type CopyKey = (typeof COPY_KEYS)[number];

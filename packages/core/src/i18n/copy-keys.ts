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
  // Task statuses
  'status.task.todo',
  'status.task.in_progress',
  'status.task.blocked',
  'status.task.done',
  'status.task.cancelled',
  // Task kinds
  'taskKind.chore',
  'taskKind.prep',
  'taskKind.admin',
  'taskKind.medication',
  'taskKind.followup',
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
  // Context-window section headings (used by @kerkit/ai's ContextAssembler)
  'context.section.appointments',
  'context.section.prescriptions',
  'context.section.authorizations',
  'context.section.notes',
  'context.section.checkpoints',
  'context.section.signals',
  'context.section.tasks',
  // Assistant fallback lines
  'assistant.fallback.empty',
  'assistant.fallback.toolRoundsExhausted',
] as const;

export type CopyKey = (typeof COPY_KEYS)[number];

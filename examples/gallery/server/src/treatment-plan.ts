import type { TreatmentPlan } from '@kerkit/core';

/**
 * A synthetic, descriptive treatment plan for the demo persona ("Etapa II").
 * Orientation only — not a clinical schedule, no dosing, no protocol logic.
 * Six cycles, one session each, roughly every 21 days. The caretaker has
 * completed two cycles; the next session (cycle 3) lines up with the synthetic
 * chemo appointment date. All values are plain integers and copy — no PII.
 */
export const demoTreatmentPlan: TreatmentPlan = {
  protocolLabel: 'Etapa II',
  cycles: Array.from({ length: 6 }, (_, i) => ({
    index: i + 1,
    sessions: 1,
    intervalDays: 21,
  })),
};

export const demoCompletedSessions = 2;

/** When the last completed session happened; +21 days ≈ the chemo appointment. */
export const demoLastSessionDate = new Date('2026-01-20T11:00:00.000Z');

/**
 * Descriptive treatment structure, as the caretaker understands it:
 * "Etapa II is 6 cycles, one session every 21 days". Used for orientation
 * ("where are we?") and expectation ("when is the next one, roughly?").
 *
 * Deliberately NOT prescriptive: no dosing, no protocol logic, no clinical
 * decisions. The plan is whatever the care team said, written down.
 */
export interface TreatmentCycle {
  /** 1-based cycle number as the care team names it. */
  index: number;
  /** Sessions in this cycle. */
  sessions: number;
  /** Days between sessions within the cycle. */
  intervalDays: number;
}

export interface TreatmentPlan {
  /** The label the care team uses ("Etapa II", "FOLFOX adyuvante"…). */
  protocolLabel: string;
  cycles: TreatmentCycle[];
}

export interface CycleProgress {
  /** Cycle containing the next session, or null when the plan is complete. */
  cycle: TreatmentCycle | null;
  /** 1-based session number within that cycle for the next session. */
  sessionInCycle: number;
  completedSessions: number;
  totalSessions: number;
  /** completedSessions / totalSessions, 0..1. */
  fraction: number;
}

export function totalSessions(plan: TreatmentPlan): number {
  return plan.cycles.reduce((sum, c) => sum + c.sessions, 0);
}

export function cycleProgress(plan: TreatmentPlan, completedSessions: number): CycleProgress {
  const total = totalSessions(plan);
  const done = Math.max(0, Math.min(completedSessions, total));

  let remaining = done;
  for (const cycle of plan.cycles) {
    if (remaining < cycle.sessions) {
      return {
        cycle,
        sessionInCycle: remaining + 1,
        completedSessions: done,
        totalSessions: total,
        fraction: total === 0 ? 0 : done / total,
      };
    }
    remaining -= cycle.sessions;
  }

  return {
    cycle: null,
    sessionInCycle: 0,
    completedSessions: done,
    totalSessions: total,
    fraction: total === 0 ? 0 : done / total,
  };
}

/**
 * Rough date of the next expected session given when the last one happened.
 * Returns null when the plan is complete. An estimate for planning, never a
 * schedule — real dates come from the care team.
 */
export function nextExpectedSession(
  plan: TreatmentPlan,
  completedSessions: number,
  lastSessionDate: Date,
): Date | null {
  const progress = cycleProgress(plan, completedSessions);
  if (!progress.cycle) return null;

  const next = new Date(lastSessionDate);
  next.setDate(next.getDate() + progress.cycle.intervalDays);
  return next;
}

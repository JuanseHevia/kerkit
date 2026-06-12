import { describe, expect, it } from 'vitest';
import {
  calculateAuthDeadline,
  calculateExpiryDate,
  getPrescriptionStatus,
  isEscalationNeeded,
} from './dates.js';
import { cycleProgress, nextExpectedSession, totalSessions } from './treatment.js';
import type { TreatmentPlan } from './treatment.js';

describe('calculateAuthDeadline', () => {
  it('subtracts the margin hours from the appointment date', () => {
    const appt = new Date('2026-02-10T11:00:00.000Z');
    expect(calculateAuthDeadline(appt, 48)).toEqual(new Date('2026-02-08T11:00:00.000Z'));
  });
});

describe('isEscalationNeeded', () => {
  const deadline = new Date('2026-02-08T11:00:00.000Z');

  it('is true at/after the deadline while unconfirmed', () => {
    expect(isEscalationNeeded(deadline, 'pending', new Date('2026-02-08T11:00:00.000Z'))).toBe(true);
    expect(isEscalationNeeded(deadline, 'requested', new Date('2026-02-09T00:00:00.000Z'))).toBe(true);
  });

  it('is false before the deadline or once confirmed', () => {
    expect(isEscalationNeeded(deadline, 'pending', new Date('2026-02-08T10:59:59.000Z'))).toBe(false);
    expect(isEscalationNeeded(deadline, 'confirmed', new Date('2026-03-01T00:00:00.000Z'))).toBe(false);
  });
});

describe('prescription expiry', () => {
  it('calculateExpiryDate adds the locale validity window', () => {
    expect(calculateExpiryDate(new Date('2026-01-20T12:00:00.000Z'), 30)).toEqual(
      new Date('2026-02-19T12:00:00.000Z'),
    );
  });

  it('getPrescriptionStatus classifies across the boundaries', () => {
    const expires = new Date('2026-02-19T12:00:00.000Z');
    const opts = { alertWindowDays: 5 };
    expect(getPrescriptionStatus(expires, { ...opts, now: new Date('2026-02-01T00:00:00.000Z') })).toBe('active');
    expect(getPrescriptionStatus(expires, { ...opts, now: new Date('2026-02-16T00:00:00.000Z') })).toBe('expiring');
    expect(getPrescriptionStatus(expires, { ...opts, now: new Date('2026-02-19T12:00:01.000Z') })).toBe('expired');
  });
});

describe('treatment cycles', () => {
  const plan: TreatmentPlan = {
    protocolLabel: 'Etapa II',
    cycles: [
      { index: 1, sessions: 3, intervalDays: 21 },
      { index: 2, sessions: 3, intervalDays: 14 },
    ],
  };

  it('totals sessions across cycles', () => {
    expect(totalSessions(plan)).toBe(6);
  });

  it('locates the next session inside the right cycle', () => {
    const p = cycleProgress(plan, 4);
    expect(p.cycle?.index).toBe(2);
    expect(p.sessionInCycle).toBe(2);
    expect(p.fraction).toBeCloseTo(4 / 6);
  });

  it('reports completion when all sessions are done', () => {
    const p = cycleProgress(plan, 6);
    expect(p.cycle).toBeNull();
    expect(p.fraction).toBe(1);
  });

  it('estimates the next session date from the current cycle interval', () => {
    const next = nextExpectedSession(plan, 4, new Date('2026-02-01T12:00:00.000Z'));
    expect(next).toEqual(new Date('2026-02-15T12:00:00.000Z'));
  });

  it('returns null when the plan is complete', () => {
    expect(nextExpectedSession(plan, 6, new Date('2026-02-01T12:00:00.000Z'))).toBeNull();
  });
});

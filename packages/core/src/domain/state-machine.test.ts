import { describe, expect, it } from 'vitest';
import {
  AUTHORIZATION_TRANSITIONS,
  InvalidTransitionError,
  isValidTransition,
  planTransition,
} from './state-machine.js';
import type { AuthorizationStatus } from '../entities/authorization.js';

const ALL_STATUSES: AuthorizationStatus[] = [
  'needed',
  'requested',
  'pending',
  'confirmed',
  'escalation',
];

describe('authorization transition graph', () => {
  // The full matrix, spelled out: production behavior is the spec.
  const expected: Record<AuthorizationStatus, AuthorizationStatus[]> = {
    needed: ['requested', 'escalation'],
    requested: ['pending', 'escalation'],
    pending: ['confirmed', 'escalation'],
    confirmed: [],
    escalation: ['needed', 'requested', 'pending', 'confirmed'],
  };

  it.each(ALL_STATUSES.flatMap((from) => ALL_STATUSES.map((to) => [from, to] as const)))(
    '%s → %s matches the graph',
    (from, to) => {
      expect(isValidTransition(from, to)).toBe(expected[from].includes(to));
    },
  );

  it('confirmed is terminal', () => {
    expect(AUTHORIZATION_TRANSITIONS.confirmed).toHaveLength(0);
  });

  it('escalation is reachable from every active state', () => {
    for (const from of ['needed', 'requested', 'pending'] as const) {
      expect(isValidTransition(from, 'escalation')).toBe(true);
    }
  });
});

describe('planTransition', () => {
  const now = new Date('2026-02-01T12:00:00.000Z');

  it('throws InvalidTransitionError for moves outside the graph', () => {
    expect(() => planTransition({ status: 'confirmed' }, 'pending', { now })).toThrow(
      InvalidTransitionError,
    );
    expect(() => planTransition({ status: 'needed' }, 'confirmed', { now })).toThrow(
      InvalidTransitionError,
    );
  });

  it('sets confirmedDate when confirming', () => {
    const plan = planTransition({ status: 'pending' }, 'confirmed', { now });
    expect(plan.updates.confirmedDate).toEqual(now);
    expect(plan.timelineEntry.entryType).toBe('status_change');
  });

  it('flags escalation and uses the escalation timeline entry type', () => {
    const plan = planTransition({ status: 'requested' }, 'escalation', { now });
    expect(plan.updates.escalationTriggered).toBe(true);
    expect(plan.timelineEntry.entryType).toBe('escalation_trigger');
  });

  it('sets requestedDate only when not already set', () => {
    const first = planTransition({ status: 'needed' }, 'requested', { now });
    expect(first.updates.requestedDate).toEqual(now);

    const already = planTransition(
      { status: 'escalation', requestedDate: new Date('2026-01-20T00:00:00.000Z') },
      'requested',
      { now },
    );
    expect(already.updates.requestedDate).toBeUndefined();
  });

  it('includes the note in the timeline description', () => {
    const plan = planTransition({ status: 'needed' }, 'requested', {
      now,
      note: 'called the insurer',
    });
    expect(plan.timelineEntry.description).toContain('called the insurer');
    expect(plan.timelineEntry.fromStatus).toBe('needed');
    expect(plan.timelineEntry.toStatus).toBe('requested');
  });
});

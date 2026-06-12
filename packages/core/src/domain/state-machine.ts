import type { AuthorizationStatus, TimelineEntryType } from '../entities/authorization.js';

/**
 * The authorization lifecycle proven in production:
 * needed → requested → pending → confirmed, escalation reachable from any
 * active state, and escalation can return to any state once resolved.
 * confirmed is terminal.
 */
export const AUTHORIZATION_TRANSITIONS: Record<AuthorizationStatus, readonly AuthorizationStatus[]> = {
  needed: ['requested', 'escalation'],
  requested: ['pending', 'escalation'],
  pending: ['confirmed', 'escalation'],
  confirmed: [],
  escalation: ['needed', 'requested', 'pending', 'confirmed'],
};

export function isValidTransition(from: AuthorizationStatus, to: AuthorizationStatus): boolean {
  return AUTHORIZATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: AuthorizationStatus,
    public readonly to: AuthorizationStatus,
  ) {
    super(
      `Invalid transition from '${from}' to '${to}'. Allowed: ${
        AUTHORIZATION_TRANSITIONS[from].join(', ') || 'none'
      }`,
    );
    this.name = 'InvalidTransitionError';
  }
}

/** The field updates a persistence layer must apply for a transition. */
export interface TransitionUpdates {
  status: AuthorizationStatus;
  updatedAt: Date;
  confirmedDate?: Date;
  escalationTriggered?: true;
  requestedDate?: Date;
}

/** The timeline entry a persistence layer must append for a transition. */
export interface TransitionTimelineEntry {
  entryType: TimelineEntryType;
  description: string;
  fromStatus: AuthorizationStatus;
  toStatus: AuthorizationStatus;
  timestamp: Date;
}

export interface TransitionPlan {
  updates: TransitionUpdates;
  timelineEntry: TransitionTimelineEntry;
}

/**
 * Pure transition planner: validates the move and describes its effects.
 * Persistence (e.g. @kerkit/server's repository) applies the plan atomically.
 *
 * @throws InvalidTransitionError when the move is not in the graph.
 */
export function planTransition(
  authorization: { status: AuthorizationStatus; requestedDate?: Date | null },
  toStatus: AuthorizationStatus,
  opts: { now?: Date; note?: string } = {},
): TransitionPlan {
  const fromStatus = authorization.status;
  if (!isValidTransition(fromStatus, toStatus)) {
    throw new InvalidTransitionError(fromStatus, toStatus);
  }

  const now = opts.now ?? new Date();
  const updates: TransitionUpdates = { status: toStatus, updatedAt: now };

  if (toStatus === 'confirmed') {
    updates.confirmedDate = now;
  }
  if (toStatus === 'escalation') {
    updates.escalationTriggered = true;
  }
  if (toStatus === 'requested' && !authorization.requestedDate) {
    updates.requestedDate = now;
  }

  const description = opts.note
    ? `Status changed from ${fromStatus} to ${toStatus}: ${opts.note}`
    : `Status changed from ${fromStatus} to ${toStatus}`;

  return {
    updates,
    timelineEntry: {
      entryType: toStatus === 'escalation' ? 'escalation_trigger' : 'status_change',
      description,
      fromStatus,
      toStatus,
      timestamp: now,
    },
  };
}

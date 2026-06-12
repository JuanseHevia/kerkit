import { eq } from 'drizzle-orm';
import { planTransition } from '@kerkit/core';
import type { Authorization, AuthorizationStatus } from '@kerkit/core';
import type { KerkitDb } from './drizzle.js';
import type { KerkitTables } from '../schema/factory.js';

/**
 * Persistence wrapper for the pure state machine: plan the transition with
 * core's planTransition, then apply update + timeline entry. Throws
 * InvalidTransitionError (from core) for moves outside the graph and a plain
 * Error when the authorization doesn't belong to the user.
 */
export async function transitionAuthorization(
  db: KerkitDb,
  tables: KerkitTables,
  opts: {
    userId: string;
    authorizationId: string;
    toStatus: AuthorizationStatus;
    note?: string;
    now?: Date;
  },
): Promise<Authorization> {
  const [auth] = await db
    .select()
    .from(tables.authorizations)
    .where(eq(tables.authorizations.id, opts.authorizationId))
    .limit(1);

  if (!auth || (auth as { userId?: string }).userId !== opts.userId) {
    throw new Error('Authorization not found');
  }

  const plan = planTransition(
    auth as unknown as { status: AuthorizationStatus; requestedDate?: Date | null },
    opts.toStatus,
    { now: opts.now, note: opts.note },
  );

  const [updated] = await db
    .update(tables.authorizations)
    .set(plan.updates)
    .where(eq(tables.authorizations.id, opts.authorizationId))
    .returning();

  await db.insert(tables.authorizationTimelineEntries).values({
    authorizationId: opts.authorizationId,
    ...plan.timelineEntry,
  });

  return updated as unknown as Authorization;
}

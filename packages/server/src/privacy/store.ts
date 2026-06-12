import { desc, eq, isNull, and } from 'drizzle-orm';
import type { ConsentRecord, ConsentScope, ExportBundle, NewAuditEvent } from '@kerkit/core';
import { DELETION_ORDER } from '@kerkit/core';
import type { KerkitDb } from '../repositories/drizzle.js';
import type { KerkitTables } from '../schema/factory.js';

/**
 * The seam the privacy routes are built against. The Drizzle implementation
 * ships below; in-memory implementations are trivial for tests/demos.
 */
export interface PrivacyStore {
  exportAll(userId: string): Promise<ExportBundle>;
  /** Deletes every entity the user owns, children before parents. */
  deleteAll(userId: string): Promise<{ deleted: Record<string, number> }>;
  grantConsent(opts: {
    userId: string;
    scope: ConsentScope;
    policyVersion: string;
  }): Promise<ConsentRecord>;
  revokeConsent(opts: { userId: string; scope: ConsentScope }): Promise<boolean>;
  listConsents(userId: string): Promise<ConsentRecord[]>;
  appendAudit(event: NewAuditEvent): Promise<void>;
}

const EXPORT_NOTICE =
  'Estos son todos los datos que guardaste en la app. Son datos de logística de cuidado cargados por vos; no constituyen una historia clínica.';

export function createDrizzlePrivacyStore(db: KerkitDb, tables: KerkitTables): PrivacyStore {
  // DELETION_ORDER entity names → user-owned tables (children before parents).
  const byName: Record<string, { table: KerkitTables[keyof KerkitTables] }> = {
    signals: { table: tables.signals },
    authorizations: { table: tables.authorizations },
    checkpoints: { table: tables.checkpoints },
    notes: { table: tables.notes },
    prescriptions: { table: tables.prescriptions },
    appointments: { table: tables.appointments },
    conversations: { table: tables.conversations },
    consents: { table: tables.consents },
    patients: { table: tables.patients },
  };

  return {
    async exportAll(userId) {
      const bundle: ExportBundle = { exportedAt: new Date(), notice: EXPORT_NOTICE };

      for (const name of DELETION_ORDER) {
        if (name === 'users') {
          const rows = await db.select().from(tables.users).where(eq(tables.users.id, userId));
          bundle.users = rows;
          continue;
        }
        if (name === 'authorizationTimelineEntries') {
          // Timeline entries hang off authorizations; export via the parent set.
          const auths = await db
            .select({ id: tables.authorizations.id })
            .from(tables.authorizations)
            .where(eq(tables.authorizations.userId, userId));
          const entries = [];
          for (const auth of auths) {
            entries.push(
              ...(await db
                .select()
                .from(tables.authorizationTimelineEntries)
                .where(eq(tables.authorizationTimelineEntries.authorizationId, auth.id))),
            );
          }
          bundle.authorizationTimelineEntries = entries;
          continue;
        }
        const entry = byName[name];
        if (!entry) continue;
        const table = entry.table as typeof tables.notes;
        bundle[name] = await db.select().from(table).where(eq(table.userId, userId));
      }

      return bundle;
    },

    async deleteAll(userId) {
      const deleted: Record<string, number> = {};

      for (const name of DELETION_ORDER) {
        if (name === 'users') {
          const rows = await db.delete(tables.users).where(eq(tables.users.id, userId)).returning();
          deleted.users = rows.length;
          continue;
        }
        if (name === 'authorizationTimelineEntries') {
          // Cascades from authorizations (FK onDelete: cascade).
          continue;
        }
        const entry = byName[name];
        if (!entry) continue;
        const table = entry.table as typeof tables.notes;
        const rows = await db.delete(table).where(eq(table.userId, userId)).returning();
        deleted[name] = rows.length;
      }

      return { deleted };
    },

    async grantConsent({ userId, scope, policyVersion }) {
      const [row] = await db
        .insert(tables.consents)
        .values({ userId, scope, policyVersion })
        .returning();
      return row as unknown as ConsentRecord;
    },

    async revokeConsent({ userId, scope }) {
      const rows = await db
        .update(tables.consents)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(tables.consents.userId, userId),
            eq(tables.consents.scope, scope),
            isNull(tables.consents.revokedAt),
          ),
        )
        .returning();
      return rows.length > 0;
    },

    async listConsents(userId) {
      const rows = await db
        .select()
        .from(tables.consents)
        .where(eq(tables.consents.userId, userId))
        .orderBy(desc(tables.consents.grantedAt));
      return rows as unknown as ConsentRecord[];
    },

    async appendAudit(event) {
      await db.insert(tables.auditEvents).values({ ...event, at: event.at ?? new Date() });
    },
  };
}

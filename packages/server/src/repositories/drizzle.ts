import { and, desc, eq, gte, ilike, inArray, lte } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type {
  Appointment,
  Authorization,
  Checklist,
  Checkpoint,
  Institution,
  InstitutionContact,
  KerkitRepositories,
  Note,
  Patient,
  Prescription,
  Signal,
  Task,
  User,
} from '@kerkit/core';
import type { KerkitTables } from '../schema/factory.js';

/** Any Drizzle Postgres database (postgres-js, node-postgres, neon…). */
export type KerkitDb = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

/**
 * Drizzle implementations of the core repository interfaces. Every query is
 * userId-scoped; the schema's tables come from createKerkitSchema so
 * consumer column extensions ride along automatically.
 */
export function createKerkitRepositories(db: KerkitDb, tables: KerkitTables): KerkitRepositories {
  return {
    appointments: {
      async list({ userId, dateFrom, dateTo, status, type, limit }) {
        const conditions = [eq(tables.appointments.userId, userId)];
        if (dateFrom) conditions.push(gte(tables.appointments.date, dateFrom));
        if (dateTo) conditions.push(lte(tables.appointments.date, dateTo));
        if (status) conditions.push(eq(tables.appointments.status, status));
        if (type) conditions.push(eq(tables.appointments.type, type));
        const rows = await db
          .select()
          .from(tables.appointments)
          .where(and(...conditions))
          .orderBy(tables.appointments.date)
          .limit(limit ?? 50);
        return rows as unknown as Appointment[];
      },
    },
    prescriptions: {
      async list({ userId, statuses, medicationName, limit }) {
        const conditions = [eq(tables.prescriptions.userId, userId)];
        if (statuses && statuses.length > 0)
          conditions.push(inArray(tables.prescriptions.status, statuses));
        if (medicationName)
          conditions.push(ilike(tables.prescriptions.medicationName, `%${medicationName}%`));
        const rows = await db
          .select()
          .from(tables.prescriptions)
          .where(and(...conditions))
          .orderBy(tables.prescriptions.dateExpires)
          .limit(limit ?? 50);
        return rows as unknown as Prescription[];
      },
    },
    notes: {
      async list({ userId, pinned, search, limit }) {
        const conditions = [eq(tables.notes.userId, userId)];
        if (pinned !== undefined) conditions.push(eq(tables.notes.isPinned, pinned));
        if (search) conditions.push(ilike(tables.notes.content, `%${search}%`));
        const rows = await db
          .select()
          .from(tables.notes)
          .where(and(...conditions))
          .orderBy(desc(tables.notes.createdAt))
          .limit(limit ?? 50);
        return rows as unknown as Note[];
      },
      async create({ userId, content, tags, linkedAppointmentId, linkedPrescriptionId }) {
        const [row] = await db
          .insert(tables.notes)
          .values({
            userId,
            content,
            inputType: 'text',
            tags: tags ?? [],
            isPinned: false,
            linkedAppointmentId: linkedAppointmentId ?? null,
            linkedPrescriptionId: linkedPrescriptionId ?? null,
          })
          .returning();
        return row as unknown as Note;
      },
    },
    authorizations: {
      async list({ userId, statuses, limit }) {
        const conditions = [eq(tables.authorizations.userId, userId)];
        if (statuses && statuses.length > 0)
          conditions.push(inArray(tables.authorizations.status, statuses));
        const rows = await db
          .select()
          .from(tables.authorizations)
          .where(and(...conditions))
          .orderBy(tables.authorizations.deadline)
          .limit(limit ?? 50);
        return rows as unknown as Authorization[];
      },
    },
    checkpoints: {
      async list({ userId, limit }) {
        const rows = await db
          .select()
          .from(tables.checkpoints)
          .where(eq(tables.checkpoints.userId, userId))
          .orderBy(desc(tables.checkpoints.number))
          .limit(limit ?? 50);
        return rows as unknown as Checkpoint[];
      },
    },
    tasks: {
      async list({ userId, statuses, kind, checklistId, dueBefore, limit }) {
        const conditions = [eq(tables.tasks.userId, userId)];
        if (statuses && statuses.length > 0)
          conditions.push(inArray(tables.tasks.status, statuses));
        if (kind) conditions.push(eq(tables.tasks.kind, kind));
        if (checklistId) conditions.push(eq(tables.tasks.checklistId, checklistId));
        if (dueBefore) conditions.push(lte(tables.tasks.dueDate, dueBefore));
        const rows = await db
          .select()
          .from(tables.tasks)
          .where(and(...conditions))
          .orderBy(tables.tasks.sortOrder, tables.tasks.dueDate)
          .limit(limit ?? 50);
        return rows as unknown as Task[];
      },
      async create({
        userId,
        title,
        kind,
        dueDate,
        checklistId,
        dependsOn,
        linkedAppointmentId,
        linkedAuthorizationId,
        linkedPrescriptionId,
        sourceNoteId,
      }) {
        const [row] = await db
          .insert(tables.tasks)
          .values({
            userId,
            title,
            kind: kind ?? 'chore',
            status: 'todo',
            dueDate: dueDate ?? null,
            checklistId: checklistId ?? null,
            dependsOn: dependsOn ?? [],
            linkedAppointmentId: linkedAppointmentId ?? null,
            linkedAuthorizationId: linkedAuthorizationId ?? null,
            linkedPrescriptionId: linkedPrescriptionId ?? null,
            sourceNoteId: sourceNoteId ?? null,
          })
          .returning();
        return row as unknown as Task;
      },
    },
    checklists: {
      async list({ userId, limit }) {
        const rows = await db
          .select()
          .from(tables.checklists)
          .where(eq(tables.checklists.userId, userId))
          .orderBy(desc(tables.checklists.createdAt))
          .limit(limit ?? 50);
        return rows as unknown as Checklist[];
      },
    },
    signals: {
      async list({ userId, acknowledged, limit }) {
        const conditions = [eq(tables.signals.userId, userId)];
        if (acknowledged !== undefined)
          conditions.push(eq(tables.signals.acknowledged, acknowledged));
        const rows = await db
          .select()
          .from(tables.signals)
          .where(and(...conditions))
          .orderBy(desc(tables.signals.detectedAt))
          .limit(limit ?? 50);
        return rows as unknown as Signal[];
      },
    },
    profile: {
      async getUser(userId) {
        const [row] = await db.select().from(tables.users).where(eq(tables.users.id, userId)).limit(1);
        return (row as unknown as User) ?? null;
      },
      async getPatient(userId) {
        const [row] = await db
          .select()
          .from(tables.patients)
          .where(eq(tables.patients.userId, userId))
          .limit(1);
        return (row as unknown as Patient) ?? null;
      },
      async listInstitutions() {
        const rows = await db.select().from(tables.institutions);
        return rows as unknown as Institution[];
      },
      async listInstitutionContacts() {
        const rows = await db.select().from(tables.institutionContacts);
        return rows as unknown as InstitutionContact[];
      },
    },
  };
}

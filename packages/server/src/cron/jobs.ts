import { and, eq, inArray, lte, gte } from 'drizzle-orm';
import { getPrescriptionStatus, isEscalationNeeded, planTransition } from '@kerkit/core';
import type { Appointment, Authorization, Prescription } from '@kerkit/core';
import type { KerkitDb } from '../repositories/drizzle.js';
import type { KerkitTables } from '../schema/factory.js';

/**
 * Cron job skeletons: each returns a `run()` that does ONE pass. Scheduling
 * (setInterval, node-cron, a real queue) is the consumer's choice — these
 * deliberately do not self-schedule.
 */

export interface EscalationJobOptions {
  db: KerkitDb;
  tables: KerkitTables;
  /** Notify the caretaker (push, email…). Called after the transition persists. */
  onEscalation?: (authorization: Authorization) => Promise<void> | void;
  now?: () => Date;
}

/** Flags overdue, unconfirmed authorizations as escalation (with timeline entries). */
export function createEscalationJob(options: EscalationJobOptions) {
  return {
    async run(): Promise<{ escalated: number }> {
      const now = (options.now ?? (() => new Date()))();
      const { db, tables } = options;

      const candidates = await db
        .select()
        .from(tables.authorizations)
        .where(
          and(
            inArray(tables.authorizations.status, ['needed', 'requested', 'pending']),
            lte(tables.authorizations.deadline, now),
            eq(tables.authorizations.escalationTriggered, false),
          ),
        );

      let escalated = 0;
      for (const row of candidates) {
        const auth = row as unknown as Authorization;
        if (!isEscalationNeeded(auth.deadline, auth.status, now)) continue;

        const plan = planTransition(auth, 'escalation', { now });
        await db
          .update(tables.authorizations)
          .set(plan.updates)
          .where(eq(tables.authorizations.id, auth.id));
        await db
          .insert(tables.authorizationTimelineEntries)
          .values({ authorizationId: auth.id, ...plan.timelineEntry });

        escalated++;
        await options.onEscalation?.(auth);
      }

      return { escalated };
    },
  };
}

export interface ExpiryJobOptions {
  db: KerkitDb;
  tables: KerkitTables;
  /** From your locale pack's rules (e.g. argentina.rules.prescriptionAlertWindowDays). */
  alertWindowDays: number;
  /** Notify when a prescription first enters 'expiring'. */
  onExpiring?: (prescription: Prescription) => Promise<void> | void;
  now?: () => Date;
}

/** Recomputes prescription statuses against the locale's alert window. */
export function createExpiryJob(options: ExpiryJobOptions) {
  return {
    async run(): Promise<{ updated: number }> {
      const now = (options.now ?? (() => new Date()))();
      const { db, tables } = options;

      const open = await db
        .select()
        .from(tables.prescriptions)
        .where(inArray(tables.prescriptions.status, ['active', 'expiring']));

      let updated = 0;
      for (const row of open) {
        const rx = row as unknown as Prescription;
        const next = getPrescriptionStatus(rx.dateExpires, {
          alertWindowDays: options.alertWindowDays,
          now,
        });
        if (next === rx.status) continue;

        await db
          .update(tables.prescriptions)
          .set({ status: next, updatedAt: now })
          .where(eq(tables.prescriptions.id, rx.id));
        updated++;

        if (next === 'expiring' && !rx.expiryAlertSent) {
          await options.onExpiring?.(rx);
          await db
            .update(tables.prescriptions)
            .set({ expiryAlertSent: true })
            .where(eq(tables.prescriptions.id, rx.id));
        }
      }

      return { updated };
    },
  };
}

export interface ReminderJobOptions {
  db: KerkitDb;
  tables: KerkitTables;
  /** Hours before an appointment to remind (per-user settings can refine this). */
  reminderHours: number;
  onReminder: (appointment: Appointment) => Promise<void> | void;
  now?: () => Date;
}

/** Sends one reminder per upcoming appointment inside the reminder window. */
export function createReminderJob(options: ReminderJobOptions) {
  return {
    async run(): Promise<{ reminded: number }> {
      const now = (options.now ?? (() => new Date()))();
      const windowEnd = new Date(now.getTime() + options.reminderHours * 60 * 60 * 1000);
      const { db, tables } = options;

      const upcoming = await db
        .select()
        .from(tables.appointments)
        .where(
          and(
            eq(tables.appointments.status, 'upcoming'),
            eq(tables.appointments.reminderSent, false),
            gte(tables.appointments.date, now),
            lte(tables.appointments.date, windowEnd),
          ),
        );

      let reminded = 0;
      for (const row of upcoming) {
        const appointment = row as unknown as Appointment;
        await options.onReminder(appointment);
        await db
          .update(tables.appointments)
          .set({ reminderSent: true })
          .where(eq(tables.appointments.id, appointment.id));
        reminded++;
      }

      return { reminded };
    },
  };
}

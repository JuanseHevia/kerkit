import {
  appointmentClassification,
  authorizationClassification,
  checkpointClassification,
  getCopy,
  noteClassification,
  prescriptionClassification,
  signalClassification,
} from '@kerkit/core';
import type { LocalePack } from '@kerkit/core';
import type { ContextSource } from './source.js';
import type { KerkitRepositories } from '../repositories.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function dateLabel(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '');
}

/**
 * The default caretaker context window: the same seven slices proven in
 * production (upcoming appointments, active prescriptions, pinned + recent
 * notes, open authorizations, recent checkpoints, unacknowledged signals).
 *
 * Each factory returns a ContextSource you can pass to ContextAssembler.add;
 * compose, replace, or extend them freely.
 */
export function appointmentsSource(
  repos: KerkitRepositories,
  pack: LocalePack,
  opts: { now?: () => Date } = {},
): ContextSource {
  return {
    key: 'appointments',
    heading: getCopy(pack, 'context.section.appointments'),
    priority: 10,
    maxItems: 10,
    fetch: (userId) => {
      const now = (opts.now ?? (() => new Date()))();
      return repos.appointments.list({
        userId,
        dateFrom: new Date(now.getTime() - 7 * DAY_MS),
        dateTo: new Date(now.getTime() + 30 * DAY_MS),
        limit: 10,
      }) as unknown as Promise<Array<Record<string, unknown>>>;
    },
    classification: appointmentClassification,
    formatItem: (a) => `${a.title} | ${dateLabel(a.date)} | ${a.status}`,
  };
}

export function prescriptionsSource(repos: KerkitRepositories, pack: LocalePack): ContextSource {
  return {
    key: 'prescriptions',
    heading: getCopy(pack, 'context.section.prescriptions'),
    priority: 20,
    maxItems: 15,
    fetch: (userId) =>
      repos.prescriptions.list({ userId, statuses: ['active', 'expiring'] }) as unknown as Promise<
        Array<Record<string, unknown>>
      >,
    classification: prescriptionClassification,
    // The whole point of this section is medication logistics: the consumer
    // decision to send medication names to the LLM is written here, once.
    allowSensitiveFields: ['medicationName'],
    formatItem: (p) => `${p.medicationName ?? '(medicación)'} | vence: ${dateLabel(p.dateExpires)} | ${p.status}`,
  };
}

export function authorizationsSource(repos: KerkitRepositories, pack: LocalePack): ContextSource {
  return {
    key: 'authorizations',
    heading: getCopy(pack, 'context.section.authorizations'),
    priority: 30,
    maxItems: 15,
    fetch: (userId) =>
      repos.authorizations.list({
        userId,
        statuses: ['needed', 'requested', 'pending', 'escalation'],
      }) as unknown as Promise<Array<Record<string, unknown>>>,
    classification: authorizationClassification,
    formatItem: (a) => `${a.description} | ${a.status} | deadline: ${dateLabel(a.deadline)}`,
  };
}

export function notesSource(repos: KerkitRepositories, pack: LocalePack): ContextSource {
  return {
    key: 'notes',
    heading: getCopy(pack, 'context.section.notes'),
    priority: 40,
    maxItems: 10,
    fetch: async (userId) => {
      const [pinned, recent] = await Promise.all([
        repos.notes.list({ userId, pinned: true }),
        repos.notes.list({ userId, pinned: false, limit: 20 }),
      ]);
      return [...pinned, ...recent] as unknown as Array<Record<string, unknown>>;
    },
    classification: noteClassification,
    formatItem: (n) => `${n.isPinned ? '[FIJADA] ' : ''}${dateLabel(n.createdAt)}: ${n.content}`,
  };
}

export function checkpointsSource(repos: KerkitRepositories, pack: LocalePack): ContextSource {
  return {
    key: 'checkpoints',
    heading: getCopy(pack, 'context.section.checkpoints'),
    priority: 50,
    maxItems: 5,
    fetch: (userId) =>
      repos.checkpoints.list({ userId, limit: 5 }) as unknown as Promise<Array<Record<string, unknown>>>,
    classification: checkpointClassification,
    formatItem: (c) => `${c.title} | ${dateLabel(c.date)} | ${c.summary ?? 'Sin resumen'}`,
  };
}

export function signalsSource(repos: KerkitRepositories, pack: LocalePack): ContextSource {
  return {
    key: 'signals',
    heading: getCopy(pack, 'context.section.signals'),
    priority: 60,
    maxItems: 10,
    fetch: (userId) =>
      repos.signals.list({ userId, acknowledged: false, limit: 10 }) as unknown as Promise<
        Array<Record<string, unknown>>
      >,
    classification: signalClassification,
    formatItem: (s) => `${s.signalType}: ${s.subject}${s.suggestedAction ? ` | ${s.suggestedAction}` : ''}`,
  };
}

/** All default sources, ready for `new ContextAssembler({pack}).add(...)`. */
export function defaultSources(repos: KerkitRepositories, pack: LocalePack): ContextSource[] {
  return [
    appointmentsSource(repos, pack),
    prescriptionsSource(repos, pack),
    authorizationsSource(repos, pack),
    notesSource(repos, pack),
    checkpointsSource(repos, pack),
    signalsSource(repos, pack),
  ];
}

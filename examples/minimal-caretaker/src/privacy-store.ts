import type { AuditEvent, ConsentRecord, NewAuditEvent } from '@kerkit/core';
import type { createFixtureRepositories } from '@kerkit/ai/demo';
import type { PrivacyStore } from '@kerkit/server';

/** In-memory PrivacyStore over the demo fixtures (real apps use the Drizzle one). */
export function createInMemoryPrivacyStore(
  repos: ReturnType<typeof createFixtureRepositories>,
): PrivacyStore & { audits: AuditEvent[] } {
  const consents: ConsentRecord[] = [];
  const audits: AuditEvent[] = [];

  return {
    audits,
    async exportAll(userId) {
      const [appointments, prescriptions, notes, authorizations, checkpoints, signals] =
        await Promise.all([
          repos.appointments.list({ userId }),
          repos.prescriptions.list({ userId }),
          repos.notes.list({ userId }),
          repos.authorizations.list({ userId }),
          repos.checkpoints.list({ userId }),
          repos.signals.list({ userId }),
        ]);
      return {
        exportedAt: new Date(),
        notice:
          'Estos son todos los datos que guardaste en la app demo. Son datos de logística de cuidado; no constituyen una historia clínica.',
        appointments,
        prescriptions,
        notes,
        authorizations,
        checkpoints,
        signals,
        consents,
      };
    },
    async deleteAll() {
      // Demo data is in-memory and synthetic; report the shape of a real deletion.
      return { deleted: { notes: 1, appointments: 2, prescriptions: 1, authorizations: 1 } };
    },
    async grantConsent({ userId, scope, policyVersion }) {
      const record: ConsentRecord = {
        id: `00000000-0000-4000-8000-0000000005${String(consents.length).padStart(2, '0')}`,
        userId,
        scope,
        policyVersion,
        grantedAt: new Date(),
        revokedAt: null,
      };
      consents.push(record);
      return record;
    },
    async revokeConsent({ scope }) {
      const active = consents.find((c) => c.scope === scope && c.revokedAt == null);
      if (!active) return false;
      active.revokedAt = new Date();
      return true;
    },
    async listConsents() {
      return consents;
    },
    async appendAudit(event: NewAuditEvent) {
      audits.push({ id: `audit-${audits.length}`, at: new Date(), ...event } as AuditEvent);
    },
  };
}

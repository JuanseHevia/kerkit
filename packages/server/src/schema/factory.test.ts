import { describe, expect, it } from 'vitest';
import { integer } from 'drizzle-orm/pg-core';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { createKerkitSchema } from './factory.js';

describe('createKerkitSchema', () => {
  const tables = createKerkitSchema();

  it('creates the full table set', () => {
    expect(Object.keys(tables).sort()).toEqual(
      [
        'appointments',
        'auditEvents',
        'authorizationTimelineEntries',
        'authorizations',
        'checkpoints',
        'consents',
        'conversations',
        'institutionContacts',
        'institutions',
        'notes',
        'patients',
        'persons',
        'prescriptions',
        'signals',
        'users',
      ].sort(),
    );
  });

  it('uses generic column names (nationalId/insurerId, not dni/obraSocialId)', () => {
    const patientCols = getTableColumns(tables.patients);
    expect(patientCols.nationalId).toBeDefined();
    expect(patientCols.insurerId).toBeDefined();
    expect((patientCols as Record<string, unknown>).dni).toBeUndefined();

    expect(getTableName(tables.notes)).toBe('notes');
    expect(getTableName(tables.signals)).toBe('signals');
  });

  it('includes the privacy tables', () => {
    expect(getTableColumns(tables.consents).policyVersion).toBeDefined();
    expect(getTableColumns(tables.auditEvents).action).toBeDefined();
  });

  it('extends tables with consumer columns', () => {
    const extended = createKerkitSchema({
      extend: { appointments: { copayArs: integer('copay_ars') } },
    });
    const cols = getTableColumns(extended.appointments);
    expect((cols as Record<string, unknown>).copayArs).toBeDefined();
    expect(cols.title).toBeDefined();
  });
});

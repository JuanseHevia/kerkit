/**
 * In-memory repositories over the canonical synthetic persona — for tests
 * and demo mode. Not exported from the package index on purpose; the example
 * app imports it directly until a dedicated demo package exists.
 */
import {
  fixtureAppointmentChemo,
  fixtureAppointmentMri,
  fixtureAuthorization,
  fixtureCheckpoint,
  fixtureChecklist,
  fixtureClinic,
  fixtureImagingCenter,
  fixtureInsurer,
  fixtureInsurerContact,
  fixtureNote,
  fixturePatient,
  fixturePrescription,
  fixtureSignal,
  fixtureTaskBuyMeds,
  fixtureTaskLab,
  fixtureUser,
} from '@kerkit/core';
import type { Note } from '@kerkit/core';
import type { KerkitRepositories } from './repositories.js';

export function createFixtureRepositories(): KerkitRepositories & { createdNotes: Note[] } {
  const notes: Note[] = [fixtureNote];
  const createdNotes: Note[] = [];

  return {
    createdNotes,
    appointments: {
      list: async ({ userId, status, type, dateFrom, dateTo, limit }) =>
        [fixtureAppointmentChemo, fixtureAppointmentMri]
          .filter((a) => a.userId === userId)
          .filter((a) => (status ? a.status === status : true))
          .filter((a) => (type ? a.type === type : true))
          .filter((a) => (dateFrom ? a.date >= dateFrom : true))
          .filter((a) => (dateTo ? a.date <= dateTo : true))
          .slice(0, limit ?? 50),
    },
    prescriptions: {
      list: async ({ userId, statuses, medicationName, limit }) =>
        [fixturePrescription]
          .filter((p) => p.userId === userId)
          .filter((p) => (statuses ? statuses.includes(p.status) : true))
          .filter((p) =>
            medicationName
              ? p.medicationName.toLowerCase().includes(medicationName.toLowerCase())
              : true,
          )
          .slice(0, limit ?? 50),
    },
    notes: {
      list: async ({ userId, pinned, search, limit }) =>
        notes
          .filter((n) => n.userId === userId)
          .filter((n) => (pinned === undefined ? true : n.isPinned === pinned))
          .filter((n) => (search ? n.content.toLowerCase().includes(search.toLowerCase()) : true))
          .slice(0, limit ?? 50),
      create: async ({ userId, content, tags, linkedAppointmentId, linkedPrescriptionId }) => {
        const note: Note = {
          id: `00000000-0000-4000-8000-${String(900 + createdNotes.length).padStart(12, '0')}`,
          userId,
          content,
          inputType: 'text',
          tags: tags ?? [],
          isPinned: false,
          linkedAppointmentId,
          linkedPrescriptionId,
          createdAt: new Date('2026-02-01T12:00:00.000Z'),
          updatedAt: new Date('2026-02-01T12:00:00.000Z'),
        };
        notes.push(note);
        createdNotes.push(note);
        return note;
      },
    },
    authorizations: {
      list: async ({ userId, statuses, limit }) =>
        [fixtureAuthorization]
          .filter((a) => a.userId === userId)
          .filter((a) => (statuses ? statuses.includes(a.status) : true))
          .slice(0, limit ?? 50),
    },
    checkpoints: {
      list: async ({ userId, limit }) =>
        [fixtureCheckpoint].filter((c) => c.userId === userId).slice(0, limit ?? 50),
    },
    tasks: {
      list: async ({ userId, statuses, kind, checklistId, dueBefore, limit }) =>
        [fixtureTaskLab, fixtureTaskBuyMeds]
          .filter((t) => t.userId === userId)
          .filter((t) => (statuses ? statuses.includes(t.status) : true))
          .filter((t) => (kind ? t.kind === kind : true))
          .filter((t) => (checklistId ? t.checklistId === checklistId : true))
          .filter((t) => (dueBefore && t.dueDate ? t.dueDate <= dueBefore : true))
          .slice(0, limit ?? 50),
      create: async ({
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
      }) => ({
        id: '00000000-0000-4000-8000-0000000000af',
        userId,
        title,
        kind: kind ?? 'chore',
        status: 'todo',
        dueDate,
        checklistId,
        dependsOn,
        linkedAppointmentId,
        linkedAuthorizationId,
        linkedPrescriptionId,
        sourceNoteId,
        createdAt: new Date('2026-02-01T12:00:00.000Z'),
        updatedAt: new Date('2026-02-01T12:00:00.000Z'),
      }),
    },
    checklists: {
      list: async ({ userId, limit }) =>
        [fixtureChecklist].filter((c) => c.userId === userId).slice(0, limit ?? 50),
    },
    signals: {
      list: async ({ userId, acknowledged, limit }) =>
        [fixtureSignal]
          .filter((s) => s.userId === userId)
          .filter((s) => (acknowledged === undefined ? true : s.acknowledged === acknowledged))
          .slice(0, limit ?? 50),
    },
    profile: {
      getUser: async (userId) => (fixtureUser.id === userId ? fixtureUser : null),
      getPatient: async (userId) => (fixturePatient.userId === userId ? fixturePatient : null),
      listInstitutions: async () => [fixtureInsurer, fixtureClinic, fixtureImagingCenter],
      listInstitutionContacts: async () => [fixtureInsurerContact],
    },
  };
}

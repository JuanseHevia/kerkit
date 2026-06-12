import { z } from 'zod';
import {
  appointmentClassification,
  authorizationClassification,
  checkpointClassification,
  noteClassification,
  prescriptionClassification,
} from '@kerkit/core';
import type { AppointmentStatus, AuthorizationStatus, PrescriptionStatus } from '@kerkit/core';
import { errorResult, textResult } from './types.js';
import type { ToolDefinition } from './types.js';
import { redactedRowsResult } from './redact-rows.js';

const READ_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

export const readAppointmentsTool: ToolDefinition = {
  name: 'read_appointments',
  description:
    'Query the appointment calendar by date range, status, and/or kind. Returns upcoming and past care events (chemo sessions, imaging studies, consultations, lab work) with dates, status, and location details.',
  inputSchema: z.object({
    dateFrom: z.string().optional().describe('ISO 8601 date. Include appointments from this date.'),
    dateTo: z.string().optional().describe('ISO 8601 date. Include appointments up to this date.'),
    status: z.enum(['upcoming', 'completed', 'cancelled', 'rescheduled']).optional(),
    type: z.string().optional().describe('Care-event kind id (chemo, imaging, consultation, …).'),
    limit: z.number().min(1).max(50).default(20),
  }),
  annotations: READ_ANNOTATIONS,
  handler: async (params, context) => {
    const rows = await context.repos.appointments.list({
      userId: context.userId,
      dateFrom: params.dateFrom ? new Date(String(params.dateFrom)) : undefined,
      dateTo: params.dateTo ? new Date(String(params.dateTo)) : undefined,
      status: params.status as AppointmentStatus | undefined,
      type: params.type as string | undefined,
      limit: (params.limit as number) ?? 20,
    });
    return redactedRowsResult(
      rows as unknown as Array<Record<string, unknown>>,
      appointmentClassification,
      context,
      { emptyMessage: 'No se encontraron turnos con los filtros indicados.' },
    );
  },
};

export const readPrescriptionsTool: ToolDefinition = {
  name: 'read_prescriptions',
  description:
    'Query prescriptions (recetas) by status or medication name. Returns medication, issue/expiry dates, and document source — for tracking renewals and authorization needs.',
  inputSchema: z.object({
    status: z.enum(['active', 'expiring', 'expired', 'renewed']).optional(),
    medicationName: z.string().optional().describe('Substring match on the medication name.'),
    limit: z.number().min(1).max(50).default(20),
  }),
  annotations: READ_ANNOTATIONS,
  handler: async (params, context) => {
    const rows = await context.repos.prescriptions.list({
      userId: context.userId,
      statuses: params.status ? [params.status as PrescriptionStatus] : undefined,
      medicationName: params.medicationName as string | undefined,
      limit: (params.limit as number) ?? 20,
    });
    return redactedRowsResult(
      rows as unknown as Array<Record<string, unknown>>,
      prescriptionClassification,
      context,
      {
        // Medication names are the point of this tool; the opt-in lives here.
        allowSensitiveFields: ['medicationName'],
        emptyMessage: 'No se encontraron recetas con los filtros indicados.',
      },
    );
  },
};

export const readAuthorizationsTool: ToolDefinition = {
  name: 'read_authorizations',
  description:
    'Query insurance authorizations (trámites) by status. Returns description, current state, deadline, and escalation flag — the core of "what is stuck and why".',
  inputSchema: z.object({
    status: z.enum(['needed', 'requested', 'pending', 'confirmed', 'escalation']).optional(),
    limit: z.number().min(1).max(50).default(20),
  }),
  annotations: READ_ANNOTATIONS,
  handler: async (params, context) => {
    const rows = await context.repos.authorizations.list({
      userId: context.userId,
      statuses: params.status ? [params.status as AuthorizationStatus] : undefined,
      limit: (params.limit as number) ?? 20,
    });
    return redactedRowsResult(
      rows as unknown as Array<Record<string, unknown>>,
      authorizationClassification,
      context,
      { emptyMessage: 'No se encontraron autorizaciones con los filtros indicados.' },
    );
  },
};

export const readNotesTool: ToolDefinition = {
  name: 'read_notes',
  description:
    "Search the caretaker's notes by text, pinned status. Notes hold context the caretaker chose to offload: questions for doctors, observations, reminders.",
  inputSchema: z.object({
    search: z.string().optional().describe('Substring search over note content.'),
    pinnedOnly: z.boolean().default(false),
    limit: z.number().min(1).max(50).default(20),
  }),
  annotations: READ_ANNOTATIONS,
  handler: async (params, context) => {
    const rows = await context.repos.notes.list({
      userId: context.userId,
      pinned: params.pinnedOnly ? true : undefined,
      search: params.search as string | undefined,
      limit: (params.limit as number) ?? 20,
    });
    return redactedRowsResult(
      rows as unknown as Array<Record<string, unknown>>,
      noteClassification,
      context,
      { emptyMessage: 'No se encontraron notas con los filtros indicados.' },
    );
  },
};

export const readCheckpointsTool: ToolDefinition = {
  name: 'read_checkpoints',
  description:
    'List recent treatment checkpoints (doctor-visit milestones with summaries) to answer "where are we in the treatment?".',
  inputSchema: z.object({
    limit: z.number().min(1).max(20).default(5),
  }),
  annotations: READ_ANNOTATIONS,
  handler: async (params, context) => {
    const rows = await context.repos.checkpoints.list({
      userId: context.userId,
      limit: (params.limit as number) ?? 5,
    });
    return redactedRowsResult(
      rows as unknown as Array<Record<string, unknown>>,
      checkpointClassification,
      context,
      {
        allowSensitiveFields: ['treatmentPhase'],
        emptyMessage: 'Todavía no hay checkpoints registrados.',
      },
    );
  },
};

export const writeNoteTool: ToolDefinition = {
  name: 'write_note',
  description:
    'Create a note from the conversation: summaries, action items, anything the caretaker should not have to remember. The note appears in their notes tab.',
  inputSchema: z.object({
    content: z.string().min(1).describe('The note content.'),
    tags: z.array(z.string()).default([]).describe('Categorization tags.'),
    linkedAppointmentId: z.string().uuid().optional(),
    linkedPrescriptionId: z.string().uuid().optional(),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
  handler: async (params, context) => {
    const note = await context.repos.notes.create({
      userId: context.userId,
      content: String(params.content),
      tags: (params.tags as string[]) ?? [],
      linkedAppointmentId: params.linkedAppointmentId as string | undefined,
      linkedPrescriptionId: params.linkedPrescriptionId as string | undefined,
    });
    return textResult({
      message: 'Nota guardada correctamente.',
      note: { id: note.id, content: note.content, tags: note.tags, createdAt: note.createdAt },
    });
  },
};

export const readEmailTool: ToolDefinition = {
  name: 'read_email',
  description:
    "Search the caretaker's connected email for treatment-related messages (authorizations, results, pharmacy notices). Requires an email connection.",
  inputSchema: z.object({
    query: z.string().min(1).describe('Search query (provider syntax allowed).'),
    maxResults: z.number().min(1).max(25).default(10),
  }),
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  handler: async (params, context) => {
    if (!context.external?.searchEmail) {
      return errorResult('El correo no está conectado. Conectalo desde la configuración de la app.');
    }
    const messages = await context.external.searchEmail({
      userId: context.userId,
      query: String(params.query),
      maxResults: (params.maxResults as number) ?? 10,
    });
    if (messages.length === 0) return textResult('No se encontraron mensajes para esa búsqueda.');
    return textResult(messages);
  },
};

export const readCalendarTool: ToolDefinition = {
  name: 'read_calendar',
  description:
    "List upcoming events from the caretaker's connected external calendar. Requires a calendar connection.",
  inputSchema: z.object({
    maxResults: z.number().min(1).max(25).default(10),
  }),
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  handler: async (params, context) => {
    if (!context.external?.listCalendarEvents) {
      return errorResult('El calendario externo no está conectado. Conectalo desde la configuración de la app.');
    }
    const events = await context.external.listCalendarEvents({
      userId: context.userId,
      maxResults: (params.maxResults as number) ?? 10,
    });
    if (events.length === 0) return textResult('No hay eventos próximos en el calendario externo.');
    return textResult(events);
  },
};

export const readDocumentsTool: ToolDefinition = {
  name: 'read_documents',
  description:
    "Search the caretaker's connected document store (e.g. cloud drive) for treatment documents. Requires a documents connection.",
  inputSchema: z.object({
    query: z.string().optional().describe('Search query; omit for recent documents.'),
    maxResults: z.number().min(1).max(25).default(10),
  }),
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  handler: async (params, context) => {
    if (!context.external?.listDocuments) {
      return errorResult('El almacenamiento de documentos no está conectado. Conectalo desde la configuración de la app.');
    }
    const docs = await context.external.listDocuments({
      userId: context.userId,
      query: params.query as string | undefined,
      maxResults: (params.maxResults as number) ?? 10,
    });
    if (docs.length === 0) return textResult('No se encontraron documentos.');
    return textResult(docs);
  },
};

export const allTools: ToolDefinition[] = [
  readAppointmentsTool,
  readPrescriptionsTool,
  readAuthorizationsTool,
  readNotesTool,
  readCheckpointsTool,
  writeNoteTool,
  readEmailTool,
  readCalendarTool,
  readDocumentsTool,
];

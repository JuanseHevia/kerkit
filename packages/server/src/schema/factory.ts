import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { PgColumnBuilderBase } from 'drizzle-orm/pg-core';

/** Extra columns per table, merged into the base definitions. */
export type SchemaExtensions = Partial<
  Record<
    | 'users'
    | 'patients'
    | 'institutions'
    | 'institutionContacts'
    | 'persons'
    | 'appointments'
    | 'prescriptions'
    | 'notes'
    | 'authorizations'
    | 'authorizationTimelineEntries'
    | 'checkpoints'
    | 'signals'
    | 'conversations'
    | 'consents'
    | 'auditEvents',
    Record<string, PgColumnBuilderBase>
  >
>;

export interface CreateSchemaOptions {
  extend?: SchemaExtensions;
}

/**
 * The kerkit PostgreSQL schema as a factory: call it once in your app,
 * passing extra columns per table via `extend` (see EXTENDING.md). The
 * returned table objects are regular Drizzle tables — use them with
 * drizzle-kit for migrations and with createKerkitRepositories for the
 * standard data access.
 *
 * Statuses/kinds are text columns validated by @kerkit/core Zod schemas at
 * the edge — keeping kind sets extensible without enum migrations.
 */
export function createKerkitSchema(options: CreateSchemaOptions = {}) {
  const ext = options.extend ?? {};

  const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    authProviderId: text('auth_provider_id').notNull().unique(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
    settings: jsonb('settings').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ...ext.users,
  });

  const institutions = pgTable('institutions', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    address: text('address'),
    phone: text('phone'),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    ...ext.institutions,
  });

  const institutionContacts = pgTable('institution_contacts', {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    department: text('department'),
    phone: text('phone'),
    email: text('email'),
    notes: text('notes'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    ...ext.institutionContacts,
  });

  const patients = pgTable('patients', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nationalId: text('national_id').notNull(),
    insurerId: uuid('insurer_id')
      .notNull()
      .references(() => institutions.id),
    credentialNumber: text('credential_number'),
    diagnosis: text('diagnosis'),
    treatmentPhase: text('treatment_phase'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ...ext.patients,
  });

  const persons = pgTable('persons', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    role: text('role').notNull().default('doctor'),
    specialty: text('specialty'),
    institutionId: uuid('institution_id').references(() => institutions.id),
    phone: text('phone'),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    ...ext.persons,
  });

  const appointments = pgTable(
    'appointments',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
      title: text('title').notNull(),
      type: text('type').notNull(),
      date: timestamp('date', { withTimezone: true }).notNull(),
      institutionId: uuid('institution_id')
        .notNull()
        .references(() => institutions.id),
      personId: uuid('person_id').references(() => persons.id),
      locationDetail: text('location_detail'),
      notes: text('notes'),
      source: text('source'),
      sourceExternalId: text('source_external_id'),
      status: text('status').notNull().default('upcoming'),
      recurrencePattern: text('recurrence_pattern'),
      reminderSent: boolean('reminder_sent').notNull().default(false),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
      ...ext.appointments,
    },
    (t) => [index('appointments_user_date_idx').on(t.userId, t.date)],
  );

  const prescriptions = pgTable(
    'prescriptions',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
      medicationName: text('medication_name').notNull(),
      prescriberName: text('prescriber_name'),
      institutionId: uuid('institution_id').references(() => institutions.id),
      dateIssued: timestamp('date_issued', { withTimezone: true }).notNull(),
      dateExpires: timestamp('date_expires', { withTimezone: true }).notNull(),
      source: text('source').notNull(),
      sourceUrl: text('source_url'),
      filePath: text('file_path'),
      treatmentPhase: text('treatment_phase'),
      status: text('status').notNull().default('active'),
      expiryAlertSent: boolean('expiry_alert_sent').notNull().default(false),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
      ...ext.prescriptions,
    },
    (t) => [index('prescriptions_user_status_idx').on(t.userId, t.status)],
  );

  const notes = pgTable(
    'notes',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
      title: text('title'),
      content: text('content').notNull(),
      inputType: text('input_type').notNull().default('text'),
      category: text('category'),
      tags: jsonb('tags').notNull().default([]),
      isPinned: boolean('is_pinned').notNull().default(false),
      audioUrl: text('audio_url'),
      linkedAppointmentId: uuid('linked_appointment_id').references(() => appointments.id, {
        onDelete: 'set null',
      }),
      linkedPrescriptionId: uuid('linked_prescription_id').references(() => prescriptions.id, {
        onDelete: 'set null',
      }),
      source: text('source'),
      sourceExternalId: text('source_external_id'),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
      ...ext.notes,
    },
    (t) => [index('notes_user_pinned_idx').on(t.userId, t.isPinned)],
  );

  const checkpoints = pgTable('checkpoints', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    treatmentPhase: text('treatment_phase').notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    personName: text('person_name').notNull(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    linkedAppointmentId: uuid('linked_appointment_id')
      .notNull()
      .references(() => appointments.id),
    summary: text('summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ...ext.checkpoints,
  });

  const authorizations = pgTable(
    'authorizations',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
      type: text('type').notNull(),
      description: text('description').notNull(),
      insurerId: uuid('insurer_id')
        .notNull()
        .references(() => institutions.id),
      status: text('status').notNull().default('needed'),
      linkedAppointmentId: uuid('linked_appointment_id').references(() => appointments.id, {
        onDelete: 'set null',
      }),
      linkedPrescriptionId: uuid('linked_prescription_id').references(() => prescriptions.id, {
        onDelete: 'set null',
      }),
      linkedCheckpointId: uuid('linked_checkpoint_id').references(() => checkpoints.id, {
        onDelete: 'set null',
      }),
      requestedDate: timestamp('requested_date', { withTimezone: true }),
      expectedResolutionDate: timestamp('expected_resolution_date', { withTimezone: true }),
      confirmedDate: timestamp('confirmed_date', { withTimezone: true }),
      deadline: timestamp('deadline', { withTimezone: true }).notNull(),
      escalationTriggered: boolean('escalation_triggered').notNull().default(false),
      notes: text('notes'),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
      ...ext.authorizations,
    },
    (t) => [index('authorizations_user_status_deadline_idx').on(t.userId, t.status, t.deadline)],
  );

  const authorizationTimelineEntries = pgTable('authorization_timeline_entries', {
    id: uuid('id').primaryKey().defaultRandom(),
    authorizationId: uuid('authorization_id')
      .notNull()
      .references(() => authorizations.id, { onDelete: 'cascade' }),
    entryType: text('entry_type').notNull(),
    description: text('description').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
    ...ext.authorizationTimelineEntries,
  });

  const signals = pgTable(
    'signals',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
      channel: text('channel').notNull().default('email'),
      externalId: text('external_id').notNull(),
      signalType: text('signal_type').notNull(),
      subject: text('subject').notNull(),
      sender: text('sender').notNull(),
      detectedAt: timestamp('detected_at', { withTimezone: true }).notNull(),
      acknowledged: boolean('acknowledged').notNull().default(false),
      suggestedAction: text('suggested_action'),
      linkedAuthorizationId: uuid('linked_authorization_id').references(() => authorizations.id, {
        onDelete: 'set null',
      }),
      institutionId: uuid('institution_id').references(() => institutions.id),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      ...ext.signals,
    },
    (t) => [index('signals_user_ack_idx').on(t.userId, t.acknowledged)],
  );

  const conversations = pgTable('conversations', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    messages: jsonb('messages').notNull().default([]),
    contextSnapshot: jsonb('context_snapshot').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ...ext.conversations,
  });

  const consents = pgTable('consents', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    policyVersion: text('policy_version').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...ext.consents,
  });

  const auditEvents = pgTable(
    'audit_events',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      actor: text('actor').notNull(),
      action: text('action').notNull(),
      entityType: text('entity_type'),
      entityId: text('entity_id'),
      at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
      context: jsonb('context'),
      ...ext.auditEvents,
    },
    (t) => [index('audit_events_actor_at_idx').on(t.actor, t.at)],
  );

  return {
    users,
    institutions,
    institutionContacts,
    patients,
    persons,
    appointments,
    prescriptions,
    notes,
    checkpoints,
    authorizations,
    authorizationTimelineEntries,
    signals,
    conversations,
    consents,
    auditEvents,
  };
}

export type KerkitTables = ReturnType<typeof createKerkitSchema>;

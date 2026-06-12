import type {
  Appointment,
  AppointmentStatus,
  Authorization,
  AuthorizationStatus,
  Checkpoint,
  Institution,
  InstitutionContact,
  Note,
  Patient,
  Prescription,
  PrescriptionStatus,
  Signal,
  User,
} from '@kerkit/core';

/**
 * The data surface @kerkit/ai needs, as interfaces. @kerkit/server ships
 * Drizzle implementations; tests and other stacks implement them directly.
 * Every method is scoped by userId — implementations MUST enforce it.
 */
export interface AppointmentsRepository {
  list(opts: {
    userId: string;
    dateFrom?: Date;
    dateTo?: Date;
    status?: AppointmentStatus;
    type?: string;
    limit?: number;
  }): Promise<Appointment[]>;
}

export interface PrescriptionsRepository {
  list(opts: {
    userId: string;
    statuses?: PrescriptionStatus[];
    medicationName?: string;
    limit?: number;
  }): Promise<Prescription[]>;
}

export interface NotesRepository {
  list(opts: {
    userId: string;
    pinned?: boolean;
    search?: string;
    limit?: number;
  }): Promise<Note[]>;
  create(opts: {
    userId: string;
    content: string;
    tags?: string[];
    linkedAppointmentId?: string;
    linkedPrescriptionId?: string;
  }): Promise<Note>;
}

export interface AuthorizationsRepository {
  list(opts: {
    userId: string;
    statuses?: AuthorizationStatus[];
    limit?: number;
  }): Promise<Authorization[]>;
}

export interface CheckpointsRepository {
  list(opts: { userId: string; limit?: number }): Promise<Checkpoint[]>;
}

export interface SignalsRepository {
  list(opts: { userId: string; acknowledged?: boolean; limit?: number }): Promise<Signal[]>;
}

export interface ProfileRepository {
  getUser(userId: string): Promise<User | null>;
  getPatient(userId: string): Promise<Patient | null>;
  listInstitutions(): Promise<Institution[]>;
  listInstitutionContacts(): Promise<InstitutionContact[]>;
}

export interface KerkitRepositories {
  appointments: AppointmentsRepository;
  prescriptions: PrescriptionsRepository;
  notes: NotesRepository;
  authorizations: AuthorizationsRepository;
  checkpoints: CheckpointsRepository;
  signals: SignalsRepository;
  profile: ProfileRepository;
}

/**
 * Optional bridges to the caretaker's external world (email, calendar,
 * documents). Vendor glue (Composio, Google APIs…) lives in consumer code;
 * kerkit only defines the seam. Tools degrade gracefully when absent.
 */
export interface ExternalSources {
  searchEmail?(opts: { userId: string; query: string; maxResults?: number }): Promise<
    Array<{ subject: string; sender: string; date: string; snippet: string }>
  >;
  listCalendarEvents?(opts: { userId: string; maxResults?: number }): Promise<
    Array<{ title: string; start: string; end?: string; location?: string }>
  >;
  listDocuments?(opts: { userId: string; query?: string; maxResults?: number }): Promise<
    Array<{ name: string; modifiedAt?: string; url?: string }>
  >;
}

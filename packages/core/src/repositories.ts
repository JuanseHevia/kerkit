import type {
  Appointment,
  AppointmentStatus,
  Authorization,
  AuthorizationStatus,
  Checklist,
  Checkpoint,
  Institution,
  InstitutionContact,
  Note,
  Patient,
  Prescription,
  PrescriptionStatus,
  Signal,
  Task,
  TaskKind,
  TaskStatus,
  User,
} from './entities/index.js';

/**
 * The data-access surface kerkit layers consume, as interfaces.
 * @kerkit/server ships Drizzle implementations; tests and other stacks
 * implement them directly. Every method is scoped by userId —
 * implementations MUST enforce it.
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

export interface TasksRepository {
  list(opts: {
    userId: string;
    statuses?: TaskStatus[];
    kind?: TaskKind;
    checklistId?: string;
    dueBefore?: Date;
    limit?: number;
  }): Promise<Task[]>;
  create(opts: {
    userId: string;
    title: string;
    kind?: TaskKind;
    dueDate?: Date;
    checklistId?: string;
    dependsOn?: string[];
    linkedAppointmentId?: string;
    linkedAuthorizationId?: string;
    linkedPrescriptionId?: string;
    sourceNoteId?: string;
  }): Promise<Task>;
}

export interface ChecklistsRepository {
  list(opts: { userId: string; limit?: number }): Promise<Checklist[]>;
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
  tasks: TasksRepository;
  checklists: ChecklistsRepository;
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

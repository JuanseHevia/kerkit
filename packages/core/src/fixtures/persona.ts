/**
 * The canonical synthetic persona. EVERY fixture, seed, test, demo, doc
 * example, and prompt example in the kerkit ecosystem uses these people and
 * institutions — never invent new fake-but-plausible ones, and never use
 * real data. The PII CI gate allowlists exactly these values.
 */
import type { User } from '../entities/user.js';
import type { Patient } from '../entities/patient.js';
import type { Institution, InstitutionContact } from '../entities/institution.js';
import type { Person } from '../entities/person.js';
import type { Appointment } from '../entities/appointment.js';
import type { Prescription } from '../entities/prescription.js';
import type { Authorization } from '../entities/authorization.js';
import type { Note } from '../entities/note.js';
import type { Checkpoint } from '../entities/checkpoint.js';
import type { Task, Checklist } from '../entities/task.js';
import type { Signal } from '../entities/signal.js';

const T0 = new Date('2026-01-05T12:00:00.000Z');

export const FIXTURE_IDS = {
  user: '00000000-0000-4000-8000-000000000001',
  patient: '00000000-0000-4000-8000-000000000002',
  insurer: '00000000-0000-4000-8000-000000000010',
  clinic: '00000000-0000-4000-8000-000000000011',
  imagingCenter: '00000000-0000-4000-8000-000000000012',
  doctor: '00000000-0000-4000-8000-000000000020',
  insurerContact: '00000000-0000-4000-8000-000000000021',
  appointmentChemo: '00000000-0000-4000-8000-000000000030',
  appointmentMri: '00000000-0000-4000-8000-000000000031',
  prescription: '00000000-0000-4000-8000-000000000040',
  authorization: '00000000-0000-4000-8000-000000000050',
  note: '00000000-0000-4000-8000-000000000060',
  checkpoint: '00000000-0000-4000-8000-000000000070',
  signal: '00000000-0000-4000-8000-000000000080',
  checklist: '00000000-0000-4000-8000-000000000090',
  taskLab: '00000000-0000-4000-8000-0000000000a0',
  taskBuyMeds: '00000000-0000-4000-8000-0000000000a1',
} as const;

/** The caretaker. */
export const fixtureUser: User = {
  id: FIXTURE_IDS.user,
  authProviderId: 'auth_demo_000001',
  email: 'carlos.demo@example.com',
  name: 'Carlos Pérez',
  onboardingCompleted: true,
  settings: {
    reminderHours: 48,
    briefingEnabled: true,
    expiryAlertDay: 25,
    signalPollingEnabled: false,
  },
  createdAt: T0,
  updatedAt: T0,
};

/** The patient — Carlos's mother. */
export const fixturePatient: Patient = {
  id: FIXTURE_IDS.patient,
  userId: FIXTURE_IDS.user,
  name: 'Marta Pérez',
  nationalId: '12.345.678',
  insurerId: FIXTURE_IDS.insurer,
  credentialNumber: 'DEMO-0001-00',
  diagnosis: 'Diagnóstico de demostración',
  treatmentPhase: 'Etapa II',
  createdAt: T0,
  updatedAt: T0,
};

export const fixtureInsurer: Institution = {
  id: FIXTURE_IDS.insurer,
  name: 'Obra Social Demo Salud',
  type: 'insurer',
  phone: '0800-000-0000',
  email: 'autorizaciones@demosalud.example.com',
  createdAt: T0,
};

export const fixtureClinic: Institution = {
  id: FIXTURE_IDS.clinic,
  name: 'Clínica Demo Centro',
  type: 'clinic',
  address: 'Av. Siempreviva 742, CABA',
  phone: '011-0000-0000',
  email: 'turnos@clinicademo.example.com',
  createdAt: T0,
};

export const fixtureImagingCenter: Institution = {
  id: FIXTURE_IDS.imagingCenter,
  name: 'Centro de Imágenes Demo',
  type: 'imaging_center',
  address: 'Calle Falsa 123, CABA',
  createdAt: T0,
};

export const fixtureInsurerContact: InstitutionContact = {
  id: FIXTURE_IDS.insurerContact,
  institutionId: FIXTURE_IDS.insurer,
  department: 'Autorizaciones',
  phone: '0800-000-0001',
  email: 'autorizaciones@demosalud.example.com',
  sortOrder: 0,
  createdAt: T0,
};

export const fixtureDoctor: Person = {
  id: FIXTURE_IDS.doctor,
  name: 'Dra. Laura Gómez',
  role: 'doctor',
  specialty: 'Oncología',
  institutionId: FIXTURE_IDS.clinic,
  createdAt: T0,
};

export const fixtureAppointmentChemo: Appointment = {
  id: FIXTURE_IDS.appointmentChemo,
  userId: FIXTURE_IDS.user,
  title: 'Quimioterapia — ciclo 3, sesión 1',
  type: 'chemo',
  date: new Date('2026-02-10T11:00:00.000Z'),
  institutionId: FIXTURE_IDS.clinic,
  personId: FIXTURE_IDS.doctor,
  locationDetail: 'Hospital de día, 2º piso',
  status: 'upcoming',
  reminderSent: false,
  createdAt: T0,
  updatedAt: T0,
};

export const fixtureAppointmentMri: Appointment = {
  id: FIXTURE_IDS.appointmentMri,
  userId: FIXTURE_IDS.user,
  title: 'Resonancia de control',
  type: 'imaging',
  date: new Date('2026-03-02T13:30:00.000Z'),
  institutionId: FIXTURE_IDS.imagingCenter,
  status: 'upcoming',
  reminderSent: false,
  createdAt: T0,
  updatedAt: T0,
};

export const fixturePrescription: Prescription = {
  id: FIXTURE_IDS.prescription,
  userId: FIXTURE_IDS.user,
  medicationName: 'Medicamento Demo 50mg',
  prescriberName: 'Dra. Laura Gómez',
  institutionId: FIXTURE_IDS.clinic,
  dateIssued: new Date('2026-01-20T12:00:00.000Z'),
  dateExpires: new Date('2026-02-19T12:00:00.000Z'),
  source: 'manual',
  treatmentPhase: 'Etapa II',
  status: 'active',
  expiryAlertSent: false,
  createdAt: T0,
  updatedAt: T0,
};

export const fixtureAuthorization: Authorization = {
  id: FIXTURE_IDS.authorization,
  userId: FIXTURE_IDS.user,
  type: 'medication_supply',
  description: 'Autorización de Medicamento Demo 50mg para ciclo 3',
  insurerId: FIXTURE_IDS.insurer,
  status: 'requested',
  linkedAppointmentId: FIXTURE_IDS.appointmentChemo,
  linkedPrescriptionId: FIXTURE_IDS.prescription,
  requestedDate: new Date('2026-01-22T12:00:00.000Z'),
  deadline: new Date('2026-02-08T11:00:00.000Z'),
  escalationTriggered: false,
  createdAt: T0,
  updatedAt: T0,
};

export const fixtureNote: Note = {
  id: FIXTURE_IDS.note,
  userId: FIXTURE_IDS.user,
  title: 'Preguntas para la Dra. Gómez',
  content:
    'Preguntar si el estudio de control puede adelantarse. Llevar el último análisis de sangre. Mamá (Marta Pérez, DNI 12.345.678) prefiere turnos a la mañana.',
  inputType: 'text',
  category: 'consultas',
  tags: ['preguntas', 'control'],
  isPinned: true,
  createdAt: T0,
  updatedAt: T0,
};

export const fixtureCheckpoint: Checkpoint = {
  id: FIXTURE_IDS.checkpoint,
  userId: FIXTURE_IDS.user,
  number: 2,
  title: 'Control post ciclo 2',
  treatmentPhase: 'Etapa II',
  date: new Date('2026-01-28T14:00:00.000Z'),
  personName: 'Dra. Laura Gómez',
  institutionId: FIXTURE_IDS.clinic,
  linkedAppointmentId: FIXTURE_IDS.appointmentChemo,
  summary: 'Buen progreso. Se indicó continuar con el esquema y repetir análisis antes del ciclo 3.',
  createdAt: T0,
  updatedAt: T0,
};

export const fixtureSignal: Signal = {
  id: FIXTURE_IDS.signal,
  userId: FIXTURE_IDS.user,
  channel: 'email',
  externalId: 'demo-email-0001',
  signalType: 'auth_preparing',
  subject: 'Su autorización está en preparación',
  sender: 'autorizaciones@demosalud.example.com',
  detectedAt: new Date('2026-01-23T09:15:00.000Z'),
  acknowledged: false,
  suggestedAction: 'La obra social está preparando la autorización. No hace falta hacer nada todavía.',
  linkedAuthorizationId: FIXTURE_IDS.authorization,
  institutionId: FIXTURE_IDS.insurer,
  createdAt: T0,
};

/** The pre-appointment prep checklist for the chemo session. */
export const fixtureChecklist: Checklist = {
  id: FIXTURE_IDS.checklist,
  userId: FIXTURE_IDS.user,
  title: 'Preparación para quimioterapia — ciclo 3',
  kind: 'pre_appointment',
  linkedAppointmentId: FIXTURE_IDS.appointmentChemo,
  createdAt: T0,
  updatedAt: T0,
};

/** A finished prep chore: pick up the lab results to bring to the session. */
export const fixtureTaskLab: Task = {
  id: FIXTURE_IDS.taskLab,
  userId: FIXTURE_IDS.user,
  title: 'Retirar resultados de laboratorio',
  kind: 'prep',
  status: 'done',
  dueDate: new Date('2026-02-09T18:00:00.000Z'),
  checklistId: FIXTURE_IDS.checklist,
  sortOrder: 0,
  linkedAppointmentId: FIXTURE_IDS.appointmentChemo,
  createdAt: T0,
  updatedAt: T0,
};

/** A pending chore that depends on the lab task being done first. */
export const fixtureTaskBuyMeds: Task = {
  id: FIXTURE_IDS.taskBuyMeds,
  userId: FIXTURE_IDS.user,
  title: 'Comprar medicación para el ciclo 3',
  kind: 'medication',
  status: 'todo',
  dueDate: new Date('2026-02-09T20:00:00.000Z'),
  checklistId: FIXTURE_IDS.checklist,
  sortOrder: 1,
  dependsOn: [FIXTURE_IDS.taskLab],
  linkedPrescriptionId: FIXTURE_IDS.prescription,
  linkedAuthorizationId: FIXTURE_IDS.authorization,
  createdAt: T0,
  updatedAt: T0,
};

/** Every fixture entity, keyed for iteration in completeness tests. */
export const fixtureEntities = {
  user: fixtureUser,
  patient: fixturePatient,
  insurer: fixtureInsurer,
  clinic: fixtureClinic,
  imagingCenter: fixtureImagingCenter,
  doctor: fixtureDoctor,
  appointmentChemo: fixtureAppointmentChemo,
  appointmentMri: fixtureAppointmentMri,
  prescription: fixturePrescription,
  authorization: fixtureAuthorization,
  note: fixtureNote,
  checkpoint: fixtureCheckpoint,
  checklist: fixtureChecklist,
  taskLab: fixtureTaskLab,
  taskBuyMeds: fixtureTaskBuyMeds,
  signal: fixtureSignal,
} as const;

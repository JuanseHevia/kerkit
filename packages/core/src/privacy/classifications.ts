import type { PatientBase } from '../entities/patient.js';
import type { AppointmentBase } from '../entities/appointment.js';
import type { PrescriptionBase } from '../entities/prescription.js';
import type { NoteBase } from '../entities/note.js';
import type { AuthorizationBase } from '../entities/authorization.js';
import type { CheckpointBase } from '../entities/checkpoint.js';
import type { InstitutionBase } from '../entities/institution.js';
import type { PersonBase } from '../entities/person.js';
import type { SignalBase } from '../entities/signal.js';
import type { UserBase } from '../entities/user.js';
import type { Classification } from './classification.js';

export const patientClassification: Classification<PatientBase> = {
  id: 'logistics',
  userId: 'logistics',
  name: 'direct-identifier',
  nationalId: 'direct-identifier',
  insurerId: 'logistics',
  credentialNumber: 'direct-identifier',
  diagnosis: 'sensitive-health',
  treatmentPhase: 'sensitive-health',
  createdAt: 'public',
  updatedAt: 'public',
};

export const appointmentClassification: Classification<AppointmentBase> = {
  id: 'logistics',
  userId: 'logistics',
  title: 'logistics',
  type: 'logistics',
  date: 'logistics',
  institutionId: 'logistics',
  personId: 'logistics',
  locationDetail: 'logistics',
  notes: 'logistics',
  source: 'logistics',
  sourceExternalId: 'logistics',
  status: 'logistics',
  recurrencePattern: 'logistics',
  reminderSent: 'public',
  createdAt: 'public',
  updatedAt: 'public',
};

export const prescriptionClassification: Classification<PrescriptionBase> = {
  id: 'logistics',
  userId: 'logistics',
  medicationName: 'sensitive-health',
  prescriberName: 'logistics',
  institutionId: 'logistics',
  dateIssued: 'logistics',
  dateExpires: 'logistics',
  source: 'logistics',
  sourceUrl: 'logistics',
  filePath: 'logistics',
  treatmentPhase: 'sensitive-health',
  status: 'logistics',
  expiryAlertSent: 'public',
  createdAt: 'public',
  updatedAt: 'public',
};

export const noteClassification: Classification<NoteBase> = {
  id: 'logistics',
  userId: 'logistics',
  title: 'logistics',
  content: 'logistics',
  inputType: 'public',
  category: 'logistics',
  tags: 'logistics',
  isPinned: 'public',
  audioUrl: 'logistics',
  linkedAppointmentId: 'logistics',
  linkedPrescriptionId: 'logistics',
  source: 'logistics',
  sourceExternalId: 'logistics',
  createdAt: 'public',
  updatedAt: 'public',
};

export const authorizationClassification: Classification<AuthorizationBase> = {
  id: 'logistics',
  userId: 'logistics',
  type: 'logistics',
  description: 'logistics',
  insurerId: 'logistics',
  status: 'logistics',
  linkedAppointmentId: 'logistics',
  linkedPrescriptionId: 'logistics',
  linkedCheckpointId: 'logistics',
  requestedDate: 'logistics',
  expectedResolutionDate: 'logistics',
  confirmedDate: 'logistics',
  deadline: 'logistics',
  escalationTriggered: 'public',
  notes: 'logistics',
  createdAt: 'public',
  updatedAt: 'public',
};

export const checkpointClassification: Classification<CheckpointBase> = {
  id: 'logistics',
  userId: 'logistics',
  number: 'public',
  title: 'logistics',
  treatmentPhase: 'sensitive-health',
  date: 'logistics',
  personName: 'logistics',
  institutionId: 'logistics',
  linkedAppointmentId: 'logistics',
  summary: 'logistics',
  createdAt: 'public',
  updatedAt: 'public',
};

export const institutionClassification: Classification<InstitutionBase> = {
  id: 'logistics',
  name: 'logistics',
  type: 'logistics',
  address: 'logistics',
  phone: 'logistics',
  email: 'logistics',
  createdAt: 'public',
};

export const personClassification: Classification<PersonBase> = {
  id: 'logistics',
  name: 'logistics',
  role: 'public',
  specialty: 'logistics',
  institutionId: 'logistics',
  phone: 'logistics',
  email: 'logistics',
  createdAt: 'public',
};

export const signalClassification: Classification<SignalBase> = {
  id: 'logistics',
  userId: 'logistics',
  channel: 'public',
  externalId: 'logistics',
  signalType: 'logistics',
  subject: 'logistics',
  sender: 'logistics',
  detectedAt: 'logistics',
  acknowledged: 'public',
  suggestedAction: 'logistics',
  linkedAuthorizationId: 'logistics',
  institutionId: 'logistics',
  createdAt: 'public',
};

export const userClassification: Classification<UserBase> = {
  id: 'logistics',
  authProviderId: 'direct-identifier',
  email: 'direct-identifier',
  name: 'direct-identifier',
  onboardingCompleted: 'public',
  settings: 'public',
  createdAt: 'public',
  updatedAt: 'public',
};

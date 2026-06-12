// Repository interfaces live in @kerkit/core (so @kerkit/server can implement
// them without depending on this package); re-exported here for convenience.
export type {
  KerkitRepositories,
  AppointmentsRepository,
  PrescriptionsRepository,
  NotesRepository,
  AuthorizationsRepository,
  CheckpointsRepository,
  SignalsRepository,
  ProfileRepository,
  ExternalSources,
} from '@kerkit/core';

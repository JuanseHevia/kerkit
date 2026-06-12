export interface UserSettings {
  reminderHours: number;
  briefingEnabled: boolean;
  expiryAlertDay: number;
  signalPollingEnabled: boolean;
}

/** The caretaker. Auth provider is the consumer's choice; this only stores its subject id. */
export interface UserBase {
  id: string;
  /** Subject id at the consumer's auth provider (Clerk, Auth0, custom…). */
  authProviderId: string;
  email: string;
  name: string;
  onboardingCompleted: boolean;
  settings: UserSettings;
  createdAt: Date;
  updatedAt: Date;
}

export type User<TExt = Record<never, never>> = UserBase & TExt;

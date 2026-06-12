export type PersonRole = 'doctor' | 'nurse' | 'administrative' | 'other';

/** A member of the care team — doctors, nurses, administrative contacts. */
export interface PersonBase {
  id: string;
  name: string;
  role: PersonRole;
  specialty?: string;
  institutionId?: string;
  phone?: string;
  email?: string;
  createdAt: Date;
}

export type Person<TExt = Record<never, never>> = PersonBase & TExt;

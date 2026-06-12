import type { InsurerModel } from '@kerkit/core';

/**
 * Reference catalog of Argentine health insurers (obras sociales and
 * prepagas) for autocomplete and onboarding. Names only — no SLA claims
 * about real companies; SLAs are illustrated on the demo insurer and should
 * be configured per app from real experience.
 *
 * Contributions of additional rows are accepted without prior discussion
 * (see CONTRIBUTING.md).
 */
export const insurers: InsurerModel[] = [
  {
    id: 'demo-salud',
    name: 'Obra Social Demo Salud',
    authorizationSlaDays: { medication_supply: 5, procedure: 7, imaging: 7 },
    notes: 'Synthetic insurer for demos and tests. The only entry with SLA data.',
  },
  { id: 'omint', name: 'Omint' },
  { id: 'osde', name: 'OSDE' },
  { id: 'swiss-medical', name: 'Swiss Medical' },
  { id: 'galeno', name: 'Galeno' },
  { id: 'medicus', name: 'Medicus' },
  { id: 'sancor-salud', name: 'Sancor Salud' },
  { id: 'pami', name: 'PAMI' },
  { id: 'ioma', name: 'IOMA' },
];

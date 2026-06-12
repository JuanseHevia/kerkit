import { describe, expect, it } from 'vitest';
import {
  patientClassification,
  appointmentClassification,
  prescriptionClassification,
  noteClassification,
  authorizationClassification,
  checkpointClassification,
  institutionClassification,
  personClassification,
  signalClassification,
  userClassification,
} from './classifications.js';
import { extendClassification } from './classification.js';
import { fixtureEntities } from '../fixtures/persona.js';

// The compile-time guarantee is the mapped Classification<T> type; this is the
// runtime belt-and-suspenders: every field present on a full fixture entity
// must be classified.
const CASES = [
  ['user', userClassification],
  ['patient', patientClassification],
  ['insurer', institutionClassification],
  ['clinic', institutionClassification],
  ['imagingCenter', institutionClassification],
  ['doctor', personClassification],
  ['appointmentChemo', appointmentClassification],
  ['appointmentMri', appointmentClassification],
  ['prescription', prescriptionClassification],
  ['authorization', authorizationClassification],
  ['note', noteClassification],
  ['checkpoint', checkpointClassification],
  ['signal', signalClassification],
] as const;

describe('classification completeness', () => {
  it.each(CASES)('every field of fixture %s is classified', (fixtureName, classification) => {
    const entity = fixtureEntities[fixtureName] as Record<string, unknown>;
    const unclassified = Object.keys(entity).filter(
      (key) => !(key in (classification as Record<string, unknown>)),
    );
    expect(unclassified).toEqual([]);
  });
});

describe('extendClassification', () => {
  it('merges extension classifications over the base', () => {
    const extended = extendClassification(appointmentClassification, {
      copayArs: 'logistics',
    } as Record<'copayArs', 'logistics'>);
    expect(extended.copayArs).toBe('logistics');
    expect(extended.title).toBe('logistics');
  });
});

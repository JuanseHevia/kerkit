import { describe, expect, it } from 'vitest';
import { redactEntityForLlm, sweepText, SWEEP_PLACEHOLDER } from './redaction.js';
import { patientClassification, noteClassification } from './classifications.js';
import { fixturePatient, fixtureNote } from '../fixtures/persona.js';

// Reference identifier patterns (the real set ships in @kerkit/pack-argentina).
const AR_PATTERNS = [/\b\d{1,2}\.\d{3}\.\d{3}\b/, /\bDNI:?\s*\d{7,8}\b/i];

describe('redactEntityForLlm', () => {
  it('never lets direct identifiers through — the marketing-claim test', () => {
    const { redacted } = redactEntityForLlm(
      fixturePatient as unknown as Record<string, unknown>,
      patientClassification,
    );
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain('Marta');
    expect(serialized).not.toContain('Pérez');
    expect(serialized).not.toContain('12.345.678');
    expect(serialized).not.toContain('DEMO-0001-00');
  });

  it('replaces identifiers with placeholder tokens and keeps originals in the token map', () => {
    const { redacted, tokens } = redactEntityForLlm(
      fixturePatient as unknown as Record<string, unknown>,
      patientClassification,
    );
    expect(redacted.name).toBe('«NAME»');
    expect(redacted.nationalId).toBe('«NATIONAL_ID»');
    expect(tokens.get('«NAME»')).toBe('Marta Pérez');
    expect(tokens.get('«NATIONAL_ID»')).toBe('12.345.678');
  });

  it('omits sensitive-health fields unless explicitly allowed', () => {
    const closed = redactEntityForLlm(
      fixturePatient as unknown as Record<string, unknown>,
      patientClassification,
    );
    expect(closed.redacted.diagnosis).toBeUndefined();
    expect(closed.redacted.treatmentPhase).toBeUndefined();

    const optedIn = redactEntityForLlm(
      fixturePatient as unknown as Record<string, unknown>,
      patientClassification,
      { allowSensitiveFields: ['treatmentPhase'] },
    );
    expect(optedIn.redacted.treatmentPhase).toBe('Etapa II');
    expect(optedIn.redacted.diagnosis).toBeUndefined();
  });

  it('passes logistics fields through', () => {
    const { redacted } = redactEntityForLlm(
      fixturePatient as unknown as Record<string, unknown>,
      patientClassification,
    );
    expect(redacted.insurerId).toBe(fixturePatient.insurerId);
  });

  it('treats unclassified (consumer-extension) fields as sensitive — fail safe', () => {
    const extended = { ...fixturePatient, customField: 'something personal' };
    const { redacted } = redactEntityForLlm(
      extended as unknown as Record<string, unknown>,
      patientClassification,
    );
    expect(redacted.customField).toBeUndefined();
  });
});

describe('sweepText', () => {
  it('catches DNI-shaped identifiers inside free text', () => {
    const { redacted, tokens } = redactEntityForLlm(
      fixtureNote as unknown as Record<string, unknown>,
      noteClassification,
    );
    // Note content is logistics → passes structurally, but contains a DNI.
    const swept = sweepText(String(redacted.content), AR_PATTERNS, tokens);
    expect(swept.text).not.toContain('12.345.678');
    expect(swept.text).toContain(SWEEP_PLACEHOLDER);
    expect(swept.matches.length).toBeGreaterThan(0);
  });

  it('replaces known token-map values that leaked into free text', () => {
    const tokens = new Map([['«NAME»', 'Marta Pérez']]);
    const swept = sweepText('Llamar por el turno de Marta Pérez mañana', [], tokens);
    expect(swept.text).toBe('Llamar por el turno de «NAME» mañana');
  });

  it('leaves clean text untouched', () => {
    const swept = sweepText('Turno confirmado para el lunes a las 11', AR_PATTERNS);
    expect(swept.text).toBe('Turno confirmado para el lunes a las 11');
    expect(swept.matches).toHaveLength(0);
  });
});

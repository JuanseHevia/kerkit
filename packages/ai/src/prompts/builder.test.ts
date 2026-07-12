import { describe, expect, it } from 'vitest';
import { argentina } from '@kerkit/pack-argentina';
import { fixturePatient, RedactionSession } from '@kerkit/core';
import { buildPatientContextBlock, buildSystemPrompt } from './builder.js';

describe('buildSystemPrompt', () => {
  const prompt = buildSystemPrompt({
    pack: argentina,
    assistantName: 'Demo',
    caretakerName: 'Carlos',
    extraInstructions: 'Custom app instructions.',
  });

  it('always contains the non-removable privacy and boundary blocks', () => {
    expect(prompt).toContain(argentina.strings['prompt.privacy.neverAskIdentifiers']);
    expect(prompt).toContain(argentina.strings['prompt.privacy.dontEchoSensitive']);
    expect(prompt).toContain(argentina.strings['prompt.privacy.transparency']);
    expect(prompt).toContain(argentina.strings['prompt.boundaries.notMedicalAdvice']);
  });

  it('appends extra instructions after the conventions', () => {
    expect(prompt.indexOf('Custom app instructions.')).toBeGreaterThan(
      prompt.indexOf(argentina.strings['prompt.boundaries.notMedicalAdvice']),
    );
  });

  it('uses the pack tone', () => {
    expect(prompt).toContain(argentina.strings['prompt.tone.description']);
  });
});

describe('buildPatientContextBlock', () => {
  it('tokenizes identity and omits health fields by default', () => {
    const { block, tokens } = buildPatientContextBlock(fixturePatient, {
      insurerName: 'Obra Social Demo Salud',
      session: new RedactionSession({ patterns: argentina.identifierPatterns }),
    });
    expect(block).toContain('«PATIENT_NAME_1»');
    expect(block).not.toContain('Marta');
    expect(block).not.toContain('12.345.678');
    expect(block).not.toContain('Diagnóstico');
    expect(tokens.get('«PATIENT_NAME_1»')).toBe('Marta Pérez');
  });

  it('passes health fields only by written opt-in', () => {
    const { block } = buildPatientContextBlock(fixturePatient, {
      allowSensitiveFields: ['treatmentPhase'],
      session: new RedactionSession({ patterns: argentina.identifierPatterns }),
    });
    expect(block).toContain('Etapa actual: Etapa II');
    expect(block).not.toContain('Diagnóstico');
  });
});

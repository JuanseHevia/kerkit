import { describe, expect, it } from 'vitest';
import { COPY_KEYS, getCopy, sweepText, signalTypeEnum, SWEEP_PLACEHOLDER } from '@kerkit/core';
import { argentina } from './index.js';

describe('LocalePack conformance', () => {
  it('provides a string for every copy key', () => {
    const missing = COPY_KEYS.filter((key) => !argentina.strings[key]?.trim());
    expect(missing).toEqual([]);
  });

  it('declares es-AR and complete rules', () => {
    expect(argentina.locale).toBe('es-AR');
    expect(argentina.rules.prescriptionValidityDays).toBe(30);
    expect(argentina.rules.prescriptionAlertWindowDays).toBeGreaterThan(0);
    expect(argentina.rules.authorizationDeadlineHours).toBeGreaterThan(0);
  });

  it('getCopy resolves through the pack', () => {
    expect(getCopy(argentina, 'status.authorization.escalation')).toBe('Necesita atención');
    expect(getCopy(argentina, 'careEvent.ambulatory_medication')).toContain('hospital de día');
  });

  it('uses voseo, not tuteo, in prompt copy', () => {
    const promptCopy = [
      argentina.strings['prompt.tone.description'],
      argentina.strings['prompt.privacy.neverAskIdentifiers'],
      ...(argentina.prompts?.examples ?? []).map((e) => e.goodResponse),
    ].join(' ');
    // Voseo markers present…
    expect(promptCopy).toMatch(/\b(tenés|podés|querés|vos)\b/i);
    // …and no tuteo imperatives sneaking in.
    expect(promptCopy).not.toMatch(/\b(tienes|puedes|quieres)\b/i);
  });
});

describe('signal patterns', () => {
  it('every pattern compiles and uses a known signal type', () => {
    for (const p of argentina.signalPatterns ?? []) {
      expect(() => new RegExp(p.senderPattern, 'i')).not.toThrow();
      expect(() => new RegExp(p.subjectPattern, 'i')).not.toThrow();
      expect(signalTypeEnum.options).toContain(p.signalType);
      expect(p.suggestedActionTemplate.length).toBeGreaterThan(10);
    }
  });

  it('classifies representative obra social subjects', () => {
    const cases: Array<[sender: string, subject: string, expected: string]> = [
      ['autorizaciones@demosalud.example.com', 'Su autorización fue aprobada', 'auth_approved'],
      ['autorizaciones@demosalud.example.com', 'Autorización en preparación', 'auth_preparing'],
      ['farmacia@clinicademo.example.com', 'Medicación lista para retirar', 'med_ready_for_pickup'],
      ['prestaciones@demosalud.example.com', 'Falta documentación para su trámite', 'auth_docs_needed'],
      ['turnos@clinicademo.example.com', 'Recordatorio de turno', 'appointment_reminder'],
    ];

    for (const [sender, subject, expected] of cases) {
      const matches = (argentina.signalPatterns ?? [])
        .filter(
          (p) =>
            new RegExp(p.senderPattern, 'i').test(sender) &&
            new RegExp(p.subjectPattern, 'i').test(subject),
        )
        .sort((a, b) => b.priority - a.priority);
      expect(matches[0]?.signalType, `${sender} / ${subject}`).toBe(expected);
    }
  });

  it('does not reference any real institution in patterns or actions', () => {
    const all = JSON.stringify(argentina.signalPatterns);
    for (const real of ['omint', 'fleming', 'fleni', 'osde', 'scienza']) {
      expect(all.toLowerCase()).not.toContain(real);
    }
  });
});

describe('identifier patterns feed the redaction sweep', () => {
  const patterns = argentina.identifierPatterns ?? [];

  it.each([
    ['dotted DNI', 'La paciente Marta Pérez, DNI 12.345.678, prefiere turnos a la mañana'],
    ['labeled bare DNI', 'dni 12345678 para la credencial'],
    ['CUIL', 'CUIL 27-12345678-4 del titular'],
    ['labeled credential', 'credencial Nº 800-12345-01 de la obra social'],
  ])('redacts %s from free text', (_label, text) => {
    const swept = sweepText(text, patterns);
    expect(swept.text).toContain(SWEEP_PLACEHOLDER);
    expect(swept.text).not.toMatch(/\d{7,}/);
    expect(swept.text).not.toContain('12.345.678');
  });

  it('leaves ordinary logistics text alone', () => {
    const text = 'Turno el 10/2 a las 11:00 en Clínica Demo Centro, llevar análisis.';
    const swept = sweepText(text, patterns);
    expect(swept.text).toBe(text);
    expect(swept.matches).toHaveLength(0);
  });
});

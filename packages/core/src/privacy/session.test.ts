import { describe, expect, it, vi } from 'vitest';
import { RedactionSession } from './session.js';
import { redactEntityForLlm } from './redaction.js';
import { institutionClassification, signalClassification } from './classifications.js';

const AR_PATTERNS = [/\b\d{1,2}\.\d{3}\.\d{3}\b/, /\bDNI:?\s*\d{7,8}\b/i];
const NAME_CLS = { name: 'direct-identifier' } as const;

describe('RedactionSession — collision-safe tokens (bug 1)', () => {
  it('gives two different people two distinct, both-rehydratable tokens', () => {
    const s = new RedactionSession();
    const a = s.redactEntity({ name: 'Marta Pérez' }, NAME_CLS, { entityKind: 'person' });
    const b = s.redactEntity({ name: 'Carlos Pérez' }, NAME_CLS, { entityKind: 'person' });

    expect(a.redacted.name).toBe('«PERSON_NAME_1»');
    expect(b.redacted.name).toBe('«PERSON_NAME_2»');
    expect(a.redacted.name).not.toBe(b.redacted.name);

    const map = s.tokenToValue();
    expect(map.get('«PERSON_NAME_1»')).toBe('Marta Pérez');
    expect(map.get('«PERSON_NAME_2»')).toBe('Carlos Pérez'); // not clobbered — the old bug
  });

  it('dedups: the same value reuses the same token within a request', () => {
    const s = new RedactionSession();
    const a = s.redactEntity({ name: 'Marta Pérez' }, NAME_CLS, { entityKind: 'person' });
    const b = s.redactEntity({ name: 'Marta Pérez' }, NAME_CLS, { entityKind: 'person' });
    expect(a.redacted.name).toBe('«PERSON_NAME_1»');
    expect(b.redacted.name).toBe('«PERSON_NAME_1»');
  });
});

describe('RedactionSession — sweep', () => {
  it('replaces known values longest-first (full name beats first name)', () => {
    const s = new RedactionSession({ patterns: AR_PATTERNS });
    s.redactEntity(
      { full: 'Marta Pérez', first: 'Marta' },
      { full: 'direct-identifier', first: 'direct-identifier' },
    );
    const swept = s.sweep('Nota sobre Marta Pérez y su turno');
    expect(swept).toContain('«FULL_1»');
    expect(swept).not.toContain('Marta');
  });

  it('adopts seeded tokens so a name minted elsewhere still sweeps', () => {
    const s = new RedactionSession({ seedTokens: new Map([['«NAME_X»', 'Marta Pérez']]) });
    expect(s.sweep('turno de Marta Pérez')).toBe('turno de «NAME_X»');
  });

  it('still catches regex-matchable identifiers in free text', () => {
    const s = new RedactionSession({ patterns: AR_PATTERNS });
    const swept = s.sweep('Mamá (DNI 12.345.678) prefiere la mañana');
    expect(swept).not.toContain('12.345.678');
  });

  it('fails closed: a throwing sweep drops the text to a placeholder, loudly', () => {
    const boom = { source: '(', flags: '' } as unknown as RegExp; // invalid → RegExp() throws
    const s = new RedactionSession({ patterns: [boom] });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = s.sweep('anything at all');
    expect(out).toBe('«REDACTADO»');
    expect(out).not.toContain('anything');
    expect(spy).toHaveBeenCalled();
    expect(s.explain().failClosed).toBe(1);
    spy.mockRestore();
  });
});

describe('RedactionSession — A7 contact policy', () => {
  const inst = {
    id: 'i1',
    name: 'Clínica Demo',
    type: 'clinic',
    address: 'Av. Corrientes 1234',
    phone: '11-5555-5555',
    email: 'info@clinica.test',
    createdAt: new Date('2026-01-05T00:00:00Z'),
  };

  it('passes contact fields through by default (assistant stays useful)', () => {
    const s = new RedactionSession();
    const { redacted } = s.redactEntity(inst, institutionClassification, { entityKind: 'institution' });
    expect(redacted.phone).toBe('11-5555-5555');
    expect(redacted.email).toBe('info@clinica.test');
  });

  it('tokenizes contact fields when pseudonymizeContacts is on', () => {
    const s = new RedactionSession({ policy: { pseudonymizeContacts: true } });
    const { redacted } = s.redactEntity(inst, institutionClassification, { entityKind: 'institution' });
    expect(String(redacted.phone)).toMatch(/«INSTITUTION_PHONE_\d+»/);
    expect(redacted.phone).not.toBe('11-5555-5555');
  });
});

describe('Signal.sender reclassification (A7 always-on)', () => {
  it('tokenizes the inbound insurer address', () => {
    expect(signalClassification.sender).toBe('direct-identifier');
    const { redacted } = redactEntityForLlm(
      { sender: 'comunicaciones@obra.test' } as Record<string, unknown>,
      signalClassification,
    );
    expect(redacted.sender).toBe('«SENDER»');
  });
});

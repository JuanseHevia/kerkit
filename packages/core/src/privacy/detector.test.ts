import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import type { Classification } from './classification.js';
import {
  detectPiiSpans,
  normalizeForPii,
  replacePiiSpans,
  resolvePiiSpans,
  type PiiPattern,
} from './detector.js';
import { redactEntityForLlm, SWEEP_PLACEHOLDER } from './redaction.js';
import { RedactionSession } from './session.js';

const DNI: PiiPattern = {
  id: 'test-dni',
  type: 'dni',
  confidence: 'high',
  pattern: /DNI\s*:?\s*\d{8}/i,
};

describe('PII normalization and spans', () => {
  it('normalizes NFKC and removes zero-width text with source offsets', () => {
    const source = 'x DNI １２\u200B３４５６７８ y';
    const normalized = normalizeForPii(source);
    expect(normalized.text).toBe('x DNI 12345678 y');
    const spans = detectPiiSpans(source, [DNI]);
    expect(source.slice(spans[0].start, spans[0].end)).toBe('DNI １２\u200B３４５６７８');
    expect(replacePiiSpans(source, spans, SWEEP_PLACEHOLDER)).toBe(`x ${SWEEP_PLACEHOLDER} y`);
  });

  it('applies NFKC across combining grapheme sequences', () => {
    const source = 'Cafe\u0301';
    const normalized = normalizeForPii(source);
    expect(normalized.text).toBe('Café');
    expect(normalized.offsets.at(-1)).toEqual({ start: 3, end: 5 });
  });

  it('removes intra-identifier digit spacing while retaining the original span', () => {
    const source = 'CUIL 2 0 - 1 2 3 4 5 6 7 8 - 6';
    const normalized = normalizeForPii(source);
    expect(normalized.text).toBe('CUIL 20 - 12345678 - 6');
    expect(normalized.offsets.at(-1)?.end).toBe(source.length);
  });

  it('resolves overlaps by confidence, then longest span', () => {
    const spans = resolvePiiSpans([
      { start: 0, end: 12, type: 'unknown', confidence: 'heuristic' },
      { start: 4, end: 12, type: 'dni', confidence: 'high' },
      { start: 20, end: 24, type: 'unknown', confidence: 'high' },
      { start: 20, end: 26, type: 'email', confidence: 'high' },
    ]);
    expect(spans).toEqual([
      { start: 4, end: 12, type: 'dni', confidence: 'high' },
      { start: 20, end: 26, type: 'email', confidence: 'high' },
    ]);
  });

  it('preserves valid source ranges for arbitrary Unicode input', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const normalized = normalizeForPii(value);
        return normalized.offsets.every(
          (offset) => offset.start >= 0 && offset.end > offset.start && offset.end <= value.length,
        );
      }),
    );
  });
});

describe('structural redaction properties', () => {
  it('never leaves a direct identifier in serialized output', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (identifier) => {
        const entity = { identifier };
        const classification: Classification<typeof entity> = {
          identifier: 'direct-identifier',
        };
        const result = redactEntityForLlm(entity, classification);
        return !Object.values(result.redacted).some((value) => value === identifier);
      }),
      { numRuns: 200 },
    );
  });

  it('keeps tokens unique for distinct values and deduplicates repeats', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 2 }), { minLength: 2, maxLength: 8 }),
        (values) => {
          const session = new RedactionSession();
          const tokens = values.map(
            (name) => session.redactEntity({ name }, { name: 'direct-identifier' }).redacted.name,
          );
          const repeated = session.redactEntity(
            { name: values[0] },
            { name: 'direct-identifier' },
          ).redacted.name;
          return new Set(tokens).size === values.length && repeated === tokens[0];
        },
      ),
      { numRuns: 200 },
    );
  });

  it('neutralizes arbitrary token-shaped user input', () => {
    fc.assert(
      fc.property(fc.string().map((value) => value.replace(/[«»]/g, '')), (value) => {
        const session = new RedactionSession();
        const swept = session.sweep(`prefix «${value}» suffix`);
        return !swept.includes('«') && !swept.includes('»');
      }),
      { numRuns: 200 },
    );
  });

  it('supports async detectors and fails closed when one rejects', async () => {
    const session = new RedactionSession({
      detectors: [{ detect: async () => [{ start: 0, end: 6, type: 'unknown', confidence: 'high' }] }],
    });
    expect(await session.sweepAsync('secret value')).toBe(`${SWEEP_PLACEHOLDER} value`);

    const broken = new RedactionSession({ detectors: [{ detect: async () => { throw new Error('boom'); } }] });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await broken.sweepAsync('raw secret')).toBe(SWEEP_PLACEHOLDER);
    expect(broken.explain().failClosed).toBe(1);
    spy.mockRestore();
  });
});

import { describe, expect, it } from 'vitest';
import { detectPiiSpans } from '@kerkit/core';
import { identifierPatterns, isValidCuilCuit } from './identifiers.js';
import { ARGENTINA_PII_CORPUS_VERSION, argentinaPiiCorpusV1 } from './pii-corpus.js';

function masked(value: string): string {
  return value.replace(/[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/g, '*').slice(0, 48);
}

describe(`Argentina PII corpus ${ARGENTINA_PII_CORPUS_VERSION}`, () => {
  it('has 20–30 synthetic adversarial cases', () => {
    expect(argentinaPiiCorpusV1.length).toBeGreaterThanOrEqual(20);
    expect(argentinaPiiCorpusV1.length).toBeLessThanOrEqual(30);
  });

  it('gates high-confidence recall at 100%', () => {
    const misses = argentinaPiiCorpusV1
      .filter((entry) => entry.shouldDetect && entry.confidence === 'high')
      .filter((entry) => !detectPiiSpans(entry.input, identifierPatterns).some((span) => span.type === entry.type))
      .map((entry) => `${entry.id}: ${masked(entry.input)}`);
    expect(misses, `High-confidence detector misses:\n${misses.join('\n')}`).toEqual([]);
  });

  it('tracks heuristic recall and false positives', () => {
    const heuristicMisses = argentinaPiiCorpusV1
      .filter((entry) => entry.shouldDetect && entry.confidence === 'heuristic')
      .filter((entry) => !detectPiiSpans(entry.input, identifierPatterns).some((span) => span.type === entry.type));
    const falsePositives = argentinaPiiCorpusV1
      .filter((entry) => !entry.shouldDetect)
      .filter((entry) => detectPiiSpans(entry.input, identifierPatterns).length > 0);
    expect(heuristicMisses.map((entry) => entry.id)).toEqual([]);
    expect(falsePositives.map((entry) => entry.id)).toEqual([]);
  });

  it('validates the synthetic CUIL check digit', () => {
    expect(isValidCuilCuit('20-12345678-6')).toBe(true);
    expect(isValidCuilCuit('20-12345678-3')).toBe(false);
  });
});

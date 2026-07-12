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

  it('reports heuristic recall and false positives without gating', () => {
    const heuristicCases = argentinaPiiCorpusV1.filter(
      (entry) => entry.shouldDetect && entry.confidence === 'heuristic',
    );
    const heuristicMisses = argentinaPiiCorpusV1
      .filter((entry) => entry.shouldDetect && entry.confidence === 'heuristic')
      .filter((entry) => !detectPiiSpans(entry.input, identifierPatterns).some((span) => span.type === entry.type));
    const falsePositives = argentinaPiiCorpusV1
      .filter((entry) => !entry.shouldDetect)
      .filter((entry) => detectPiiSpans(entry.input, identifierPatterns).length > 0);
    const negativeCases = argentinaPiiCorpusV1.filter((entry) => !entry.shouldDetect);
    const recall = (heuristicCases.length - heuristicMisses.length) / heuristicCases.length;
    const falsePositiveRate = falsePositives.length / negativeCases.length;
    console.info(
      `[${ARGENTINA_PII_CORPUS_VERSION}] heuristic recall=${recall.toFixed(3)} ` +
        `false-positive-rate=${falsePositiveRate.toFixed(3)} ` +
        `misses=${heuristicMisses.map((entry) => entry.id).join(',') || 'none'} ` +
        `false-positives=${falsePositives.map((entry) => entry.id).join(',') || 'none'}`,
    );
    expect(Number.isFinite(recall)).toBe(true);
    expect(Number.isFinite(falsePositiveRate)).toBe(true);
  });

  it('validates the synthetic CUIL check digit', () => {
    expect(isValidCuilCuit('20-12345678-6')).toBe(true);
    expect(isValidCuilCuit('20-12345678-3')).toBe(false);
  });
});

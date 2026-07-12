export type PiiType =
  | 'dni'
  | 'cuil-cuit'
  | 'phone'
  | 'email'
  | 'address'
  | 'credential'
  | 'unknown';

export type PiiConfidence = 'high' | 'heuristic';

export interface PiiSpan {
  start: number;
  end: number;
  type: PiiType;
  confidence: PiiConfidence;
  patternId?: string;
}

export interface PiiPattern {
  id: string;
  type: PiiType;
  confidence: PiiConfidence;
  pattern: RegExp;
  /** Optional semantic validation, e.g. the CUIL/CUIT mod-11 check digit. */
  validate?: (match: string) => boolean;
}

export interface PiiDetector {
  detect(text: string): PiiSpan[] | Promise<PiiSpan[]>;
}

export interface PiiCorpusCase {
  id: string;
  input: string;
  type?: PiiType;
  confidence?: PiiConfidence;
  shouldDetect: boolean;
}

export interface NormalizedText {
  text: string;
  /** For every normalized UTF-16 code unit, the source range it came from. */
  offsets: Array<{ start: number; end: number }>;
}

const INVISIBLE_OR_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/u;

/**
 * Normalize adversarial text without losing the ability to replace the exact
 * original span. NFKC is applied per code point, controls/zero-width marks are
 * removed, and whitespace runs collapse to one ASCII space.
 */
export function normalizeForPii(text: string): NormalizedText {
  let normalized = '';
  const offsets: NormalizedText['offsets'] = [];
  let pendingSpace: { start: number; end: number } | undefined;
  const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text);

  for (const { segment, index } of graphemes) {
    const start = index;
    const end = index + segment.length;
    const piece = segment.normalize('NFKC');

    for (const char of piece) {
      if (INVISIBLE_OR_CONTROL.test(char)) continue;
      if (/\s/u.test(char)) {
        pendingSpace = pendingSpace
          ? { start: pendingSpace.start, end }
          : { start, end };
        continue;
      }
      if (pendingSpace && normalized.length > 0) {
        normalized += ' ';
        offsets.push(pendingSpace);
      }
      pendingSpace = undefined;
      normalized += char;
      for (let i = 0; i < char.length; i += 1) offsets.push({ start, end });
    }
  }

  // Remove whitespace inserted inside a run of digits (common OCR/copy-paste
  // obfuscation: `1 2 3 4 5 6 7 8`). The neighboring digit offsets still
  // bound the exact original span, including the removed whitespace.
  let compacted = '';
  const compactedOffsets: NormalizedText['offsets'] = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char === ' ' && /\d/u.test(normalized[i - 1] ?? '') && /\d/u.test(normalized[i + 1] ?? '')) {
      continue;
    }
    compacted += char;
    compactedOffsets.push(offsets[i]);
  }

  return { text: compacted, offsets: compactedOffsets };
}

function globalPattern(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
}

export function detectPiiSpans(text: string, patterns: readonly PiiPattern[]): PiiSpan[] {
  const normalized = normalizeForPii(text);
  const spans: PiiSpan[] = [];

  for (const definition of patterns) {
    const regex = globalPattern(definition.pattern);
    for (const match of normalized.text.matchAll(regex)) {
      const value = match[0];
      const index = match.index ?? -1;
      if (index < 0 || value.length === 0 || definition.validate?.(value) === false) continue;
      const first = normalized.offsets[index];
      const last = normalized.offsets[index + value.length - 1];
      if (!first || !last) continue;
      spans.push({
        start: first.start,
        end: last.end,
        type: definition.type,
        confidence: definition.confidence,
        patternId: definition.id,
      });
    }
  }

  return resolvePiiSpans(spans);
}

/** Higher confidence wins, then longest span, then earliest source position. */
export function resolvePiiSpans(spans: readonly PiiSpan[]): PiiSpan[] {
  const ranked = [...spans].sort((a, b) => {
    const confidence = Number(b.confidence === 'high') - Number(a.confidence === 'high');
    if (confidence !== 0) return confidence;
    const length = b.end - b.start - (a.end - a.start);
    if (length !== 0) return length;
    return a.start - b.start || a.end - b.end;
  });
  const accepted: PiiSpan[] = [];
  for (const span of ranked) {
    if (span.start < 0 || span.end <= span.start) continue;
    if (accepted.some((other) => span.start < other.end && other.start < span.end)) continue;
    accepted.push(span);
  }
  return accepted.sort((a, b) => a.start - b.start || a.end - b.end);
}

export function replacePiiSpans(text: string, spans: readonly PiiSpan[], placeholder: string): string {
  let result = text;
  for (const span of [...spans].sort((a, b) => b.start - a.start)) {
    result = `${result.slice(0, span.start)}${placeholder}${result.slice(span.end)}`;
  }
  return result;
}

export class RegexPiiDetector implements PiiDetector {
  constructor(readonly patterns: readonly PiiPattern[]) {}

  detect(text: string): PiiSpan[] {
    return detectPiiSpans(text, this.patterns);
  }
}

export function coercePiiPatterns(patterns: readonly (PiiPattern | RegExp)[]): PiiPattern[] {
  return patterns.map((entry, index) =>
    entry instanceof RegExp
      ? {
          id: `legacy-${index + 1}`,
          type: 'unknown',
          confidence: 'heuristic',
          pattern: entry,
        }
      : entry,
  );
}

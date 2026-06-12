import type { Classification, DataClass } from './classification.js';

export interface RedactEntityOptions<T> {
  /**
   * Fields classified 'sensitive-health' that this call explicitly allows
   * through. The opt-in lives in consumer code on purpose: the decision to
   * send health data to an LLM should be written down and reviewable.
   */
  allowSensitiveFields?: readonly (keyof T & string)[];
}

export interface RedactionResult {
  /** The entity with restricted fields replaced/omitted. Safe for LLM context. */
  redacted: Record<string, unknown>;
  /** placeholder token → original value, for app-side rehydration in UI. */
  tokens: Map<string, string>;
}

function placeholderFor(field: string): string {
  return `«${field.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()}»`;
}

/**
 * Structural redaction pass. Fields not present in the classification —
 * e.g. consumer extensions that forgot to classify — are treated as
 * 'sensitive-health': extensions fail safe, not open.
 *
 * - direct-identifier → placeholder token, original kept in the token map
 * - sensitive-health  → omitted unless explicitly allowed
 * - logistics/public  → passed through
 */
export function redactEntityForLlm<T extends Record<string, unknown>>(
  entity: T,
  classification: Classification<T>,
  options: RedactEntityOptions<T> = {},
): RedactionResult {
  const allow = new Set<string>(options.allowSensitiveFields ?? []);
  const redacted: Record<string, unknown> = {};
  const tokens = new Map<string, string>();

  for (const [field, value] of Object.entries(entity)) {
    if (value === undefined || value === null) continue;

    const cls: DataClass =
      (classification as Record<string, DataClass>)[field] ?? 'sensitive-health';

    switch (cls) {
      case 'direct-identifier': {
        const token = placeholderFor(field);
        tokens.set(token, String(value));
        redacted[field] = token;
        break;
      }
      case 'sensitive-health': {
        if (allow.has(field)) redacted[field] = value;
        break;
      }
      case 'logistics':
      case 'public':
        redacted[field] = value;
        break;
    }
  }

  return { redacted, tokens };
}

export interface SweepResult {
  text: string;
  /** The original strings that were redacted, for logging/inspection by the app. */
  matches: string[];
}

export const SWEEP_PLACEHOLDER = '«REDACTADO»';

/**
 * Belt-and-suspenders regex pass over assembled free text (note contents,
 * email subjects) using identifier patterns from the active locale pack —
 * catches PII that structural classification can't see inside free text.
 * Also replaces any known token-map values that leaked into free text.
 */
export function sweepText(
  text: string,
  patterns: readonly RegExp[],
  knownValues: ReadonlyMap<string, string> = new Map(),
): SweepResult {
  let swept = text;
  const matches: string[] = [];

  for (const [token, value] of knownValues) {
    if (value.length === 0) continue;
    if (swept.includes(value)) {
      matches.push(value);
      swept = swept.split(value).join(token);
    }
  }

  for (const pattern of patterns) {
    const global = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g',
    );
    swept = swept.replace(global, (match) => {
      matches.push(match);
      return SWEEP_PLACEHOLDER;
    });
  }

  return { text: swept, matches };
}

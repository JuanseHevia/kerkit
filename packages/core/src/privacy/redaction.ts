import type { Classification, DataClass } from './classification.js';
import { coercePiiPatterns, detectPiiSpans, replacePiiSpans, type PiiPattern } from './detector.js';

export interface RedactEntityOptions<T> {
  /**
   * Fields classified 'sensitive-health' that this call explicitly allows
   * through. The opt-in lives in consumer code on purpose: the decision to
   * send health data to an LLM should be written down and reviewable.
   */
  allowSensitiveFields?: readonly (keyof T & string)[];
  /**
   * Collision-safe token allocator, supplied by a `RedactionSession`. Given the
   * field name and its stringified value, returns the placeholder to use. When
   * omitted, the field-name-derived `placeholderFor` is used (fine for a single
   * entity; a session is required to keep tokens unique across many entities).
   */
  allocateToken?: (field: string, value: string) => string;
  /**
   * 'logistics' fields to tokenize as if they were `direct-identifier` — the
   * mechanism behind the session's opt-in `pseudonymizeContacts` policy. Bare
   * classification can't say "this `phone` is a clinic phone"; the caller (which
   * knows the entity kind) decides.
   */
  pseudonymizeFields?: readonly (keyof T & string)[];
}

export interface RedactionResult {
  /** The entity with restricted fields replaced/omitted. Safe for LLM context. */
  redacted: Record<string, unknown>;
  /** placeholder token → original value, for app-side rehydration in UI. */
  tokens: Map<string, string>;
}

/**
 * The upper-snake base of a token, derived from a field name:
 * `nationalId` → `NATIONAL_ID`. Exported so a `RedactionSession` can build
 * collision-safe variants like `«PERSON_NAME_1»` from the same base.
 */
export function tokenBaseName(field: string): string {
  return field.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

function placeholderFor(field: string): string {
  return `«${tokenBaseName(field)}»`;
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
  const pseudonymize = new Set<string>(options.pseudonymizeFields ?? []);
  const mint = options.allocateToken ?? ((field: string, _value: string) => placeholderFor(field));
  const redacted: Record<string, unknown> = {};
  const tokens = new Map<string, string>();

  const tokenize = (field: string, value: unknown) => {
    const token = mint(field, String(value));
    tokens.set(token, String(value));
    redacted[field] = token;
  };

  for (const [field, value] of Object.entries(entity)) {
    if (value === undefined || value === null) continue;

    const cls: DataClass =
      (classification as Record<string, DataClass>)[field] ?? 'sensitive-health';

    switch (cls) {
      case 'direct-identifier': {
        tokenize(field, value);
        break;
      }
      case 'sensitive-health': {
        if (allow.has(field)) redacted[field] = value;
        break;
      }
      case 'logistics':
        // Opt-in policy (pseudonymizeContacts): tokenize contact fields the
        // caller marked, otherwise pass through.
        if (pseudonymize.has(field)) tokenize(field, value);
        else redacted[field] = value;
        break;
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
  patterns: readonly (PiiPattern | RegExp)[],
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

  const spans = detectPiiSpans(swept, coercePiiPatterns(patterns));
  for (const span of spans) matches.push(swept.slice(span.start, span.end));
  swept = replacePiiSpans(swept, spans, SWEEP_PLACEHOLDER);

  return { text: swept, matches };
}

import type { Classification } from './classification.js';
import {
  redactEntityForLlm,
  sweepText,
  tokenBaseName,
  SWEEP_PLACEHOLDER,
  type RedactionResult,
} from './redaction.js';

/**
 * Per-request redaction policy. Kept tiny on purpose — the one knob that
 * changes behavior is whether contact fields (a clinic's phone/email/address)
 * are tokenized. Off by default: contact info is the payload of a logistics
 * assistant, and a clinic's phone is public, not patient PHI.
 */
export interface RedactionPolicy {
  /**
   * When true, Person/Institution `phone`/`email`/`address` are tokenized like
   * direct identifiers. Default false (they pass through, keeping the assistant
   * able to answer "what's the clinic's number?"). See the mosaic-risk note in
   * the privacy docs.
   */
  pseudonymizeContacts: boolean;
}

export const DEFAULT_REDACTION_POLICY: RedactionPolicy = {
  pseudonymizeContacts: false,
};

/** Contact fields gated by `pseudonymizeContacts`, per entity kind. */
const CONTACT_FIELDS: Record<string, readonly string[]> = {
  person: ['phone', 'email'],
  institution: ['phone', 'email', 'address'],
};

/** Known values shorter than this are not used as sweep needles (a 1-char value
 *  would shred unrelated text). Structured fields are still tokenized regardless. */
const MIN_SWEEP_LEN = 2;

const TOKEN_SHAPE = /«[^»]*»/g;

export interface RedactionFinding {
  /** A placeholder token that was allocated, and where it came from. */
  token: string;
  value: string;
  source: string;
}

export interface RedactionExplain {
  /** Every token allocated this request, for UI rehydration + debugging. */
  tokensAllocated: RedactionFinding[];
  /** Total free-text sweep matches across every `sweep()` call. */
  sweptMatches: number;
  /** Times a sweep threw and the text was dropped to a hard placeholder. */
  failClosed: number;
}

export interface RedactionSessionOptions {
  /** Locale identifier patterns for the free-text sweep pass. */
  patterns?: readonly RegExp[];
  /** Contact policy; merged over the default (off). */
  policy?: Partial<RedactionPolicy>;
  /**
   * Existing token→value bindings to adopt (e.g. `buildPatientContextBlock`'s
   * tokens), so a name minted before this session still gets swept from free
   * text. Prefer threading the session itself; this is the seam for callers
   * that already hold a token map.
   */
  seedTokens?: ReadonlyMap<string, string>;
}

/**
 * Request-scoped redaction state: one collision-safe token allocator and one
 * accumulated known-value map, shared across context assembly, tool output, and
 * the provider sink so the same real value always maps to the same token.
 *
 * Two maps, deliberately: `valueToToken` (internal, for dedup + sweep) and
 * `tokenToValue` (public, for UI rehydration).
 */
export class RedactionSession {
  readonly policy: RedactionPolicy;
  private readonly patterns: readonly RegExp[];
  private readonly valueToToken = new Map<string, string>();
  private readonly tokenToValueMap = new Map<string, string>();
  private readonly counters = new Map<string, number>();
  private readonly findings: RedactionFinding[] = [];
  private sweptMatches = 0;
  private failClosed = 0;

  constructor(options: RedactionSessionOptions = {}) {
    this.patterns = options.patterns ?? [];
    this.policy = { ...DEFAULT_REDACTION_POLICY, ...options.policy };
    if (options.seedTokens) {
      for (const [token, value] of options.seedTokens) {
        if (value.length === 0) continue;
        this.tokenToValueMap.set(token, value);
        this.valueToToken.set(value, token);
      }
    }
  }

  /**
   * Allocate a collision-safe token for a value: the same value always returns
   * the same token within the request; distinct values get distinct tokens
   * (`«PERSON_NAME_1»`, `«PERSON_NAME_2»`, …). Bound to `redactEntity` via the
   * `allocateToken` seam.
   */
  private allocate = (field: string, value: string, entityKind?: string): string => {
    const existing = this.valueToToken.get(value);
    if (existing) return existing;
    const base = entityKind
      ? `${entityKind.toUpperCase()}_${tokenBaseName(field)}`
      : tokenBaseName(field);
    const n = (this.counters.get(base) ?? 0) + 1;
    this.counters.set(base, n);
    const token = `«${base}_${n}»`;
    this.valueToToken.set(value, token);
    this.tokenToValueMap.set(token, value);
    this.findings.push({ token, value, source: entityKind ?? field });
    return token;
  };

  /**
   * Structural redaction routed through the shared allocator, plus the A7
   * contact policy: pass `entityKind` ('person' | 'institution' | …) so
   * `pseudonymizeContacts` can be applied.
   */
  redactEntity<T extends Record<string, unknown>>(
    entity: T,
    classification: Classification<T>,
    opts: {
      entityKind?: string;
      allowSensitiveFields?: readonly (keyof T & string)[];
    } = {},
  ): RedactionResult {
    const pseudonymizeFields =
      this.policy.pseudonymizeContacts && opts.entityKind
        ? ((CONTACT_FIELDS[opts.entityKind] ?? []) as readonly (keyof T & string)[])
        : [];
    return redactEntityForLlm(entity, classification, {
      allowSensitiveFields: opts.allowSensitiveFields,
      pseudonymizeFields,
      allocateToken: (f, v) => this.allocate(f, v, opts.entityKind),
    });
  }

  /**
   * Make free text safe for the provider: neutralize foreign token-shaped
   * substrings, replace known values (longest-first) with their tokens, then
   * run the locale patterns. Fail-closed: if anything throws, the whole string
   * is dropped to a hard placeholder rather than sent raw.
   */
  sweep(text: string): string {
    try {
      const escaped = this.escapeForeignTokens(text);
      const known = new Map(
        [...this.tokenToValueMap.entries()]
          .filter(([, value]) => value.length >= MIN_SWEEP_LEN)
          .sort((a, b) => b[1].length - a[1].length),
      );
      const result = sweepText(escaped, this.patterns, known);
      this.sweptMatches += result.matches.length;
      return result.text;
    } catch (err) {
      this.failClosed += 1;
      // Never emit raw; but never silent either — the developer needs a thread.
      console.error(
        '[KRK_SWEEP_THROW] kerkit: redaction sweep failed, output dropped to placeholder',
        err,
      );
      return SWEEP_PLACEHOLDER;
    }
  }

  /** token → original value, for app-side UI rehydration. */
  tokenToValue(): ReadonlyMap<string, string> {
    return this.tokenToValueMap;
  }

  /** Inspect what the session did — the sink's equivalent of `assemble().explain()`. */
  explain(): RedactionExplain {
    return {
      tokensAllocated: [...this.findings],
      sweptMatches: this.sweptMatches,
      failClosed: this.failClosed,
    };
  }

  /**
   * Debug helper: does `value` match any known value or locale pattern? Turns
   * "why didn't the session catch this name?" (answer: it was never registered)
   * into a one-line check.
   */
  debugValue(value: string): { knownValue: boolean; patternMatch: boolean } {
    return {
      knownValue: this.valueToToken.has(value),
      patternMatch: this.patterns.some((p) => new RegExp(p.source, p.flags).test(value)),
    };
  }

  /** Replace `«…»` substrings that are NOT our tokens, so foreign token-shaped
   *  input can't survive as (or poison) a real placeholder on rehydration. */
  private escapeForeignTokens(text: string): string {
    return text.replace(TOKEN_SHAPE, (match) =>
      this.tokenToValueMap.has(match) ? match : match.replace('«', '⟪').replace('»', '⟫'),
    );
  }
}

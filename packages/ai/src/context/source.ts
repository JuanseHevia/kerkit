import type { Classification } from '@kerkit/core';

/**
 * A context source: fetches one slice of the caretaker's world and declares
 * how it must be redacted and rendered. Sources can NOT bypass redaction —
 * the assembler applies it between fetch and format.
 */
export interface ContextSource<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Stable key, used in explain() output. */
  key: string;
  /** Section heading as it appears in the prompt (resolve via your locale pack). */
  heading: string;
  /** Lower renders earlier in the context block. */
  priority: number;
  /** Max items included; extra fetched items are dropped (and reported by explain()). */
  maxItems: number;
  fetch(userId: string): Promise<T[]>;
  classification: Classification<T>;
  /**
   * 'sensitive-health' fields this source explicitly sends to the LLM.
   * The opt-in is per-source and lives in code, on purpose.
   */
  allowSensitiveFields?: readonly (keyof T & string)[];
  /** Render one redacted item as a single line. */
  formatItem(redacted: Record<string, unknown>): string;
}

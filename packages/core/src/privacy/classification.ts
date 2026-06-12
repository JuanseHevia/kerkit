/**
 * Data classification levels, ordered from most to least restricted:
 *
 * - 'direct-identifier': identifies the patient or caretaker (name, national
 *   id, credential number). NEVER reaches an LLM; replaced by a placeholder
 *   token at the redaction boundary.
 * - 'sensitive-health': health status information (diagnosis, treatment
 *   phase). Reaches an LLM only with an explicit per-field opt-in written in
 *   consumer code.
 * - 'logistics': caretaker-authored operational data (titles, dates, notes
 *   content, ids). Passes to the LLM; free text is additionally covered by
 *   the regex sweep pass.
 * - 'public': non-personal data (timestamps, enum values).
 */
export type DataClass = 'direct-identifier' | 'sensitive-health' | 'logistics' | 'public';

/**
 * Every field of an entity must be classified — the mapped type makes a
 * missing field a compile error, which is the real "classification
 * completeness" gate. Runtime tests double-check via fixtures.
 */
export type Classification<T> = {
  [K in keyof T & string]-?: DataClass;
};

/** Extend a base classification with classifications for consumer-added fields. */
export function extendClassification<T, E>(
  base: Classification<T>,
  extension: Classification<E>,
): Classification<T> & Classification<E> {
  return { ...base, ...extension } as Classification<T> & Classification<E>;
}

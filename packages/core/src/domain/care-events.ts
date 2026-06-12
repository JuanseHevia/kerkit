/**
 * The taxonomy of events a caretaker schedules during a treatment.
 * Extracted from a real chemotherapy treatment in Argentina's obra social
 * system; the metadata answers the questions a caretaker app actually asks:
 * "does this need an authorization first?", "will there be a result document
 * to chase?", "does the patient need to prepare?".
 */
export interface CareEventKindMeta {
  /** Stable copy key for the kind's display label (resolved via a locale pack). */
  labelKey: string;
  /** Whether this kind typically requires prior insurer authorization. */
  requiresAuthorization: boolean;
  /** Whether the patient typically needs preparation (fasting, contrast, etc.). */
  requiresPrep: boolean;
  /** Whether the event typically produces a result document worth tracking. */
  generatesResultDocument: boolean;
  /** Rough typical duration, for calendar affordances. */
  typicalDurationMinutes?: number;
}

export const CARE_EVENT_KINDS = {
  /** Chemotherapy session at the treatment center. */
  chemo: {
    labelKey: 'careEvent.chemo',
    requiresAuthorization: true,
    requiresPrep: true,
    generatesResultDocument: false,
    typicalDurationMinutes: 240,
  },
  /** Imaging study: MRI, CT, PET. */
  imaging: {
    labelKey: 'careEvent.imaging',
    requiresAuthorization: true,
    requiresPrep: true,
    generatesResultDocument: true,
    typicalDurationMinutes: 60,
  },
  /** Doctor's consultation. */
  consultation: {
    labelKey: 'careEvent.consultation',
    requiresAuthorization: false,
    requiresPrep: false,
    generatesResultDocument: false,
    typicalDurationMinutes: 30,
  },
  /** Medical procedure. */
  procedure: {
    labelKey: 'careEvent.procedure',
    requiresAuthorization: true,
    requiresPrep: true,
    generatesResultDocument: true,
  },
  /** Laboratory tests. */
  lab: {
    labelKey: 'careEvent.lab',
    requiresAuthorization: false,
    requiresPrep: true,
    generatesResultDocument: true,
    typicalDurationMinutes: 30,
  },
  /** Medication application at the ambulatory hospital (e.g. injections between cycles). */
  ambulatory_medication: {
    labelKey: 'careEvent.ambulatory_medication',
    requiresAuthorization: true,
    requiresPrep: false,
    generatesResultDocument: false,
    typicalDurationMinutes: 90,
  },
  other: {
    labelKey: 'careEvent.other',
    requiresAuthorization: false,
    requiresPrep: false,
    generatesResultDocument: false,
  },
} as const satisfies Record<string, CareEventKindMeta>;

export type DefaultCareEventKindId = keyof typeof CARE_EVENT_KINDS;

/**
 * Open union: the default kinds autocomplete, but consumers can register
 * their own ids (declare metadata for them via `resolveCareEventKind`'s
 * `extra` argument).
 */
export type CareEventKindId = DefaultCareEventKindId | (string & {});

export function resolveCareEventKind(
  kind: CareEventKindId,
  extra?: Record<string, CareEventKindMeta>,
): CareEventKindMeta {
  const known = (extra ?? {})[kind] ?? (CARE_EVENT_KINDS as Record<string, CareEventKindMeta>)[kind];
  return known ?? CARE_EVENT_KINDS.other;
}

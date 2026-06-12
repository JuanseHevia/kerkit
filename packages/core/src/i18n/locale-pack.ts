import type { SignalType } from '../entities/signal.js';
import type { CopyKey } from './copy-keys.js';

/** An insurance plan model (an obra social in Argentina). Reference data, not config. */
export interface InsurerModel {
  /** Stable slug, e.g. 'demo-salud'. */
  id: string;
  name: string;
  /** Typical days the insurer takes to resolve an authorization, per type. */
  authorizationSlaDays?: Partial<Record<string, number>>;
  notes?: string;
}

/**
 * A rule for classifying inbound messages into signals:
 * "sender matches X and subject matches Y → signalType Z".
 */
export interface SignalPattern {
  /** Regex source matched against the sender address/name. */
  senderPattern: string;
  /** Regex source matched against the subject. */
  subjectPattern: string;
  signalType: SignalType;
  /** Template for the suggested next action shown to the caretaker. */
  suggestedActionTemplate: string;
  /** Higher wins when several patterns match. */
  priority: number;
}

/** Locale-specific operational rules (legal/customary, not preferences). */
export interface LocaleRules {
  /** Days a prescription document stays valid (30 for a receta in Argentina). */
  prescriptionValidityDays: number;
  /** Days before expiry at which to alert. */
  prescriptionAlertWindowDays: number;
  /** Default hours before an appointment by which its authorization must be confirmed. */
  authorizationDeadlineHours: number;
}

export interface PromptExample {
  /** A caretaker situation, in the pack's language, using synthetic data only. */
  situation: string;
  /** What a good assistant response looks like. */
  goodResponse: string;
}

/**
 * A locale pack: everything language- and system-specific that core leaves
 * open. @kerkit/pack-argentina is the reference implementation.
 */
export interface LocalePack {
  /** BCP 47, e.g. 'es-AR'. */
  locale: string;
  strings: Record<CopyKey, string>;
  insurers?: InsurerModel[];
  signalPatterns?: SignalPattern[];
  /** Identifier regexes (DNI, CUIL…) fed to the privacy sweep pass. */
  identifierPatterns?: RegExp[];
  rules: LocaleRules;
  prompts?: {
    /** Tone description injected into the system prompt (voseo, warm, precise…). */
    tone: string;
    examples?: PromptExample[];
  };
}

export function getCopy(pack: LocalePack, key: CopyKey): string {
  return pack.strings[key] ?? key;
}

import { getCopy, patientClassification, redactEntityForLlm } from '@kerkit/core';
import type { LocalePack, Patient, RedactionSession } from '@kerkit/core';

export interface SystemPromptOptions {
  pack: LocalePack;
  /** Assistant name as the user knows it. */
  assistantName: string;
  /** Caretaker's first name for the identity line (a display choice the app makes). */
  caretakerName?: string;
  /**
   * Pre-redacted care-context lines (e.g. from buildPatientContextBlock).
   * NEVER pass raw identifiers here — build the block with the helper.
   */
  careContextBlock?: string;
  /** Institutions/contacts block (operational data the assistant cites). */
  institutionsBlock?: string;
  /** App-specific instructions, appended after the non-removable blocks. */
  extraInstructions?: string;
}

/**
 * System prompt template. The privacy and not-medical-advice blocks come
 * from the locale pack's required copy keys and CANNOT be removed or
 * overridden — `extraInstructions` appends, it does not replace.
 */
export function buildSystemPrompt(options: SystemPromptOptions): string {
  const { pack } = options;

  const identity = options.caretakerName
    ? `Sos ${options.assistantName}, el asistente personal de ${options.caretakerName} para organizar el tratamiento médico de su ser querido.`
    : `Sos ${options.assistantName}, un asistente personal para organizar el tratamiento médico de un ser querido.`;

  const blocks = [
    identity,
    `Tu personalidad:\n${getCopy(pack, 'prompt.tone.description')}`,
    // Non-removable: privacy conventions.
    `Reglas de privacidad (siempre):\n- ${getCopy(pack, 'prompt.privacy.neverAskIdentifiers')}\n- ${getCopy(pack, 'prompt.privacy.dontEchoSensitive')}\n- ${getCopy(pack, 'prompt.privacy.transparency')}`,
    // Non-removable: boundaries.
    `Límites (siempre):\n- ${getCopy(pack, 'prompt.boundaries.notMedicalAdvice')}`,
  ];

  if (options.careContextBlock) {
    blocks.push(`Contexto del tratamiento:\n${options.careContextBlock}`);
  }
  if (options.institutionsBlock) {
    blocks.push(`Instituciones y contactos:\n${options.institutionsBlock}`);
  }
  if (options.extraInstructions) {
    blocks.push(options.extraInstructions);
  }

  return blocks.join('\n\n');
}

export interface PatientContextResult {
  block: string;
  /** Token map for app-side rehydration (e.g. «NAME» → real name in the UI). */
  tokens: Map<string, string>;
}

/**
 * Builds the patient context block WITH redaction applied. This replaces the
 * pattern of interpolating the patient's real name and national id into the
 * prompt: identity travels as placeholder tokens; health fields only by the
 * opt-in you write here.
 */
export function buildPatientContextBlock(
  patient: Patient,
  opts: {
    insurerName?: string;
    allowSensitiveFields?: readonly ('diagnosis' | 'treatmentPhase')[];
    /**
     * Shared request-scoped session. Pass it (or use `createRedactedChat`) so
     * the patient-name token is minted by the same allocator the assembler and
     * the provider sink use — that's what lets a name hiding in a note's free
     * text be swept to the same placeholder. Without it, the name token is
     * isolated to this block.
     */
    session?: RedactionSession;
  } = {},
): PatientContextResult {
  const record = patient as unknown as Record<string, unknown>;
  const { redacted, tokens } = opts.session
    ? opts.session.redactEntity(record, patientClassification, {
        entityKind: 'patient',
        allowSensitiveFields: opts.allowSensitiveFields,
      })
    : redactEntityForLlm(record, patientClassification, {
        allowSensitiveFields: opts.allowSensitiveFields,
      });

  const lines = [`- Paciente: ${redacted.name}`];
  if (opts.insurerName) lines.push(`- Obra social: ${opts.insurerName}`);
  if (redacted.diagnosis) lines.push(`- Diagnóstico: ${redacted.diagnosis}`);
  if (redacted.treatmentPhase) lines.push(`- Etapa actual: ${redacted.treatmentPhase}`);

  return { block: lines.join('\n'), tokens };
}

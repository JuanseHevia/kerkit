import type { Request, Response } from 'express';
import {
  fixtureNote,
  fixturePatient,
  fixturePrescription,
  noteClassification,
  patientClassification,
  prescriptionClassification,
  redactEntityForLlm,
  sweepText,
} from '@kerkit/core';
import type { Classification, DataClass } from '@kerkit/core';
import type { DemoDeps } from '../deps.js';
import { fmtValue, serializeEntity } from '../format.js';

type EntityKey = 'patient' | 'note' | 'prescription';

type Disposition = 'tokenized' | 'allowed' | 'dropped' | 'passthrough' | 'swept' | 'empty';

interface FieldRow {
  field: string;
  dataClass: DataClass;
  raw: string | null;
  llm: string | null;
  disposition: Disposition;
}

interface EntityConfig {
  label: string;
  blurb: string;
  entity: Record<string, unknown>;
  classification: Record<string, DataClass>;
  /** sensitive-health fields this view lets through (the written opt-in). */
  allowSensitiveFields: readonly string[];
  /** Free-text field to spotlight the regex sweep, if any. */
  sweepField: string | null;
}

const ENTITIES: Record<EntityKey, EntityConfig> = {
  patient: {
    label: 'Paciente',
    blurb:
      'Datos del paciente. Los identificadores directos (nombre, DNI, credencial) se reemplazan por tokens; los campos de salud sólo pasan con un opt-in explícito.',
    entity: fixturePatient as unknown as Record<string, unknown>,
    classification: patientClassification as unknown as Record<string, DataClass>,
    allowSensitiveFields: ['treatmentPhase'],
    sweepField: null,
  },
  note: {
    label: 'Nota del cuidador',
    blurb:
      'Texto libre escrito por el cuidador. La clasificación estructural lo marca como logística, pero el barrido (patrones del pack + tokens conocidos de la app) atrapa el DNI y el nombre escondidos en la prosa.',
    entity: fixtureNote as unknown as Record<string, unknown>,
    classification: noteClassification as unknown as Record<string, DataClass>,
    allowSensitiveFields: [],
    sweepField: 'content',
  },
  prescription: {
    label: 'Receta',
    blurb:
      'Una receta. El nombre del medicamento y la etapa de tratamiento son datos de salud: se omiten salvo opt-in. Acá los dejamos caer para mostrar la omisión.',
    entity: fixturePrescription as unknown as Record<string, unknown>,
    classification: prescriptionClassification as unknown as Record<string, DataClass>,
    allowSensitiveFields: [],
    sweepField: null,
  },
};

function fieldBreakdown(
  conf: EntityConfig,
  redacted: Record<string, unknown>,
  modelView: Record<string, unknown>,
  sweptFields: ReadonlySet<string>,
): FieldRow[] {
  return Object.entries(conf.classification).map(([field, dataClass]) => {
    const rawVal = conf.entity[field];
    const present = field in redacted;
    let disposition: Disposition;
    if (rawVal === undefined || rawVal === null) disposition = 'empty';
    else if (dataClass === 'direct-identifier') disposition = 'tokenized';
    else if (dataClass === 'sensitive-health') disposition = present ? 'allowed' : 'dropped';
    else if (sweptFields.has(field)) disposition = 'swept';
    else disposition = 'passthrough';
    return {
      field,
      dataClass,
      raw: fmtValue(rawVal),
      llm: present ? fmtValue(modelView[field]) : null,
      disposition,
    };
  });
}

/**
 * POST /api/privacy/xray { entity } — the flagship "what does the model
 * actually see?" view. The model side is the FULL projection: structural
 * redaction (redactEntityForLlm) followed by the identifier sweep with the
 * app's known tokens — i.e. exactly what the ContextAssembler would emit.
 */
export function xrayRoute(deps: DemoDeps) {
  const patterns = deps.pack.identifierPatterns ?? [];
  const knownTokens = deps.patientContext.tokens;

  return (req: Request, res: Response) => {
    const requested = req.body?.entity as EntityKey | undefined;
    const key: EntityKey = requested && requested in ENTITIES ? requested : 'patient';
    const conf = ENTITIES[key];

    const { redacted, tokens } = redactEntityForLlm(
      conf.entity,
      conf.classification as unknown as Classification<Record<string, unknown>>,
      { allowSensitiveFields: conf.allowSensitiveFields },
    );

    // Belt-and-suspenders sweep over the redacted projection, with the app's
    // patient tokens merged in so a name hiding in free text is scrubbed too.
    const sweepKnown = new Map<string, string>([...knownTokens, ...tokens]);
    const modelView: Record<string, unknown> = {};
    const sweptFields = new Set<string>();
    for (const [field, value] of Object.entries(redacted)) {
      if (typeof value === 'string') {
        const result = sweepText(value, patterns, sweepKnown);
        modelView[field] = result.text;
        if (result.text !== value) sweptFields.add(field);
      } else {
        modelView[field] = value;
      }
    }

    let sweep: { field: string; before: string; after: string; matches: string[] } | null = null;
    if (conf.sweepField) {
      const before = String(conf.entity[conf.sweepField] ?? '');
      const result = sweepText(before, patterns, sweepKnown);
      sweep = { field: conf.sweepField, before, after: result.text, matches: result.matches };
    }

    res.json({
      entity: key,
      label: conf.label,
      blurb: conf.blurb,
      options: (Object.keys(ENTITIES) as EntityKey[]).map((k) => ({
        key: k,
        label: ENTITIES[k].label,
      })),
      allowSensitiveFields: conf.allowSensitiveFields,
      raw: serializeEntity(conf.entity),
      redacted: serializeEntity(modelView),
      tokens: [...tokens.entries()],
      fields: fieldBreakdown(conf, redacted, modelView, sweptFields),
      sweep,
    });
  };
}

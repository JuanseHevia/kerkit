import { z } from 'zod';

/**
 * Minimal Zod → JSON Schema for tool parameter objects. Covers the subset
 * kerkit tools use (string, number, boolean, enum, array, optional, default,
 * describe). Not a general-purpose converter on purpose — if your custom
 * tool needs more, supply the JSON schema yourself in toToolSpec.
 */
export function zodObjectToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, field] of Object.entries(schema.shape)) {
    const { jsonSchema, isOptional } = fieldToJsonSchema(field as z.ZodTypeAny);
    properties[key] = jsonSchema;
    if (!isOptional) required.push(key);
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

function fieldToJsonSchema(field: z.ZodTypeAny): {
  jsonSchema: Record<string, unknown>;
  isOptional: boolean;
} {
  let current = field;
  let isOptional = false;
  let defaultValue: unknown;
  let hasDefault = false;
  const description = field.description;

  for (;;) {
    if (current instanceof z.ZodOptional || current instanceof z.ZodNullable) {
      isOptional = true;
      current = current.unwrap() as z.ZodTypeAny;
    } else if (current instanceof z.ZodDefault) {
      hasDefault = true;
      isOptional = true;
      defaultValue = (current._def as { defaultValue: () => unknown }).defaultValue();
      current = (current._def as { innerType: z.ZodTypeAny }).innerType;
    } else {
      break;
    }
  }

  let jsonSchema: Record<string, unknown>;
  if (current instanceof z.ZodString) {
    jsonSchema = { type: 'string' };
  } else if (current instanceof z.ZodNumber) {
    jsonSchema = { type: 'number' };
    const checks = (current._def as { checks?: Array<{ kind: string; value?: number }> }).checks ?? [];
    for (const check of checks) {
      if (check.kind === 'min') jsonSchema.minimum = check.value;
      if (check.kind === 'max') jsonSchema.maximum = check.value;
      if (check.kind === 'int') jsonSchema.type = 'integer';
    }
  } else if (current instanceof z.ZodBoolean) {
    jsonSchema = { type: 'boolean' };
  } else if (current instanceof z.ZodEnum) {
    jsonSchema = { type: 'string', enum: [...(current.options as string[])] };
  } else if (current instanceof z.ZodArray) {
    jsonSchema = {
      type: 'array',
      items: fieldToJsonSchema((current._def as { type: z.ZodTypeAny }).type).jsonSchema,
    };
  } else {
    // Fallback: accept anything; runtime Zod validation still applies.
    jsonSchema = {};
  }

  if (description) jsonSchema.description = description;
  if (hasDefault) jsonSchema.default = defaultValue;

  return { jsonSchema, isOptional };
}

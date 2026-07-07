import { redactEntityForLlm, sweepText } from '@kerkit/core';
import type { Classification } from '@kerkit/core';
import type { ToolContext, ToolResult } from './types.js';

/**
 * Redact entity rows before they leave a tool: structural pass per row, then
 * the identifier sweep over the serialized payload. Tool outputs go straight
 * into model context, so they get the same discipline as assembled context.
 */
export function redactedRowsResult<T extends Record<string, unknown>>(
  rows: T[],
  classification: Classification<T>,
  context: ToolContext,
  opts: { allowSensitiveFields?: readonly (keyof T & string)[]; emptyMessage: string },
): ToolResult {
  if (rows.length === 0) {
    return { content: [{ type: 'text', text: opts.emptyMessage }] };
  }

  const session = context.session;

  // Session path: shared allocator + shared known-value map, so a patient name
  // sitting in a note's free text is swept to the same token as the structured
  // field. This is what closes the MCP tool-path name leak.
  if (session) {
    const redactedRows = rows.map(
      (row) =>
        session.redactEntity(row, classification, {
          allowSensitiveFields: opts.allowSensitiveFields,
        }).redacted,
    );
    const text = session.sweep(JSON.stringify(redactedRows, null, 2));
    return { content: [{ type: 'text', text }] };
  }

  // Legacy path (no session): structural redaction + a local-token sweep only.
  // Names known only to the request (e.g. the patient's) are NOT swept here.
  const tokens = new Map<string, string>();
  const redactedRows = rows.map((row) => {
    const { redacted, tokens: rowTokens } = redactEntityForLlm(row, classification, {
      allowSensitiveFields: opts.allowSensitiveFields,
    });
    for (const [token, value] of rowTokens) tokens.set(token, value);
    return redacted;
  });

  const swept = sweepText(
    JSON.stringify(redactedRows, null, 2),
    context.pack.identifierPatterns ?? [],
    tokens,
  );

  return { content: [{ type: 'text', text: swept.text }] };
}

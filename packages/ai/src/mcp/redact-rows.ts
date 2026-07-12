import type { Classification } from '@kerkit/core';
import type { ToolContext, RawToolResult } from './types.js';

/**
 * Redact entity rows before they leave a tool: structural pass per row, then
 * the identifier sweep over the serialized payload. Tool outputs go straight
 * into model context, so they get the same discipline as assembled context.
 */
export async function redactedRowsResult<T extends Record<string, unknown>>(
  rows: T[],
  classification: Classification<T>,
  context: ToolContext,
  opts: { allowSensitiveFields?: readonly (keyof T & string)[]; emptyMessage: string },
): Promise<RawToolResult> {
  if (rows.length === 0) {
    return { content: [{ type: 'text', text: opts.emptyMessage }] };
  }

  const session = context.session;

  // Shared allocator + shared known-value map, so a patient name
  // sitting in a note's free text is swept to the same token as the structured
  // field. This is what closes the MCP tool-path name leak.
  const redactedRows = rows.map((row) => {
    const { redacted } = session.redactEntity(row, classification, {
      allowSensitiveFields: opts.allowSensitiveFields,
    });
    return redacted;
  });
  const text = await session.sweepAsync(JSON.stringify(redactedRows, null, 2));
  return { content: [{ type: 'text', text }] };
}

import type { z } from 'zod';
import type { LocalePack } from '@kerkit/core';
import type { ExternalSources, KerkitRepositories } from '../repositories.js';

export interface ToolContext {
  userId: string;
  repos: KerkitRepositories;
  /** Optional bridges to email/calendar/documents; tools degrade gracefully. */
  external?: ExternalSources;
  /** Supplies identifier patterns for output redaction. */
  pack: Pick<LocalePack, 'identifierPatterns'>;
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  annotations?: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    openWorldHint: boolean;
    idempotentHint?: boolean;
  };
  handler: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

export function textResult(payload: unknown): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

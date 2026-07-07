import type { z } from 'zod';
import type { LocalePack, RedactionSession } from '@kerkit/core';
import type { ExternalSources, KerkitRepositories } from '../repositories.js';

export interface ToolContext {
  userId: string;
  repos: KerkitRepositories;
  /** Optional bridges to email/calendar/documents; tools degrade gracefully. */
  external?: ExternalSources;
  /** Supplies identifier patterns for output redaction. */
  pack: Pick<LocalePack, 'identifierPatterns'>;
  /**
   * Shared request-scoped session. Pass it so tool-output tokens dedup against
   * the same allocator as context assembly (and a patient name in a note's free
   * text is swept). A bespoke MCP server built on `registerKerkitTools` MUST
   * populate this for tool output to be name-redacted — there is no loop sink
   * on that path.
   */
  session?: RedactionSession;
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

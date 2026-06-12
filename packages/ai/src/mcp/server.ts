import { z } from 'zod';
import type { LocalePack } from '@kerkit/core';
import type { ExternalSources, KerkitRepositories } from '../repositories.js';
import type { ToolDefinition, ToolResult } from './types.js';

/**
 * Structural view of @modelcontextprotocol/sdk's McpServer — pass your
 * instance without this package depending on the SDK.
 */
export interface McpServerLike {
  registerTool(
    name: string,
    config: {
      title?: string;
      description: string;
      inputSchema: z.ZodRawShape;
      annotations?: Record<string, unknown>;
    },
    handler: (params: Record<string, unknown>) => Promise<ToolResult>,
  ): unknown;
}

export type UserMode =
  /**
   * The caller (your API) injects `_userId` into every tool call. The field
   * is system-set; instruct your bridge to strip it from LLM-visible schemas.
   */
  | { kind: 'injected' }
  /** Single-user server (personal deployments): every call acts as this user. */
  | { kind: 'static'; userId: string };

export interface RegisterToolsOptions {
  repos: KerkitRepositories;
  pack: Pick<LocalePack, 'identifierPatterns'>;
  external?: ExternalSources;
  userMode: UserMode;
}

/**
 * Register kerkit tools on an MCP server, preserving the userId-injection
 * pattern: in 'injected' mode a missing/empty `_userId` is a hard error —
 * there is deliberately no fallback user.
 */
export function registerKerkitTools(
  server: McpServerLike,
  tools: ToolDefinition[],
  options: RegisterToolsOptions,
): void {
  for (const tool of tools) {
    const inputSchema =
      options.userMode.kind === 'injected'
        ? tool.inputSchema.extend({
            _userId: z
              .string()
              .min(1)
              .describe('System-injected authenticated userId. Never set by the LLM.'),
          })
        : tool.inputSchema;

    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: inputSchema.shape,
        annotations: tool.annotations,
      },
      async (params: Record<string, unknown>) => {
        const { _userId, ...toolParams } = params as { _userId?: string } & Record<string, unknown>;

        const userId =
          options.userMode.kind === 'static'
            ? options.userMode.userId
            : typeof _userId === 'string' && _userId.length > 0
              ? _userId
              : null;

        if (!userId) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: tool ${tool.name} requires an authenticated user id.`,
              },
            ],
            isError: true,
          };
        }

        return tool.handler(toolParams, {
          userId,
          repos: options.repos,
          pack: options.pack,
          external: options.external,
        });
      },
    );
  }
}

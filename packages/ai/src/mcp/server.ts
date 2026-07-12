import { z } from 'zod';
import type { LocalePack, RedactionExplain, RedactionSession } from '@kerkit/core';
import type { ExternalSources, KerkitRepositories } from '../repositories.js';
import type { RedactedText } from '../messages.js';
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
  /** Build or load the request/conversation session after authenticating the user. */
  createSession(input: { userId: string; toolName: string }): RedactionSession | Promise<RedactionSession>;
  /** Trusted app-side sidecar. Original values are never added to MCP content. */
  onRedaction?(input: {
    userId: string;
    toolName: string;
    tokens: ReadonlyMap<string, string>;
    explain: RedactionExplain;
  }): void | Promise<void>;
}

function safeStatic(text: string): RedactedText {
  return text as RedactedText;
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
                text: safeStatic(`Error: tool ${tool.name} requires an authenticated user id.`),
              },
            ],
            isError: true,
          };
        }

        const session = await options.createSession({ userId, toolName: tool.name });
        const raw = await tool.handler(toolParams, {
          userId,
          repos: options.repos,
          pack: options.pack,
          external: options.external,
          session,
        });
        const result: ToolResult = {
          ...raw,
          content: await Promise.all(
            raw.content.map(async (item) => ({
              ...item,
              text: (await session.sweepAsync(item.text)) as RedactedText,
            })),
          ),
        };
        await options.onRedaction?.({
          userId,
          toolName: tool.name,
          tokens: session.tokenToValue(),
          explain: session.explain(),
        });
        return result;
      },
    );
  }
}

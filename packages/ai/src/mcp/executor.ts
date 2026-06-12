import type { ToolCallRequest, ToolSpec } from '../messages.js';
import type { ToolContext, ToolDefinition } from './types.js';
import { zodObjectToJsonSchema } from './json-schema.js';

/** Convert tool definitions to the provider-facing ToolSpec list. */
export function toToolSpecs(tools: ToolDefinition[]): ToolSpec[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: zodObjectToJsonSchema(tool.inputSchema),
  }));
}

/**
 * In-process tool executor for runChatLoop — validates arguments with the
 * tool's Zod schema and runs the handler with the given context. Use this
 * when tools run inside your API process; use the MCP harness when they run
 * in a separate MCP server.
 */
export function createToolExecutor(tools: ToolDefinition[], context: ToolContext) {
  const byName = new Map(tools.map((t) => [t.name, t]));

  return async (call: ToolCallRequest): Promise<unknown> => {
    const tool = byName.get(call.name);
    if (!tool) throw new Error(`Unknown tool: ${call.name}`);

    const params = tool.inputSchema.parse(call.arguments ?? {});
    const result = await tool.handler(params as Record<string, unknown>, context);

    if (result.isError) {
      return { error: result.content.map((c) => c.text).join('\n') };
    }
    return result.content.map((c) => c.text).join('\n');
  };
}

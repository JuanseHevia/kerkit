/** Compile-only negative checks for the provider privacy boundary. */
import { argentina } from '@kerkit/pack-argentina';
import type { GenerateOptions, ProviderAdapter, ToolCallRequest } from './index.js';
import { runChatLoop } from './index.js';
import {
  createToolExecutor,
  type RawToolResult,
  type ToolContext,
  type ToolDefinition,
  type ToolResult,
} from './mcp/index.js';

declare const provider: ProviderAdapter;
declare const executeTool: (call: ToolCallRequest) => Promise<unknown>;
declare const tools: ToolDefinition[];

// @ts-expect-error provider-bound strings must carry the RedactedText brand.
const unsafeProviderInput: GenerateOptions = { instructions: 'raw', input: [] };
void unsafeProviderInput;

declare const rawToolResult: RawToolResult;
// @ts-expect-error raw handler output is not a branded provider-safe ToolResult.
const unsafeToolResult: ToolResult = rawToolResult;
void unsafeToolResult;

// @ts-expect-error runChatLoop cannot be called without a RedactionSession.
void runChatLoop({
  provider,
  pack: argentina,
  instructions: 'raw',
  messages: [{ role: 'user', content: 'raw' }],
  executeTool,
});

// @ts-expect-error every tool executor requires the shared RedactionSession.
const unsafeToolContext: ToolContext = {
  userId: 'synthetic-user',
  repos: {} as ToolContext['repos'],
  pack: argentina,
};
void createToolExecutor(tools, unsafeToolContext);

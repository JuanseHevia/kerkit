import { getCopy } from '@kerkit/core';
import type { LocalePack } from '@kerkit/core';
import type {
  ChatMessage,
  ProviderAdapter,
  ToolCallRequest,
  ToolCallResult,
  ToolSpec,
} from '../messages.js';

export interface ExecutedToolCall {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface ChatLoopResult {
  message: string;
  toolCalls?: ExecutedToolCall[];
  /** Rounds actually used (text-only answers use 1). */
  rounds: number;
}

export interface ChatLoopOptions {
  provider: ProviderAdapter;
  pack: LocalePack;
  instructions: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  /** Executes one tool call; throw to report the error back to the model. */
  executeTool?: (call: ToolCallRequest) => Promise<unknown>;
  maxRounds?: number;
  maxOutputTokens?: number;
  /** Observe each executed call (logging, telemetry, write_note tracking…). */
  onToolCall?: (call: ExecutedToolCall) => void;
}

/**
 * The tool-calling loop, provider-agnostic: ask the model; if it requests
 * tools, execute them and feed results back; stop at a text answer or after
 * maxRounds. Tool errors are reported to the model, not thrown — the
 * assistant explains instead of crashing.
 */
export async function runChatLoop(options: ChatLoopOptions): Promise<ChatLoopResult> {
  const maxRounds = options.maxRounds ?? 5;
  const executed: ExecutedToolCall[] = [];

  let state: unknown;
  let toolResults: ToolCallResult[] | undefined;

  for (let round = 1; round <= maxRounds; round++) {
    const turn = await options.provider.generate({
      instructions: options.instructions,
      input: options.messages,
      state,
      toolResults,
      tools: options.tools,
      maxOutputTokens: options.maxOutputTokens,
    });

    if (turn.toolCalls.length === 0 || !options.executeTool) {
      return {
        message: turn.text ?? getCopy(options.pack, 'assistant.fallback.empty'),
        toolCalls: executed.length > 0 ? executed : undefined,
        rounds: round,
      };
    }

    toolResults = [];
    for (const call of turn.toolCalls) {
      let result: unknown;
      try {
        result = await options.executeTool(call);
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) };
      }

      const record: ExecutedToolCall = { name: call.name, args: call.arguments, result };
      executed.push(record);
      options.onToolCall?.(record);

      toolResults.push({
        id: call.id,
        name: call.name,
        output: typeof result === 'string' ? result : JSON.stringify(result),
      });
    }

    state = turn.state;
  }

  return {
    message: getCopy(options.pack, 'assistant.fallback.toolRoundsExhausted'),
    toolCalls: executed.length > 0 ? executed : undefined,
    rounds: maxRounds,
  };
}

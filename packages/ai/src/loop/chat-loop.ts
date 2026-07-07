import { getCopy } from '@kerkit/core';
import type { LocalePack, RedactionExplain, RedactionSession } from '@kerkit/core';
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
  /**
   * What the redaction session did at the sink — tokens allocated, sweep
   * matches, fail-closed events. Present only when a `session` was passed.
   * NOTE: the returned `message` is model-emitted and is NOT sink-swept; keep
   * your own output leak-check.
   */
  redaction?: RedactionExplain;
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
  /**
   * Shared request-scoped session. When passed, every application-originated
   * string (instructions, message history, tool output, tool errors) is swept
   * at the provider boundary. Pass the SAME instance used for context assembly
   * and the patient block — `createRedactedChat` wires all three. Omit it and
   * free-text names are NOT redacted (a one-time warning fires if a patient
   * context is detected).
   */
  session?: RedactionSession;
}

let warnedMissingSession = false;

/** One-time nudge: patient context present (placeholder tokens) but no session. */
function warnIfUnprotected(instructions: string, session?: RedactionSession): void {
  if (session || warnedMissingSession) return;
  if (/«[^»]+»/.test(instructions)) {
    warnedMissingSession = true;
    console.warn(
      '[KRK_NO_SESSION] kerkit: runChatLoop received a patient context but no RedactionSession — ' +
        'free-text names in tool output and messages will NOT be redacted. ' +
        'Use createRedactedChat or pass { session }.',
    );
  }
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
  const session = options.session;

  warnIfUnprotected(options.instructions, session);

  // Instructions and message history are constant across rounds — sweep once.
  // Never mutate caller-owned arrays: build fresh copies.
  const instructions = session ? session.sweep(options.instructions) : options.instructions;
  const input: ChatMessage[] = session
    ? options.messages.map((m) => ({ ...m, content: session.sweep(m.content) }))
    : options.messages;

  let state: unknown;
  let toolResults: ToolCallResult[] | undefined;

  for (let round = 1; round <= maxRounds; round++) {
    const turn = await options.provider.generate({
      instructions,
      input,
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
        redaction: session?.explain(),
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

      // Sweep the serialized output at the sink — catches external-tool output,
      // write_note echo, and tool-error strings that never went through
      // redactedRowsResult. Idempotent for rows already redacted with the session.
      const rawOutput = typeof result === 'string' ? result : JSON.stringify(result);
      toolResults.push({
        id: call.id,
        name: call.name,
        output: session ? session.sweep(rawOutput) : rawOutput,
      });
    }

    state = turn.state;
  }

  return {
    message: getCopy(options.pack, 'assistant.fallback.toolRoundsExhausted'),
    toolCalls: executed.length > 0 ? executed : undefined,
    rounds: maxRounds,
    redaction: session?.explain(),
  };
}

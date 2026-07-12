/**
 * kerkit-owned message and tool-call shapes. These — not any provider's
 * types — are the public surface; adapters translate at the edge.
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

declare const redactedTextBrand: unique symbol;
/** Text that has passed through a request-scoped RedactionSession. */
export type RedactedText = string & { readonly [redactedTextBrand]: true };

export interface SafeChatMessage {
  role: ChatMessage['role'];
  content: RedactedText;
}

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the tool's parameters. */
  parameters: Record<string, unknown>;
}

export interface ToolCallRequest {
  /** Provider-assigned call id; echoed back in the result. */
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult {
  id: string;
  name: string;
  /** Stringified tool output (JSON or plain text). */
  output: RedactedText;
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

/** One model turn: either text, or a batch of tool calls to execute. */
export interface ProviderTurn {
  text: string | null;
  toolCalls: ToolCallRequest[];
  /**
   * Opaque continuation state (e.g. the Responses API output items). The
   * loop threads it back on the next call; never inspect it outside the
   * adapter that produced it.
   */
  state: unknown;
  usage?: TokenUsage;
}

export interface GenerateOptions {
  instructions: RedactedText;
  /** Conversation so far. Used on the first round of a loop. */
  input: SafeChatMessage[];
  /** Continuation state from the previous turn (with toolResults). */
  state?: unknown;
  /** Tool results to feed back alongside `state`. */
  toolResults?: ToolCallResult[];
  tools?: ToolSpec[];
  maxOutputTokens?: number;
}

/**
 * The one-method seam between kerkit and any LLM provider. The OpenAI
 * Responses adapter ships (`@kerkit/ai/openai`); others are a contribution.
 */
export interface ProviderAdapter {
  generate(opts: GenerateOptions): Promise<ProviderTurn>;
}

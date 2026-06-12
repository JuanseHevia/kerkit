import type { GenerateOptions, ProviderAdapter, ProviderTurn, ToolCallRequest } from '../messages.js';

/**
 * Structural view of the OpenAI client — pass `new OpenAI(...)` here without
 * this package depending on the openai package. Only `responses.create` is
 * used. OpenAI types never appear in kerkit's public surface.
 */
export interface ResponsesClientLike {
  responses: {
    create(body: Record<string, unknown>): Promise<{
      output: Array<Record<string, unknown>>;
      output_text?: string | null;
      usage?: { input_tokens?: number; output_tokens?: number };
    }>;
  };
}

interface ResponsesState {
  /** Prior conversation input plus the previous turn's output items. */
  input: Array<Record<string, unknown>>;
}

/**
 * ProviderAdapter over the OpenAI Responses API with function tools.
 * Continuation state is the Responses input array (`[...output, ...results]`
 * pattern), kept opaque to callers.
 */
export class OpenAIResponsesAdapter implements ProviderAdapter {
  constructor(
    private readonly client: ResponsesClientLike,
    private readonly model: string,
  ) {}

  async generate(opts: GenerateOptions): Promise<ProviderTurn> {
    const baseInput: Array<Record<string, unknown>> = opts.state
      ? [
          ...(opts.state as ResponsesState).input,
          ...(opts.toolResults ?? []).map((r) => ({
            type: 'function_call_output',
            call_id: r.id,
            output: r.output,
          })),
        ]
      : opts.input.map((m) => ({ role: m.role, content: m.content }));

    const response = await this.client.responses.create({
      model: this.model,
      instructions: opts.instructions,
      input: baseInput,
      tools:
        opts.tools && opts.tools.length > 0
          ? opts.tools.map((t) => ({
              type: 'function',
              name: t.name,
              description: t.description,
              parameters: t.parameters,
              strict: false,
            }))
          : undefined,
      max_output_tokens: opts.maxOutputTokens,
    });

    const toolCalls: ToolCallRequest[] = response.output
      .filter((item) => item.type === 'function_call')
      .map((item) => {
        let args: Record<string, unknown> = {};
        try {
          args =
            typeof item.arguments === 'string'
              ? (JSON.parse(item.arguments) as Record<string, unknown>)
              : ((item.arguments as Record<string, unknown>) ?? {});
        } catch {
          args = {};
        }
        return {
          id: String(item.call_id ?? item.id ?? ''),
          name: String(item.name ?? ''),
          arguments: args,
        };
      });

    return {
      text: response.output_text ?? null,
      toolCalls,
      state: { input: [...baseInput, ...response.output] } satisfies ResponsesState,
      usage: response.usage
        ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
        : undefined,
    };
  }
}

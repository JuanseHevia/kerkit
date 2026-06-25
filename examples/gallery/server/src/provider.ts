import type { ProviderAdapter } from '@kerkit/ai';
import { OpenAIResponsesAdapter } from '@kerkit/ai/openai';
import { MockProvider } from './mock-provider.js';

export type ProviderMode = 'mock' | 'openai';

/**
 * Picks the provider for the gallery. Default: the scripted MockProvider, so
 * the whole demo runs offline with zero keys. If OPENAI_API_KEY is set, wire
 * the real OpenAI Responses adapter through a tiny fetch client — kerkit only
 * needs `responses.create`, so there's no `openai` package dependency and the
 * image stays lean.
 */
export function makeProvider(): { provider: ProviderAdapter; mode: ProviderMode } {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { provider: new MockProvider(), mode: 'mock' };

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const client = {
    responses: {
      async create(body: Record<string, unknown>) {
        const res = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
        }
        return (await res.json()) as {
          output: Array<Record<string, unknown>>;
          output_text?: string | null;
          usage?: { input_tokens?: number; output_tokens?: number };
        };
      },
    },
  };

  return { provider: new OpenAIResponsesAdapter(client, model), mode: 'openai' };
}

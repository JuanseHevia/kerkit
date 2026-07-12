/**
 * Compile check for the canonical `createRedactedChat` quickstart in
 * `packages/ai/README.md`. This file is TYPE-CHECKED by `npm run build` and
 * `npm run lint` (`tsc` / `tsc --noEmit`) — if the documented snippet drifts
 * from the real API, CI fails here before the README can teach a stale path.
 *
 * Two intentional deviations from the README, both cosmetic to the check:
 *   1. Imports are package-relative (this file lives inside the package); the
 *      README uses the published entry points (`@kerkit/ai`, `@kerkit/ai/mcp`,
 *      `@kerkit/ai/openai`, `@kerkit/ai/demo`).
 *   2. The OpenAI client is a structural stub instead of `new OpenAI()` — the
 *      adapter only needs `responses.create`, and the `openai` package is not
 *      a dependency of `@kerkit/ai` (that's the whole point of the adapter).
 *
 * Not exported from the package index; it exists purely to guard the docs.
 */
import { fixturePatient } from '@kerkit/core';
import { argentina } from '@kerkit/pack-argentina';
import { createRedactedChat, defaultSources } from './index.js';
import { allTools } from './mcp/index.js';
import { OpenAIResponsesAdapter, type ResponsesClientLike } from './providers/openai-responses.js';
import { createFixtureRepositories } from './test-helpers.js';

export async function readmeQuickstart(): Promise<string> {
  // Your data layer: any `KerkitRepositories` implementation. The demo
  // fixtures (from `@kerkit/ai/demo`) run against the synthetic persona with
  // zero setup.
  const repos = createFixtureRepositories();

  // Your model provider. The adapter needs only `responses.create`; in your
  // app you pass `new OpenAI()`. Here we stub the client so the compile check
  // stays offline and dependency-free.
  const openaiClient: ResponsesClientLike = {
    responses: {
      create: async () => ({ output: [], output_text: 'Listo.' }),
    },
  };
  const provider = new OpenAIResponsesAdapter(openaiClient, 'gpt-5-mini');

  // ONE request-scoped RedactionSession is wired through the patient block,
  // context assembly, every tool, and the provider sink — you never thread it
  // by hand. Construct one per patient-conversation.
  const chat = createRedactedChat({
    pack: argentina,
    provider,
    repos,
    patient: fixturePatient,
    userId: fixturePatient.userId,
    assistantName: 'Aidé',
    allowSensitiveFields: ['treatmentPhase'],
    sources: defaultSources(repos, argentina), // the caretaker context window
    tools: allTools, // the nine caretaker tools
  });

  // Optional inspection of the redacted caretaker context window. respond()
  // assembles a fresh context window itself before calling the provider.
  const ctx = await chat.assembleContext();
  ctx.explain(); // exactly what the model will see — show it to the user

  // One assistant turn. Free-text names in tool output are swept at the sink.
  const { message, redaction } = await chat.respond({
    message: '¿Cómo viene el trámite de la medicación?',
  });

  // Observability: what the sink tokenized this turn.
  redaction?.tokensAllocated;

  return message;
}

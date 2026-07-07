import express from 'express';
import { createRedactedChat, defaultSources } from '@kerkit/ai';
import { allTools } from '@kerkit/ai/mcp';
import { createFixtureRepositories } from '@kerkit/ai/demo';
import { argentina } from '@kerkit/pack-argentina';
import { FIXTURE_IDS, fixturePatient } from '@kerkit/core';
import { createPrivacyRouter } from '@kerkit/server';
import { createInMemoryPrivacyStore } from './privacy-store.js';
import { MockProvider } from './mock-provider.js';

/**
 * A complete caretaker-app backend in ~100 lines, running entirely on the
 * synthetic persona: no database, no OAuth, no LLM key. Swap MockProvider
 * for OpenAIResponsesAdapter and the fixture repos for @kerkit/server's
 * Drizzle repositories and you have the real thing.
 */
export function createApp() {
  const app = express();
  app.use(express.json());

  const repos = createFixtureRepositories();
  const pack = argentina;
  const userId = FIXTURE_IDS.user; // Demo mode: single synthetic user.

  // Demo data lives in Feb 2026; pin "now" so the appointment window matches.
  const demoNow = () => new Date('2026-02-01T12:00:00.000Z');

  // One call wires the whole safe path: it owns a RedactionSession and threads
  // it through the patient block, context assembly, tools, and the provider
  // sink — so free-text names never reach the model. (Real multi-user apps build
  // one per request; the demo is single-user so one at boot is fine.)
  const chat = createRedactedChat({
    pack,
    provider: new MockProvider(),
    repos,
    patient: fixturePatient,
    userId,
    assistantName: 'Demo',
    caretakerName: 'Carlos',
    insurerName: 'Obra Social Demo Salud',
    allowSensitiveFields: ['treatmentPhase'],
    sources: defaultSources(repos, pack, { now: demoNow }),
    tools: allTools,
  });

  app.get('/health', (_req, res) => res.json({ ok: true, mode: 'demo' }));

  // The caretaker context window, with the transparency report.
  app.get('/context', async (_req, res) => {
    const ctx = await chat.assembleContext();
    res.json({ contextText: ctx.contextText, explain: ctx.explain() });
  });

  // Chat through the real loop + real tools, scripted model.
  app.post('/chat', async (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message : '';
    if (!message) return res.status(400).json({ error: 'Falta "message".' });

    const result = await chat.respond({ message });
    res.json({ message: result.message, toolCalls: result.toolCalls?.map((t) => t.name) });
  });

  // The data-rights surface, audited.
  app.use(
    '/privacy',
    createPrivacyRouter({ store: createInMemoryPrivacyStore(repos), getUserId: () => userId }),
  );

  return app;
}

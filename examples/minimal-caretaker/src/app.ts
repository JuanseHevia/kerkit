import express from 'express';
import {
  buildPatientContextBlock,
  buildSystemPrompt,
  ContextAssembler,
  defaultSources,
  runChatLoop,
} from '@kerkit/ai';
import { allTools, createToolExecutor, toToolSpecs } from '@kerkit/ai/mcp';
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
  const provider = new MockProvider();

  // The patient block is pre-redacted; its tokens also sweep free text below.
  const patientContext = buildPatientContextBlock(fixturePatient, {
    insurerName: 'Obra Social Demo Salud',
    allowSensitiveFields: ['treatmentPhase'],
  });

  const systemPrompt = buildSystemPrompt({
    pack,
    assistantName: 'Demo',
    caretakerName: 'Carlos',
    careContextBlock: patientContext.block,
  });

  app.get('/health', (_req, res) => res.json({ ok: true, mode: 'demo' }));

  // The caretaker context window, with the transparency report.
  app.get('/context', async (_req, res) => {
    const assembler = new ContextAssembler({ pack });
    // Demo data lives in Feb 2026; pin "now" so the appointment window matches.
    const demoNow = () => new Date('2026-02-01T12:00:00.000Z');
    for (const source of defaultSources(repos, pack, { now: demoNow })) assembler.add(source);
    const ctx = await assembler.assemble(userId, { knownTokens: patientContext.tokens });
    res.json({ contextText: ctx.contextText, explain: ctx.explain() });
  });

  // Chat through the real loop + real tools, scripted model.
  app.post('/chat', async (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message : '';
    if (!message) return res.status(400).json({ error: 'Falta "message".' });

    const result = await runChatLoop({
      provider,
      pack,
      instructions: systemPrompt,
      messages: [{ role: 'user', content: message }],
      tools: toToolSpecs(allTools),
      executeTool: createToolExecutor(allTools, { userId, repos, pack }),
    });

    res.json({ message: result.message, toolCalls: result.toolCalls?.map((t) => t.name) });
  });

  // The data-rights surface, audited.
  app.use(
    '/privacy',
    createPrivacyRouter({ store: createInMemoryPrivacyStore(repos), getUserId: () => userId }),
  );

  return app;
}

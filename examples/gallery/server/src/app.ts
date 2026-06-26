import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { buildPatientContextBlock, buildSystemPrompt } from '@kerkit/ai';
import { createFixtureRepositories } from '@kerkit/ai/demo';
import { argentina } from '@kerkit/pack-argentina';
import { FIXTURE_IDS, fixturePatient } from '@kerkit/core';
import { createPrivacyRouter } from '@kerkit/server';
import type { DemoDeps } from './deps.js';
import { createInMemoryPrivacyStore } from './privacy-store.js';
import { makeProvider } from './provider.js';
import { contextRoute } from './routes/context.js';
import { xrayRoute } from './routes/xray.js';
import { chatRoute } from './routes/chat.js';
import { dashboardRoute } from './routes/dashboard.js';

/** Demo data lives in Feb 2026; pin "now" so the active windows line up. */
export const demoNow = () => new Date('2026-02-01T12:00:00.000Z');

/**
 * The gallery backend: the same wiring as examples/minimal-caretaker (fixtures,
 * locale pack, scripted-or-real provider, audited privacy routes), with a few
 * extra read endpoints the visual scenes consume, and the built SPA served on
 * top when present.
 */
export function createApp() {
  const app = express();
  app.use(express.json());

  const repos = createFixtureRepositories();
  const pack = argentina;
  const userId = FIXTURE_IDS.user; // Demo mode: single synthetic user.
  const { provider, mode } = makeProvider();

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

  const deps: DemoDeps = { repos, pack, userId, provider, patientContext, systemPrompt, now: demoNow };

  app.get('/api/health', (_req, res) => res.json({ ok: true, mode }));
  app.get('/api/context', contextRoute(deps));
  app.post('/api/privacy/xray', xrayRoute(deps));
  app.post('/api/chat', chatRoute(deps));
  app.get('/api/dashboard', dashboardRoute(deps));

  // The data-rights surface, audited (export / delete / consents).
  app.use(
    '/api/privacy',
    createPrivacyRouter({ store: createInMemoryPrivacyStore(repos), getUserId: () => userId }),
  );

  // Serve the built SPA when present (production / container). In dev, Vite
  // serves the UI on its own port and proxies /api here.
  const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    // SPA fallback: any non-API GET serves the app shell so client-side
    // routes (/privacy, /assistant, /dashboard) work on a hard refresh.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile('index.html', { root: webDist });
    });
  }

  return app;
}

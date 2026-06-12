import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

// The CI smoke test the README promises: the whole stack — loop, tools,
// redaction, privacy routes — runs with zero keys and zero infrastructure.
describe('minimal-caretaker demo', () => {
  const app = createApp();

  it('GET /context returns the redacted caretaker context window', async () => {
    const res = await request(app).get('/context');
    expect(res.status).toBe(200);
    // Logistics flow through…
    expect(res.body.contextText).toContain('Quimioterapia — ciclo 3');
    // …identifiers never do (the fixture note contains the synthetic DNI).
    expect(res.body.contextText).not.toContain('12.345.678');
    expect(res.body.contextText).not.toContain('Marta Pérez');
    // The transparency report is part of the contract.
    expect(res.body.explain.sections.length).toBe(6);
    expect(res.body.explain.sweptMatches).toBeGreaterThan(0);
  });

  it('POST /chat runs the tool-calling loop against fixture data', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ message: '¿Cómo viene el trámite de la medicación?' });
    expect(res.status).toBe(200);
    expect(res.body.toolCalls).toEqual(['read_authorizations']);
    expect(res.body.message).toContain('demo');
    expect(res.body.message).not.toContain('12.345.678');
  });

  it('GET /privacy/export delivers the full audited bundle', async () => {
    const res = await request(app).get('/privacy/export');
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notice).toContain('no constituyen una historia clínica');
  });

  it('consent lifecycle works end to end', async () => {
    const grant = await request(app)
      .post('/privacy/consents')
      .send({ scope: 'llm_assistant', policyVersion: 'demo-v1' });
    expect(grant.status).toBe(201);

    const revoke = await request(app).delete('/privacy/consents/llm_assistant');
    expect(revoke.body.revoked).toBe(true);
  });
});

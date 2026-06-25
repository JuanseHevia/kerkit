import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

// The privacy contract, asserted: every scene's API runs on the synthetic
// persona with zero keys, and the raw identifiers never escape redaction.
describe('kerkit gallery API', () => {
  const app = createApp();

  it('GET /api/context returns the redacted context window + transparency report', async () => {
    const res = await request(app).get('/api/context');
    expect(res.status).toBe(200);
    // Logistics flow through…
    expect(res.body.contextText).toContain('Quimioterapia — ciclo 3');
    // …identifiers never do (the fixture note hides the synthetic DNI in prose).
    expect(res.body.contextText).not.toContain('12.345.678');
    expect(res.body.contextText).not.toContain('Marta Pérez');
    expect(res.body.explain.sections.length).toBe(6);
    expect(res.body.explain.sweptMatches).toBeGreaterThan(0);
    expect(Array.isArray(res.body.redactionMap)).toBe(true);
  });

  it('POST /api/privacy/xray (patient) tokenizes identifiers and gates health fields', async () => {
    const res = await request(app).post('/api/privacy/xray').send({ entity: 'patient' });
    expect(res.status).toBe(200);
    // Raw side shows the synthetic identifiers…
    expect(res.body.raw.name).toBe('Marta Pérez');
    expect(res.body.raw.nationalId).toBe('12.345.678');
    // …the model side never does.
    expect(res.body.redacted.name).toBe('«NAME»');
    expect(res.body.redacted.nationalId).toBe('«NATIONAL_ID»');
    expect(JSON.stringify(res.body.redacted)).not.toContain('12.345.678');

    const byField = Object.fromEntries(
      res.body.fields.map((f: { field: string }) => [f.field, f]),
    );
    expect(byField.name.disposition).toBe('tokenized');
    expect(byField.diagnosis.disposition).toBe('dropped'); // sensitive, not allowed
    expect(byField.treatmentPhase.disposition).toBe('allowed'); // opt-in
  });

  it('POST /api/privacy/xray (note) scrubs the DNI AND the name hidden in free text', async () => {
    const res = await request(app).post('/api/privacy/xray').send({ entity: 'note' });
    expect(res.status).toBe(200);
    // The dedicated sweep panel: both identifiers caught.
    expect(res.body.sweep.before).toContain('12.345.678');
    expect(res.body.sweep.after).not.toContain('12.345.678');
    expect(res.body.sweep.after).not.toContain('Marta Pérez');
    expect(res.body.sweep.matches.length).toBeGreaterThan(0);
    // The "what the model sees" projection must reflect the swept content —
    // not the raw passthrough. This is what the X-Ray's right pane renders.
    expect(JSON.stringify(res.body.redacted)).not.toContain('12.345.678');
    expect(JSON.stringify(res.body.redacted)).not.toContain('Marta Pérez');
    const content = res.body.fields.find((f: { field: string }) => f.field === 'content');
    expect(content.disposition).toBe('swept');
  });

  it('POST /api/chat runs the tool loop with no PII leak', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: '¿Cómo viene el trámite de la medicación?' });
    expect(res.status).toBe(200);
    expect(res.body.toolCalls.map((t: { name: string }) => t.name)).toEqual(['read_authorizations']);
    expect(res.body.message).not.toContain('12.345.678');
    expect(res.body.leakCheck.leaked).toBe(false);
  });

  it('POST /api/chat (read_notes path) does not leak the name hiding in note prose', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'Mostrame las notas' });
    expect(res.status).toBe(200);
    expect(res.body.toolCalls.map((t: { name: string }) => t.name)).toEqual(['read_notes']);
    // The note fixture content embeds "Marta Pérez, DNI 12.345.678" in free text.
    // Neither may survive into anything the model produced.
    const haystack = JSON.stringify(res.body);
    expect(haystack).not.toContain('Marta Pérez');
    expect(haystack).not.toContain('12.345.678');
    expect(res.body.leakCheck.leaked).toBe(false);
  });

  it('GET /api/dashboard exposes treatment, care events, and checklist roll-up', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(200);
    // Treatment: 2 of 6 sessions done, now in cycle 3.
    expect(res.body.treatment.totalSessions).toBe(6);
    expect(res.body.treatment.completedSessions).toBe(2);
    expect(res.body.treatment.currentCycle).toBe(3);
    expect(res.body.treatment.fraction).toBeCloseTo(2 / 6, 5);
    // Care events: chemo requires authorization and has a linked trámite.
    expect(res.body.careEvents).toHaveLength(2);
    const chemo = res.body.careEvents.find((e: { type: string }) => e.type === 'chemo');
    expect(chemo.requiresAuthorization).toBe(true);
    expect(chemo.authorization).toBeTruthy();
    // Checklist: 1 of 2 done; the meds task is unblocked now the lab is done.
    expect(res.body.checklist.progress.total).toBe(2);
    expect(res.body.checklist.progress.done).toBe(1);
    const meds = res.body.checklist.tasks.find((t: { kind: string }) => t.kind === 'medication');
    expect(meds.canComplete).toBe(true);
  });

  it('GET /api/privacy/export delivers the audited bundle', async () => {
    const res = await request(app).get('/api/privacy/export');
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notice).toContain('no constituyen una historia clínica');
  });
});

import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { AuditEvent, ConsentRecord, ConsentScope, NewAuditEvent } from '@kerkit/core';
import { createPrivacyRouter } from './router.js';
import type { PrivacyStore } from './store.js';

const USER = '00000000-0000-4000-8000-000000000001';

function createInMemoryStore() {
  const consents: ConsentRecord[] = [];
  const audits: AuditEvent[] = [];
  let deleted = false;

  const store: PrivacyStore = {
    async exportAll() {
      return {
        exportedAt: new Date('2026-02-01T12:00:00.000Z'),
        notice: 'demo',
        notes: [{ id: 'n1', content: 'demo note' }],
        users: [{ id: USER }],
      };
    },
    async deleteAll() {
      deleted = true;
      return { deleted: { notes: 1, users: 1 } };
    },
    async grantConsent({ userId, scope, policyVersion }) {
      const record: ConsentRecord = {
        id: `00000000-0000-4000-8000-00000000010${consents.length}`,
        userId,
        scope,
        policyVersion,
        grantedAt: new Date('2026-02-01T12:00:00.000Z'),
        revokedAt: null,
      };
      consents.push(record);
      return record;
    },
    async revokeConsent({ scope }) {
      const active = consents.find((c) => c.scope === scope && c.revokedAt == null);
      if (!active) return false;
      active.revokedAt = new Date('2026-02-02T12:00:00.000Z');
      return true;
    },
    async listConsents() {
      return consents;
    },
    async appendAudit(event: NewAuditEvent) {
      audits.push({ ...event, id: `a${audits.length}`, at: event.at ?? new Date() } as AuditEvent);
    },
  };

  return { store, consents, audits, wasDeleted: () => deleted };
}

function makeApp(store: PrivacyStore, userId: string | null = USER) {
  const app = express();
  app.use('/privacy', createPrivacyRouter({ store, getUserId: () => userId }));
  return app;
}

describe('privacy router', () => {
  it('rejects unauthenticated requests on every route', async () => {
    const { store } = createInMemoryStore();
    const app = makeApp(store, null);
    for (const [method, path] of [
      ['get', '/privacy/export'],
      ['delete', '/privacy/data'],
      ['get', '/privacy/consents'],
      ['post', '/privacy/consents'],
    ] as const) {
      const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[
        method
      ](path);
      expect(res.status).toBe(401);
    }
  });

  it('GET /export returns the bundle and audits request + delivery', async () => {
    const helper = createInMemoryStore();
    const res = await request(makeApp(helper.store)).get('/privacy/export');
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(1);
    expect(helper.audits.map((a) => a.action)).toEqual(['export_requested', 'export_delivered']);
  });

  it('DELETE /data deletes everything and audits before and after', async () => {
    const helper = createInMemoryStore();
    const res = await request(makeApp(helper.store)).delete('/privacy/data');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, deleted: { notes: 1, users: 1 } });
    expect(helper.wasDeleted()).toBe(true);
    expect(helper.audits.map((a) => a.action)).toEqual([
      'deletion_requested',
      'deletion_completed',
    ]);
  });

  it('consent lifecycle: grant → list → revoke, all audited', async () => {
    const helper = createInMemoryStore();
    const app = makeApp(helper.store);

    const grant = await request(app)
      .post('/privacy/consents')
      .send({ scope: 'llm_assistant' satisfies ConsentScope, policyVersion: 'v1' });
    expect(grant.status).toBe(201);
    expect(grant.body.consent.scope).toBe('llm_assistant');

    const list = await request(app).get('/privacy/consents');
    expect(list.body.consents).toHaveLength(1);

    const revoke = await request(app).delete('/privacy/consents/llm_assistant');
    expect(revoke.body.revoked).toBe(true);

    expect(helper.audits.map((a) => a.action)).toEqual(['consent_granted', 'consent_revoked']);
  });

  it('rejects unknown consent scopes', async () => {
    const helper = createInMemoryStore();
    const app = makeApp(helper.store);

    const bad = await request(app)
      .post('/privacy/consents')
      .send({ scope: 'surveillance', policyVersion: 'v1' });
    expect(bad.status).toBe(400);

    const badRevoke = await request(app).delete('/privacy/consents/surveillance');
    expect(badRevoke.status).toBe(400);
  });
});

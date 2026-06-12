import { Router, json } from 'express';
import type { Request, Response } from 'express';
import { consentScopeEnum } from '@kerkit/core';
import { z } from 'zod';
import type { PrivacyStore } from './store.js';

export interface PrivacyRouterOptions {
  store: PrivacyStore;
  /**
   * Resolve the authenticated user for a request — your auth integration
   * (Clerk, Auth0, sessions…). Return null for unauthenticated.
   */
  getUserId: (req: Request) => Promise<string | null> | string | null;
}

const grantBody = z.object({
  scope: consentScopeEnum,
  policyVersion: z.string().min(1).max(50),
});

/**
 * Mountable privacy endpoints — the Ley 25.326 / data-rights surface:
 *
 *   GET    /export            full data export (right of access)
 *   DELETE /data              delete everything (right of erasure)
 *   GET    /consents          list consent records
 *   POST   /consents          grant a consent scope
 *   DELETE /consents/:scope   revoke a consent scope
 *
 * Every operation writes an audit event via the store.
 */
export function createPrivacyRouter(options: PrivacyRouterOptions): Router {
  const router = Router();
  router.use(json());

  const requireUser = async (req: Request, res: Response): Promise<string | null> => {
    const userId = await options.getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'No autenticado.' });
      return null;
    }
    return userId;
  };

  router.get('/export', async (req, res) => {
    const userId = await requireUser(req, res);
    if (!userId) return;
    try {
      await options.store.appendAudit({ actor: userId, action: 'export_requested' });
      const bundle = await options.store.exportAll(userId);
      await options.store.appendAudit({
        actor: userId,
        action: 'export_delivered',
        context: { entities: Object.keys(bundle).filter((k) => k !== 'exportedAt' && k !== 'notice') },
      });
      res.json(bundle);
    } catch {
      res.status(500).json({ error: 'No se pudo generar la exportación.' });
    }
  });

  router.delete('/data', async (req, res) => {
    const userId = await requireUser(req, res);
    if (!userId) return;
    try {
      // Audit first: after deleteAll the user row is gone.
      await options.store.appendAudit({ actor: userId, action: 'deletion_requested' });
      const result = await options.store.deleteAll(userId);
      await options.store.appendAudit({
        actor: userId,
        action: 'deletion_completed',
        context: { deleted: result.deleted },
      });
      res.json({ success: true, deleted: result.deleted });
    } catch {
      res.status(500).json({ error: 'No se pudo completar el borrado.' });
    }
  });

  router.get('/consents', async (req, res) => {
    const userId = await requireUser(req, res);
    if (!userId) return;
    res.json({ consents: await options.store.listConsents(userId) });
  });

  router.post('/consents', async (req, res) => {
    const userId = await requireUser(req, res);
    if (!userId) return;
    const parsed = grantBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'scope o policyVersion inválidos.' });
    }
    const record = await options.store.grantConsent({ userId, ...parsed.data });
    await options.store.appendAudit({
      actor: userId,
      action: 'consent_granted',
      context: { scope: parsed.data.scope, policyVersion: parsed.data.policyVersion },
    });
    res.status(201).json({ consent: record });
  });

  router.delete('/consents/:scope', async (req, res) => {
    const userId = await requireUser(req, res);
    if (!userId) return;
    const scope = consentScopeEnum.safeParse(req.params.scope);
    if (!scope.success) return res.status(400).json({ error: 'scope inválido.' });
    const revoked = await options.store.revokeConsent({ userId, scope: scope.data });
    if (revoked) {
      await options.store.appendAudit({
        actor: userId,
        action: 'consent_revoked',
        context: { scope: scope.data },
      });
    }
    res.json({ revoked });
  });

  return router;
}

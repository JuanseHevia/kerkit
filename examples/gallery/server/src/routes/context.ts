import type { Request, Response } from 'express';
import { ContextAssembler, defaultSources } from '@kerkit/ai';
import type { DemoDeps } from '../deps.js';

/**
 * GET /api/context — the caretaker context window the model is allowed to see,
 * plus the transparency report (what was included / tokenized / swept) and the
 * placeholder→value rehydration map the UI uses to show the redacted tokens.
 */
export function contextRoute(deps: DemoDeps) {
  return async (_req: Request, res: Response) => {
    const assembler = new ContextAssembler({ pack: deps.pack });
    for (const source of defaultSources(deps.repos, deps.pack, { now: deps.now })) {
      assembler.add(source);
    }
    const ctx = await assembler.assemble(deps.userId, { session: deps.session });

    res.json({
      contextText: ctx.contextText,
      explain: ctx.explain(),
      redactionMap: [...ctx.redactionMap.entries()],
    });
  };
}

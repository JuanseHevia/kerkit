import type { Request, Response } from 'express';
import { runChatLoop } from '@kerkit/ai';
import type { ToolCallRequest } from '@kerkit/ai';
import { allTools, createToolExecutor, toToolSpecs } from '@kerkit/ai/mcp';
import { fixturePatient, fixtureUser, sweepText } from '@kerkit/core';
import type { DemoDeps } from '../deps.js';

/**
 * Every direct-identifier value in the synthetic persona. The leak check scans
 * the assistant's output (answer + tool I/O) for ALL of these, so the green
 * "no PII leaked" badge means what it says — not just "the two we remembered".
 */
const SENSITIVE_VALUES = [
  fixturePatient.name,
  fixturePatient.nationalId,
  fixturePatient.credentialNumber,
  fixtureUser.name,
  fixtureUser.email,
].filter((v): v is string => typeof v === 'string' && v.length > 0);

/**
 * POST /api/chat { message } — the real provider-agnostic tool-calling loop
 * over fixture data. Returns the answer, the full tool-call trace
 * (name + args + result), and a leak check proving no raw identifier appears
 * in anything the model produced.
 */
export function chatRoute(deps: DemoDeps) {
  const patterns = deps.pack.identifierPatterns ?? [];
  const knownTokens = deps.patientContext.tokens;

  // The SDK's tool redaction scrubs each row's own direct-identifier fields and
  // sweeps for identifier *patterns* (DNI/CUIL). A patient name hiding in a
  // note's free text is neither — so we thread the app's known-token map
  // («NAME» → real name) through the tool output, the same defense the
  // ContextAssembler applies to the context window. Threading your identifier
  // tokens through every model boundary is the app's job.
  const baseExecutor = createToolExecutor(allTools, {
    userId: deps.userId,
    repos: deps.repos,
    pack: deps.pack,
  });
  const executeTool = async (call: ToolCallRequest): Promise<unknown> => {
    const result = await baseExecutor(call);
    return typeof result === 'string' ? sweepText(result, patterns, knownTokens).text : result;
  };

  return async (req: Request, res: Response) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) return res.status(400).json({ error: 'Falta "message".' });

    const result = await runChatLoop({
      provider: deps.provider,
      pack: deps.pack,
      instructions: deps.systemPrompt,
      messages: [{ role: 'user', content: message }],
      tools: toToolSpecs(allTools),
      executeTool,
    });

    const toolCalls = result.toolCalls ?? [];
    const haystack = JSON.stringify({ message: result.message, toolCalls });
    const leakedValues = SENSITIVE_VALUES.filter((v) => haystack.includes(v));

    res.json({
      message: result.message,
      rounds: result.rounds,
      toolCalls,
      leakCheck: {
        scanned: SENSITIVE_VALUES.length,
        leaked: leakedValues.length > 0,
      },
    });
  };
}

import { describe, expect, it } from 'vitest';
import { FIXTURE_IDS, fixturePatient, RedactionSession } from '@kerkit/core';
import { argentina } from '@kerkit/pack-argentina';
import { createRedactedChat } from './factory.js';
import { defaultSources } from './context/sources.js';
import { allTools } from './mcp/tools.js';
import { runChatLoop } from './loop/chat-loop.js';
import { createFixtureRepositories } from './test-helpers.js';
import type { GenerateOptions, ProviderAdapter, ProviderTurn } from './messages.js';

// The synthetic persona's identifiers — the canaries. The fixture note embeds
// "Marta Pérez, DNI 12.345.678" in free text (persona.ts), so read_notes is a
// live name+DNI ingress.
const NAME = fixturePatient.name; // 'Marta Pérez' — NOT regex-matchable
const DNI = fixturePatient.nationalId; // '12.345.678' — regex-matchable

const NOW = () => new Date('2026-02-01T12:00:00.000Z');

/** Records every GenerateOptions the provider receives; scripts a read_notes call. */
function recordingProvider(): ProviderAdapter & {
  calls: GenerateOptions[];
  received(needle: string): boolean;
} {
  const calls: GenerateOptions[] = [];
  let round = 0;
  return {
    calls,
    received(needle: string) {
      return calls.some(
        (c) =>
          c.instructions.includes(needle) ||
          c.input.some((m) => m.content.includes(needle)) ||
          (c.toolResults ?? []).some((r) => r.output.includes(needle)),
      );
    },
    async generate(opts): Promise<ProviderTurn> {
      calls.push(opts);
      round += 1;
      if (round === 1) {
        return { text: null, toolCalls: [{ id: 'c1', name: 'read_notes', arguments: {} }], state: { r: 1 } };
      }
      return { text: 'Listo.', toolCalls: [], state: null };
    },
  };
}

describe('Layer-0 canary — the provider sink (A1)', () => {
  it('SAFE PATH (createRedactedChat): no canary value reaches the provider', async () => {
    const provider = recordingProvider();
    const chat = createRedactedChat({
      pack: argentina,
      provider,
      repos: createFixtureRepositories(),
      patient: fixturePatient,
      userId: FIXTURE_IDS.user,
      assistantName: 'Demo',
      allowSensitiveFields: ['treatmentPhase'],
      sources: defaultSources(createFixtureRepositories(), argentina, { now: NOW }),
      tools: allTools,
    });

    await chat.respond({ message: '¿Qué dice la última nota?' });

    // The read_notes output contained the name + DNI in free text — the sink
    // scrubbed both before they reached the model.
    expect(provider.calls.length).toBeGreaterThanOrEqual(2);
    expect(provider.received(NAME)).toBe(false); // non-regex name — known-value sweep
    expect(provider.received(DNI)).toBe(false); // regex sweep
    // And the observability surface is populated.
    // (the last respond() call carries the session's explain())
  });

  it('sweeps instructions, messages, every registered tool result, and exceptions', async () => {
    const CANARY = 'Persona Canary Única';
    const session = new RedactionSession({
      patterns: argentina.identifierPatterns,
      seedTokens: new Map([['«CANARY_1»', CANARY]]),
    });

    for (const tool of allTools) {
      const calls: GenerateOptions[] = [];
      let round = 0;
      const provider: ProviderAdapter = {
        async generate(options) {
          calls.push(options);
          round += 1;
          return round === 1
            ? { text: null, toolCalls: [{ id: 'c1', name: tool.name, arguments: {} }], state: null }
            : { text: 'ok', toolCalls: [], state: null };
        },
      };
      await runChatLoop({
        provider,
        pack: argentina,
        session,
        instructions: `Instrucciones para ${CANARY}`,
        messages: [{ role: 'user', content: `Mensaje de ${CANARY}` }],
        executeTool: async () => ({ echoed: CANARY }),
      });
      expect(JSON.stringify(calls), `${tool.name} leaked the canary`).not.toContain(CANARY);
    }

    const errors: GenerateOptions[] = [];
    let errorRound = 0;
    await runChatLoop({
      provider: {
        async generate(options) {
          errors.push(options);
          errorRound += 1;
          return errorRound === 1
            ? { text: null, toolCalls: [{ id: 'e1', name: 'read_email', arguments: {} }], state: null }
            : { text: 'ok', toolCalls: [], state: null };
        },
      },
      pack: argentina,
      session,
      instructions: 'safe',
      messages: [{ role: 'user', content: 'safe' }],
      executeTool: async () => {
        throw new Error(`falló para ${CANARY}`);
      },
    });
    expect(JSON.stringify(errors)).not.toContain(CANARY);
  });

  it('cross-session identity: the note-text name maps to the SAME token as the patient field', async () => {
    const provider = recordingProvider();
    const chat = createRedactedChat({
      pack: argentina,
      provider,
      repos: createFixtureRepositories(),
      patient: fixturePatient,
      userId: FIXTURE_IDS.user,
      assistantName: 'Demo',
      sources: defaultSources(createFixtureRepositories(), argentina, { now: NOW }),
      tools: allTools,
    });

    const result = await chat.respond({ message: '¿Qué dice la última nota?' });

    // One token for the patient, reachable for UI rehydration.
    const patientToken = [...chat.session.tokenToValue().entries()].find(([, v]) => v === NAME)?.[0];
    expect(patientToken).toBeDefined();
    // The provider saw that token (in the tool output) rather than the name.
    expect(provider.received(patientToken!)).toBe(true);
    // Observability is exposed on the loop result.
    expect(result.redaction).toBeDefined();
    expect(result.redaction!.tokensAllocated.length).toBeGreaterThan(0);
  });
});

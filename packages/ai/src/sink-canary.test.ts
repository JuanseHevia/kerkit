import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_IDS, fixturePatient } from '@kerkit/core';
import { argentina } from '@kerkit/pack-argentina';
import { createRedactedChat } from './factory.js';
import { runChatLoop } from './loop/chat-loop.js';
import { buildPatientContextBlock, buildSystemPrompt } from './prompts/builder.js';
import { defaultSources } from './context/sources.js';
import { allTools } from './mcp/tools.js';
import { createToolExecutor, toToolSpecs } from './mcp/executor.js';
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

  it('UNSAFE PATH (raw runChatLoop, no session): the name LEAKS — proves the guarantee is opt-in', async () => {
    const provider = recordingProvider();
    const repos = createFixtureRepositories();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { block } = buildPatientContextBlock(fixturePatient); // no session
    const systemPrompt = buildSystemPrompt({
      pack: argentina,
      assistantName: 'Demo',
      careContextBlock: block,
    });

    await runChatLoop({
      provider,
      pack: argentina,
      instructions: systemPrompt,
      messages: [{ role: 'user', content: '¿Qué dice la última nota?' }],
      tools: toToolSpecs(allTools),
      // ToolContext WITHOUT a session — the legacy tool path can't sweep the name.
      executeTool: createToolExecutor(allTools, { userId: FIXTURE_IDS.user, repos, pack: argentina }),
      // no session — the sink is off
    });

    // DNI is still caught by the tool-level regex sweep…
    expect(provider.received(DNI)).toBe(false);
    // …but the NAME leaks — this is the bug the safe path closes.
    expect(provider.received(NAME)).toBe(true);
    // And the developer was warned that a patient context ran unprotected.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('KRK_NO_SESSION'));
    warn.mockRestore();
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

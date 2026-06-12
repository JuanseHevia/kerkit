import { describe, expect, it, vi } from 'vitest';
import { argentina } from '@kerkit/pack-argentina';
import { runChatLoop } from './chat-loop.js';
import type { GenerateOptions, ProviderAdapter, ProviderTurn } from '../messages.js';

function scriptedProvider(turns: Array<Partial<ProviderTurn>>): ProviderAdapter & {
  calls: GenerateOptions[];
} {
  const calls: GenerateOptions[] = [];
  let i = 0;
  return {
    calls,
    async generate(opts) {
      calls.push(opts);
      const turn = turns[Math.min(i++, turns.length - 1)];
      return { text: null, toolCalls: [], state: { round: i }, ...turn };
    },
  };
}

const BASE = {
  pack: argentina,
  instructions: 'test',
  messages: [{ role: 'user' as const, content: 'hola' }],
};

describe('runChatLoop', () => {
  it('returns the text answer directly when no tools are called', async () => {
    const provider = scriptedProvider([{ text: 'Todo en orden.' }]);
    const result = await runChatLoop({ ...BASE, provider });
    expect(result.message).toBe('Todo en orden.');
    expect(result.rounds).toBe(1);
    expect(result.toolCalls).toBeUndefined();
  });

  it('executes tool calls, feeds results back with state, then returns the answer', async () => {
    const provider = scriptedProvider([
      { toolCalls: [{ id: 'c1', name: 'read_authorizations', arguments: { status: 'pending' } }] },
      { text: 'El trámite está en proceso.' },
    ]);
    const executeTool = vi.fn(async () => ({ rows: 1 }));

    const result = await runChatLoop({ ...BASE, provider, executeTool });

    expect(result.message).toBe('El trámite está en proceso.');
    expect(result.rounds).toBe(2);
    expect(result.toolCalls).toEqual([
      { name: 'read_authorizations', args: { status: 'pending' }, result: { rows: 1 } },
    ]);
    // Second provider call carries the opaque state + the tool results.
    expect(provider.calls[1].state).toEqual({ round: 1 });
    expect(provider.calls[1].toolResults).toEqual([
      { id: 'c1', name: 'read_authorizations', output: JSON.stringify({ rows: 1 }) },
    ]);
  });

  it('reports tool errors to the model instead of throwing', async () => {
    const provider = scriptedProvider([
      { toolCalls: [{ id: 'c1', name: 'read_email', arguments: {} }] },
      { text: 'No pude consultar el correo.' },
    ]);
    const executeTool = vi.fn(async () => {
      throw new Error('not connected');
    });

    const result = await runChatLoop({ ...BASE, provider, executeTool });
    expect(result.message).toBe('No pude consultar el correo.');
    expect(provider.calls[1].toolResults?.[0].output).toContain('not connected');
  });

  it('falls back with the pack copy when rounds are exhausted', async () => {
    const provider = scriptedProvider([
      { toolCalls: [{ id: 'c1', name: 'read_notes', arguments: {} }] },
    ]);
    const result = await runChatLoop({
      ...BASE,
      provider,
      executeTool: async () => 'ok',
      maxRounds: 3,
    });
    expect(result.message).toBe(argentina.strings['assistant.fallback.toolRoundsExhausted']);
    expect(result.rounds).toBe(3);
    expect(result.toolCalls).toHaveLength(3);
  });

  it('uses the pack fallback when the model returns empty text', async () => {
    const provider = scriptedProvider([{ text: null }]);
    const result = await runChatLoop({ ...BASE, provider });
    expect(result.message).toBe(argentina.strings['assistant.fallback.empty']);
  });
});

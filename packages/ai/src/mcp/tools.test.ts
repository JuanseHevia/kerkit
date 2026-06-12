import { describe, expect, it } from 'vitest';
import { FIXTURE_IDS } from '@kerkit/core';
import { argentina } from '@kerkit/pack-argentina';
import { allTools, readPrescriptionsTool, writeNoteTool } from './tools.js';
import { createToolExecutor, toToolSpecs } from './executor.js';
import { createFixtureRepositories } from '../test-helpers.js';
import type { ToolContext } from './types.js';

function makeContext(): ToolContext & { repos: ReturnType<typeof createFixtureRepositories> } {
  return { userId: FIXTURE_IDS.user, repos: createFixtureRepositories(), pack: argentina };
}

describe('toToolSpecs', () => {
  it('produces JSON schemas with enums, defaults, and required fields', () => {
    const specs = toToolSpecs(allTools);
    expect(specs).toHaveLength(9);

    const readAppointments = specs.find((s) => s.name === 'read_appointments')!;
    const props = readAppointments.parameters.properties as Record<string, Record<string, unknown>>;
    expect(props.status.enum).toContain('upcoming');
    expect(props.limit.default).toBe(20);
    expect(readAppointments.parameters.required).toBeUndefined(); // all optional/defaulted

    const writeNote = specs.find((s) => s.name === 'write_note')!;
    expect(writeNote.parameters.required).toEqual(['content']);
  });
});

describe('tool execution', () => {
  it('read_prescriptions returns medication (opted in) but never identifiers', async () => {
    const context = makeContext();
    const execute = createToolExecutor(allTools, context);
    const output = (await execute({
      id: 'c1',
      name: 'read_prescriptions',
      arguments: { status: 'active' },
    })) as string;

    expect(output).toContain('Medicamento Demo 50mg');
    expect(output).not.toContain('12.345.678');
  });

  it('read_notes sweeps identifiers hiding in note content', async () => {
    const context = makeContext();
    const execute = createToolExecutor(allTools, context);
    const output = (await execute({ id: 'c1', name: 'read_notes', arguments: {} })) as string;

    expect(output).toContain('Preguntas para la Dra.');
    expect(output).not.toContain('12.345.678');
  });

  it('write_note creates the note scoped to the context user', async () => {
    const context = makeContext();
    const execute = createToolExecutor(allTools, context);
    const output = (await execute({
      id: 'c1',
      name: 'write_note',
      arguments: { content: 'Llamar a autorizaciones el lunes', tags: ['tramite'] },
    })) as string;

    expect(output).toContain('Nota guardada correctamente.');
    expect(context.repos.createdNotes).toHaveLength(1);
    expect(context.repos.createdNotes[0].userId).toBe(FIXTURE_IDS.user);
  });

  it('rejects invalid arguments via the Zod schema', async () => {
    const execute = createToolExecutor([writeNoteTool], makeContext());
    await expect(
      execute({ id: 'c1', name: 'write_note', arguments: { content: '' } }),
    ).rejects.toThrow();
  });

  it('external tools degrade gracefully when no connection exists', async () => {
    const execute = createToolExecutor(allTools, makeContext());
    const output = await execute({
      id: 'c1',
      name: 'read_email',
      arguments: { query: 'autorización' },
    });
    expect(output).toMatchObject({ error: expect.stringContaining('no está conectado') });
  });

  it('external tools work when the seam is implemented', async () => {
    const context = {
      ...makeContext(),
      external: {
        searchEmail: async () => [
          { subject: 'Su autorización fue aprobada', sender: 'demo', date: '2026-02-01', snippet: '…' },
        ],
      },
    };
    const execute = createToolExecutor(allTools, context);
    const output = (await execute({
      id: 'c1',
      name: 'read_email',
      arguments: { query: 'autorización' },
    })) as string;
    expect(output).toContain('aprobada');
  });

  it('redactedRowsResult applies per-tool sensitive opt-ins only', async () => {
    const context = makeContext();
    const result = await readPrescriptionsTool.handler({ limit: 20 }, context);
    const text = result.content[0].text;
    expect(text).toContain('medicationName');
    expect(text).not.toContain('"treatmentPhase"'); // not opted in for this tool
  });
});

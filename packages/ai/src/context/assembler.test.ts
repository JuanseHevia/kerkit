import { describe, expect, it } from 'vitest';
import { FIXTURE_IDS, fixturePatient, RedactionSession, SWEEP_PLACEHOLDER } from '@kerkit/core';
import { argentina } from '@kerkit/pack-argentina';
import { ContextAssembler } from './assembler.js';
import { defaultSources } from './sources.js';
import { buildPatientContextBlock } from '../prompts/builder.js';
import { createFixtureRepositories } from '../test-helpers.js';

const NOW = () => new Date('2026-02-01T12:00:00.000Z');

function makeAssembler(repos = createFixtureRepositories()) {
  const assembler = new ContextAssembler({ pack: argentina });
  const sources = defaultSources(repos, argentina);
  // Pin "now" for the appointments window.
  sources[0] = { ...sources[0], fetch: (userId) => repos.appointments.list({ userId, limit: 10 }) };
  for (const s of sources) assembler.add(s);
  return assembler;
}

function session() {
  return new RedactionSession({ patterns: argentina.identifierPatterns });
}

describe('ContextAssembler', () => {
  it('includes the caretaker logistics the assistant needs', async () => {
    const ctx = await makeAssembler().assemble(FIXTURE_IDS.user, { session: session() });
    expect(ctx.contextText).toContain('Quimioterapia — ciclo 3');
    expect(ctx.contextText).toContain('Autorización de Medicamento Demo 50mg');
    expect(ctx.contextText).toContain(argentina.strings['context.section.appointments']);
    expect(ctx.contextText).toContain('Medicamento Demo 50mg'); // opted-in sensitive field
  });

  it('never leaks the DNI — even when it hides inside note free text', async () => {
    const ctx = await makeAssembler().assemble(FIXTURE_IDS.user, { session: session() });
    expect(ctx.contextText).not.toContain('12.345.678');
    expect(ctx.contextText).toContain(SWEEP_PLACEHOLDER);
  });

  it('sweeps the patient name from note text when known tokens are passed', async () => {
    const shared = session();
    const { tokens } = buildPatientContextBlock(fixturePatient, { session: shared });
    const ctx = await makeAssembler().assemble(FIXTURE_IDS.user, { session: shared });
    expect(ctx.contextText).not.toContain('Marta Pérez');
    const token = [...tokens.keys()].find((value) => value.includes('PATIENT_NAME'))!;
    expect(ctx.contextText).toContain(token);
    expect(ctx.redactionMap.get(token)).toBe('Marta Pérez');
  });

  it('explain() reports sections, budgets, and sweep activity', async () => {
    const ctx = await makeAssembler().assemble(FIXTURE_IDS.user, { session: session() });
    const report = ctx.explain();
    expect(report.sections.map((s) => s.key)).toEqual([
      'appointments',
      'prescriptions',
      'authorizations',
      'notes',
      'checkpoints',
      'signals',
    ]);
    const notes = report.sections.find((s) => s.key === 'notes');
    expect(notes?.included).toBeGreaterThan(0);
    expect(report.sweptMatches).toBeGreaterThan(0); // the DNI in the note
    const prescriptions = report.sections.find((s) => s.key === 'prescriptions');
    expect(prescriptions?.sensitiveAllowed).toContain('medicationName');
  });

  it('enforces maxItems budgets and reports drops', async () => {
    const repos = createFixtureRepositories();
    const assembler = new ContextAssembler({ pack: argentina }).add({
      key: 'appointments',
      heading: 'TURNOS',
      priority: 1,
      maxItems: 1,
      fetch: (userId) => repos.appointments.list({ userId }) as Promise<Array<Record<string, unknown>>>,
      classification: (await import('@kerkit/core')).appointmentClassification,
      formatItem: (a) => String(a.title),
    });
    const ctx = await assembler.assemble(FIXTURE_IDS.user, { session: session() });
    const section = ctx.explain().sections[0];
    expect(section.fetched).toBe(2);
    expect(section.included).toBe(1);
    expect(section.dropped).toBe(1);
  });
});

#!/usr/bin/env node
/**
 * kerkit demo — the privacy X-ray, in one command.
 *
 *   npx github:JuanseHevia/kerkit
 *
 * Runs the same wiring as examples/minimal-caretaker over the synthetic persona:
 * no database, no OAuth, no API key. Shows the raw caretaker record vs. the
 * tokenized projection the model receives, then runs a real tool-calling turn
 * and proves neither the raw DNI *nor the patient's name* reached the model —
 * including the name hiding inside a note's free text.
 */
import { createRedactedChat, defaultSources } from '@kerkit/ai';
import { allTools } from '@kerkit/ai/mcp';
import { createFixtureRepositories } from '@kerkit/ai/demo';
import { argentina } from '@kerkit/pack-argentina';
import { FIXTURE_IDS, fixturePatient } from '@kerkit/core';

const RAW_DNI = fixturePatient.nationalId; // '12.345.678' — regex-matchable.
const RAW_NAME = fixturePatient.name; // 'Marta Pérez' — NOT regex-matchable.

function line(label, value) {
  return `  ${label.padEnd(14)}= ${value}`;
}

/** A provider that asks for the notes (which embed name + DNI in free text),
 *  then answers — recording everything it was sent. */
function recordingProvider() {
  const seen = [];
  let round = 0;
  return {
    seen,
    received(needle) {
      return seen.some(
        (c) =>
          c.instructions.includes(needle) ||
          c.input.some((m) => m.content.includes(needle)) ||
          (c.toolResults ?? []).some((r) => r.output.includes(needle)),
      );
    },
    async generate(opts) {
      seen.push(opts);
      round += 1;
      if (round === 1) {
        return { text: null, toolCalls: [{ id: 'c1', name: 'read_notes', arguments: {} }], state: { r: 1 } };
      }
      return { text: '(demo) Leí la nota; ningún dato real llegó hasta acá.', toolCalls: [], state: null };
    },
  };
}

async function main() {
  console.log('\n🧰 kerkit demo — the privacy X-ray (synthetic persona, no DB, no API key)\n');

  const pack = argentina;
  const repos = createFixtureRepositories();
  const provider = recordingProvider();
  const demoNow = () => new Date('2026-02-01T12:00:00.000Z');

  // One call wires the safe path: a RedactionSession threaded through the
  // patient block, context assembly, tools, and the provider sink.
  const chat = createRedactedChat({
    pack,
    provider,
    repos,
    patient: fixturePatient,
    userId: FIXTURE_IDS.user,
    assistantName: 'Demo',
    insurerName: 'Obra Social Demo Salud',
    allowSensitiveFields: ['treatmentPhase'],
    sources: defaultSources(repos, pack, { now: demoNow }),
    tools: allTools,
  });

  console.log('Raw caretaker record (what your database holds):');
  console.log(line('patient.name', JSON.stringify(fixturePatient.name)));
  console.log(line('patient.dni', JSON.stringify(fixturePatient.nationalId)));
  console.log(line('credential', JSON.stringify(fixturePatient.credentialNumber)));
  console.log('');

  // Assemble the window + run one tool-calling turn (read_notes → the note
  // contains "Marta Pérez, DNI 12.345.678" in free text).
  await chat.assembleContext();
  await chat.respond({ message: '¿Qué dice la última nota?' });

  console.log('What the model actually receives (tokenized projection):');
  for (const [token, value] of chat.session.tokenToValue()) {
    console.log(`  ${value.padEnd(38)} →  ${token}`);
  }
  console.log('');

  // Leak check: neither the raw DNI (regex) nor the raw NAME (free text) may
  // appear in ANYTHING the recording provider was sent, across every round.
  console.log(`🔍 Leak check — scanned every model input for the raw DNI (${RAW_DNI}) and name (${RAW_NAME}):`);
  const dniLeaked = provider.received(RAW_DNI);
  const nameLeaked = provider.received(RAW_NAME);
  if (dniLeaked || nameLeaked) {
    const which = [dniLeaked && 'DNI', nameLeaked && 'name'].filter(Boolean).join(' + ');
    console.log(`  ❌ FAIL — the raw ${which} reached the model. This is a bug; please open an issue.\n`);
    process.exitCode = 1;
    return;
  }
  console.log('  ✅ PASS — no raw identifier (DNI or name) reached the model.\n');

  console.log('Build on it →  git clone https://github.com/JuanseHevia/kerkit');
  console.log('Docs        →  https://github.com/JuanseHevia/kerkit#readme\n');
}

main().catch((err) => {
  console.error('\nkerkit demo failed to run:', err?.message ?? err);
  console.error('If this persists, please open an issue: https://github.com/JuanseHevia/kerkit/issues\n');
  process.exit(1);
});

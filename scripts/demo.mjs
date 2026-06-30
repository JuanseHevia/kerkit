#!/usr/bin/env node
/**
 * kerkit demo — the privacy X-ray, in one command.
 *
 *   npx github:JuanseHevia/kerkit
 *
 * Runs the same wiring as examples/minimal-caretaker over the synthetic persona:
 * no database, no OAuth, no API key. Shows raw caretaker data vs. the redacted
 * projection the model actually receives, then proves the raw DNI never leaked.
 */
import {
  buildPatientContextBlock,
  ContextAssembler,
  defaultSources,
} from '@kerkit/ai';
import { createFixtureRepositories } from '@kerkit/ai/demo';
import { argentina } from '@kerkit/pack-argentina';
import { FIXTURE_IDS, fixturePatient } from '@kerkit/core';

const RAW_DNI = fixturePatient.nationalId; // '12.345.678' — the synthetic identifier.

function line(label, value) {
  return `  ${label.padEnd(14)}= ${value}`;
}

async function main() {
  console.log('\n🧰 kerkit demo — the privacy X-ray (synthetic persona, no DB, no API key)\n');

  const pack = argentina;
  const repos = createFixtureRepositories();
  const userId = FIXTURE_IDS.user;

  // The patient block is pre-redacted; its tokens also sweep free text.
  const patientContext = buildPatientContextBlock(fixturePatient, {
    insurerName: 'Obra Social Demo Salud',
    allowSensitiveFields: ['treatmentPhase'],
  });

  // Assemble the full caretaker context window, pinned to the demo's data window.
  const assembler = new ContextAssembler({ pack });
  const demoNow = () => new Date('2026-02-01T12:00:00.000Z');
  for (const source of defaultSources(repos, pack, { now: demoNow })) assembler.add(source);
  const ctx = await assembler.assemble(userId, { knownTokens: patientContext.tokens });

  console.log('Raw caretaker record (what your database holds):');
  console.log(line('patient.name', JSON.stringify(fixturePatient.name)));
  console.log(line('patient.dni', JSON.stringify(fixturePatient.nationalId)));
  console.log(line('credential', JSON.stringify(fixturePatient.credentialNumber)));
  console.log('');

  console.log('What the model actually receives (redacted projection):');
  for (const row of patientContext.block.split('\n')) console.log(`  ${row}`);
  console.log('');

  // Leak check: the raw DNI must NOT appear anywhere in the assembled context.
  const leaked = ctx.contextText.includes(RAW_DNI);
  console.log(`🔍 Leak check — scanned the assembled context for the raw DNI ${RAW_DNI}:`);
  if (leaked) {
    console.log(`  ❌ FAIL — the raw identifier reached the model. This is a bug; please open an issue.\n`);
    process.exitCode = 1;
    return;
  }
  console.log('  ✅ PASS — no raw identifier reached the model.\n');

  console.log('Build on it →  git clone https://github.com/JuanseHevia/kerkit');
  console.log('Docs        →  https://github.com/JuanseHevia/kerkit#readme\n');
}

main().catch((err) => {
  console.error('\nkerkit demo failed to run:', err?.message ?? err);
  console.error('If this persists, please open an issue: https://github.com/JuanseHevia/kerkit/issues\n');
  process.exit(1);
});

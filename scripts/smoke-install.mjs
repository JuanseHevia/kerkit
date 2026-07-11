#!/usr/bin/env node
// Post-publish smoke test: install the published @kerkit packages from the npm
// registry into a throwaway project, then typecheck and run them. This is the
// "fresh registry install in a fresh project" release verification step — run
// it AFTER the first publish, from anywhere (it does not use this checkout's
// workspace links).
//
// Usage:
//   node scripts/smoke-install.mjs [version] [--registry <url>]
//   node scripts/smoke-install.mjs            # installs @latest
//   node scripts/smoke-install.mjs 0.2.0      # pins the version under test
//
// Exit 0 = a fresh consumer can install, typecheck, and run @kerkit.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
let version = 'latest';
let registry = 'https://registry.npmjs.org';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--registry') registry = args[++i];
  else if (!args[i].startsWith('--')) version = args[i];
}

const PACKAGES = [
  '@kerkit/core',
  '@kerkit/ai',
  '@kerkit/pack-argentina',
  '@kerkit/server',
  '@kerkit/ui',
];

const workdir = mkdtempSync(join(tmpdir(), 'kerkit-smoke-'));
console.log(`Smoke-testing @kerkit @ ${version} from ${registry}`);
console.log(`Scratch project: ${workdir}\n`);

function run(cmd, cmdArgs, opts = {}) {
  return execFileSync(cmd, cmdArgs, {
    cwd: workdir,
    stdio: 'inherit',
    encoding: 'utf8',
    ...opts,
  });
}

let failed = false;
try {
  writeFileSync(
    join(workdir, 'package.json'),
    JSON.stringify({ name: 'kerkit-smoke', private: true, type: 'module' }, null, 2),
  );

  const specs = PACKAGES.map((p) => `${p}@${version}`);
  console.log(`Installing: ${specs.join(' ')}\n`);
  run('npm', ['install', '--registry', registry, ...specs]);

  // Runtime smoke: the base package must load and expose the synthetic persona.
  writeFileSync(
    join(workdir, 'smoke.mjs'),
    [
      "import { fixturePatient } from '@kerkit/core';",
      "import { palette } from '@kerkit/ui/tokens';",
      'if (!fixturePatient || typeof fixturePatient !== "object") {',
      '  throw new Error("@kerkit/core did not export fixturePatient");',
      '}',
      'if (!palette || typeof palette !== "object") {',
      '  throw new Error("@kerkit/ui/tokens did not export palette");',
      '}',
      'console.log("runtime import OK — fixture patient loaded:", fixturePatient.name);',
    ].join('\n'),
  );
  console.log('\nRunning runtime import smoke...');
  run('node', ['smoke.mjs']);

  // Type smoke: a consumer can import types from every package and typecheck.
  writeFileSync(
    join(workdir, 'types.ts'),
    [
      "import type { Patient } from '@kerkit/core';",
      "import type {} from '@kerkit/ai';",
      "import type {} from '@kerkit/pack-argentina';",
      "import type {} from '@kerkit/server';",
      "import type {} from '@kerkit/ui';",
      'const _p: Patient | undefined = undefined;',
      'void _p;',
    ].join('\n'),
  );
  console.log('\nTypechecking a fresh consumer...');
  run('npx', ['-y', 'typescript@5.7.x', 'tsc', '--noEmit', '--module', 'nodenext',
    '--moduleResolution', 'nodenext', '--skipLibCheck', 'types.ts']);

  console.log('\n✓ Smoke test PASSED — fresh install, runtime, and types all work.');
} catch (err) {
  failed = true;
  console.error(`\n✗ Smoke test FAILED: ${err.message}`);
} finally {
  rmSync(workdir, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);

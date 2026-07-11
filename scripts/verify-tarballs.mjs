#!/usr/bin/env node
/**
 * Packed-consumer verification for the publishable kerkit packages.
 *
 * This is the "does the npm tarball actually work for a stranger" gate. It:
 *   1. builds the workspace (turbo-cached),
 *   2. packs every publishable package with `npm pack` (runs prepack, so the
 *      LICENSE/NOTICE copies land in the tarball),
 *   3. inspects each tarball's file list (LICENSE, NOTICE, README, metadata,
 *      JS + declarations present; no source, tests, caches, or env files),
 *   4. installs all tarballs together into a fresh project OUTSIDE the
 *      workspace (with the real peer deps),
 *   5. type-checks a consumer program with `strict` and `skipLibCheck: false`,
 *   6. executes the compiled program so the main + documented subpath imports
 *      are exercised at runtime.
 *
 * Run locally with `node scripts/verify-tarballs.mjs`. CI runs the same script.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Publishable packages and the entrypoints a consumer is documented to import. */
const PACKAGES = ['core', 'pack-argentina', 'ai', 'server', 'ui'];

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...opts });

/** `@kerkit/pack-argentina` @ 0.1.0 -> `kerkit-pack-argentina-0.1.0.tgz` */
const tarballName = (name, version) => `${name.replace(/^@/, '').replace(/\//g, '-')}-${version}.tgz`;

console.log('\n[1/6] Building workspace (turbo-cached)…');
run('npm', ['run', 'build'], { cwd: repoRoot, stdio: 'inherit' });

const work = mkdtempSync(join(tmpdir(), 'kerkit-verify-'));
const tgzDir = join(work, 'tarballs');
const consumer = join(work, 'consumer');
mkdirSync(tgzDir, { recursive: true });
mkdirSync(join(consumer, 'src'), { recursive: true });

const tarballs = {}; // npm name -> absolute tgz path

console.log('\n[2/6] Packing publishable packages…');
for (const dir of PACKAGES) {
  const pkgDir = join(repoRoot, 'packages', dir);
  const meta = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  run('npm', ['pack', '--pack-destination', tgzDir], { cwd: pkgDir });
  const tgz = join(tgzDir, tarballName(meta.name, meta.version));
  tarballs[meta.name] = tgz;
  ok(`packed ${meta.name}`);
}

console.log('\n[3/6] Inspecting tarball contents…');
for (const dir of PACKAGES) {
  const pkgDir = join(repoRoot, 'packages', dir);
  const meta = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const tgz = tarballs[meta.name];
  const entries = run('tar', ['-tzf', tgz]).split('\n').filter(Boolean);
  const strip = entries.map((e) => e.replace(/^package\//, ''));

  const required = ['LICENSE', 'NOTICE', 'README.md', 'package.json'];
  for (const f of required) {
    if (strip.includes(f)) ok(`${meta.name}: contains ${f}`);
    else fail(`${meta.name}: MISSING ${f}`);
  }
  if (strip.some((e) => /^dist\/.*\.js$/.test(e))) ok(`${meta.name}: ships compiled JS`);
  else fail(`${meta.name}: no dist/*.js`);
  if (strip.some((e) => /^dist\/.*\.d\.ts$/.test(e))) ok(`${meta.name}: ships declarations`);
  else fail(`${meta.name}: no dist/*.d.ts`);

  // engines metadata must be declared so unsupported Node versions warn.
  if (meta.engines && meta.engines.node) ok(`${meta.name}: declares engines.node ${meta.engines.node}`);
  else fail(`${meta.name}: missing engines.node`);

  const forbidden = strip.filter(
    (e) =>
      /\.test\./.test(e) ||
      /(^|\/)__tests__\//.test(e) ||
      /^src\//.test(e) ||
      /\.tsbuildinfo$/.test(e) ||
      /(^|\/)\.env(\.|$)/.test(e),
  );
  if (forbidden.length === 0) ok(`${meta.name}: no tests/sources/caches/secrets`);
  else fail(`${meta.name}: unexpected files -> ${forbidden.join(', ')}`);
}

console.log('\n[4/6] Installing tarballs into a fresh non-workspace project…');
// Direct file: deps + overrides so the internal @kerkit/* graph resolves to the
// local tarballs (versions 0.1.0 are not on the registry) instead of npm.
const fileSpec = (name) => `file:${tarballs[name]}`;
const overrides = Object.fromEntries(PACKAGES.map((d) => {
  const name = JSON.parse(readFileSync(join(repoRoot, 'packages', d, 'package.json'), 'utf8')).name;
  return [name, fileSpec(name)];
}));
const consumerPkg = {
  name: 'kerkit-tarball-consumer',
  version: '0.0.0',
  private: true,
  type: 'module',
  dependencies: {
    ...Object.fromEntries(Object.keys(tarballs).map((name) => [name, fileSpec(name)])),
    // Real peer deps a server consumer must supply.
    express: '^5.1.0',
    'drizzle-orm': '^0.45.2',
  },
  devDependencies: {
    '@types/node': '^22.0.0',
  },
  overrides,
};
writeFileSync(join(consumer, 'package.json'), JSON.stringify(consumerPkg, null, 2));
const baseCompilerOptions = {
  target: 'ES2022',
  module: 'NodeNext',
  moduleResolution: 'NodeNext',
  lib: ['ES2022'],
  strict: true,
  esModuleInterop: true,
  forceConsistentCasingInFileNames: true,
};
// Strict declaration check: skipLibCheck:false so kerkit's own shipped .d.ts
// (and the express types it references) are fully type-checked — this is what
// catches leaked/unresolvable types like the pre-fix @types/express gap.
writeFileSync(
  join(consumer, 'tsconfig.strict.json'),
  JSON.stringify(
    { compilerOptions: { ...baseCompilerOptions, skipLibCheck: false, noEmit: true }, include: ['src/**/*.ts'] },
    null,
    2,
  ),
);
// Build config for the runtime smoke. drizzle-orm's published declarations do
// not type-check under skipLibCheck:false (drizzle documents skipLibCheck:true
// as required), so we emit runnable JS with skipLibCheck:true; the strict step
// above is what guards kerkit's surface.
writeFileSync(
  join(consumer, 'tsconfig.build.json'),
  JSON.stringify(
    {
      compilerOptions: { ...baseCompilerOptions, skipLibCheck: true, outDir: 'dist', rootDir: 'src', noEmitOnError: true },
      include: ['src/**/*.ts'],
    },
    null,
    2,
  ),
);
run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], {
  cwd: consumer,
  stdio: 'inherit',
});
ok('installed all five tarballs + peers');

console.log('\n[5/6] Strict type-check (skipLibCheck: false)…');
const smoke = `// Import the main + documented subpath entrypoints from the packed tarballs.
import { RedactionSession } from '@kerkit/core';
import argentina from '@kerkit/pack-argentina';
import { ContextAssembler, buildSystemPrompt, runChatLoop, createRedactedChat } from '@kerkit/ai';
import { zodObjectToJsonSchema, textResult } from '@kerkit/ai/mcp';
import { OpenAIResponsesAdapter } from '@kerkit/ai/openai';
import { createFixtureRepositories } from '@kerkit/ai/demo';
import { createPrivacyRouter, createKerkitSchema, createEscalationJob } from '@kerkit/server';
import { palette, spacing, durations } from '@kerkit/ui/tokens';

const checks: Array<[string, boolean]> = [
  ['@kerkit/core RedactionSession', typeof RedactionSession === 'function'],
  ['@kerkit/pack-argentina default export', typeof argentina === 'object' && argentina !== null],
  ['@kerkit/ai ContextAssembler', typeof ContextAssembler === 'function'],
  ['@kerkit/ai buildSystemPrompt', typeof buildSystemPrompt === 'function'],
  ['@kerkit/ai runChatLoop', typeof runChatLoop === 'function'],
  ['@kerkit/ai createRedactedChat', typeof createRedactedChat === 'function'],
  ['@kerkit/ai/mcp zodObjectToJsonSchema', typeof zodObjectToJsonSchema === 'function'],
  ['@kerkit/ai/mcp textResult', typeof textResult === 'function'],
  ['@kerkit/ai/openai OpenAIResponsesAdapter', typeof OpenAIResponsesAdapter === 'function'],
  ['@kerkit/ai/demo createFixtureRepositories', typeof createFixtureRepositories === 'function'],
  ['@kerkit/server createPrivacyRouter', typeof createPrivacyRouter === 'function'],
  ['@kerkit/server createKerkitSchema', typeof createKerkitSchema === 'function'],
  ['@kerkit/server createEscalationJob', typeof createEscalationJob === 'function'],
  ['@kerkit/ui/tokens palette', typeof palette === 'object' && palette !== null],
  ['@kerkit/ui/tokens spacing', typeof spacing === 'object' && spacing !== null],
  ['@kerkit/ui/tokens durations', typeof durations === 'object' && durations !== null],
];

// Exercise a real runtime path from the demo entrypoint.
const repos = createFixtureRepositories();
checks.push(['@kerkit/ai/demo repositories construct', typeof repos === 'object' && repos !== null]);

const failed = checks.filter(([, passed]) => !passed);
if (failed.length > 0) {
  for (const [name] of failed) console.error('FAIL: ' + name);
  process.exit(1);
}
console.log('smoke ok: ' + checks.length + ' entrypoint checks passed');
`;
writeFileSync(join(consumer, 'src', 'smoke.ts'), smoke);
const tsc = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

// Run the strict check, capturing diagnostics. tsc exits non-zero on the
// tolerated drizzle-orm lib errors, so read stdout from the thrown result too.
let strictOut = '';
try {
  strictOut = execFileSync('node', [tsc, '--pretty', 'false', '-p', join(consumer, 'tsconfig.strict.json')], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (err) {
  strictOut = `${err.stdout ?? ''}${err.stderr ?? ''}`;
}
const diagnostics = strictOut.split('\n').filter((l) => /\): error TS\d+/.test(l) || /^error TS\d+/.test(l));
// A diagnostic is tolerated only if it originates inside drizzle-orm's own
// declaration files (drizzle requires skipLibCheck:true). Anything else — a
// leaked kerkit type, an unresolved express type — is a real failure.
const offenders = diagnostics.filter((l) => !/node_modules\/(\.pnpm\/)?drizzle-orm\//.test(l));
if (offenders.length === 0) {
  ok(`kerkit surface strict-clean under skipLibCheck:false (${diagnostics.length} tolerated drizzle-orm lib diagnostics)`);
} else {
  fail('strict type-check found non-drizzle diagnostics:');
  for (const l of offenders.slice(0, 40)) console.error(`    ${l}`);
}

console.log('\n[6/6] Build + runtime import smoke…');
try {
  run('node', [tsc, '-p', join(consumer, 'tsconfig.build.json')], { stdio: 'inherit' });
  const out = run('node', [join(consumer, 'dist', 'smoke.js')]);
  process.stdout.write(out.replace(/^/gm, '  '));
  ok('main + documented subpath imports executed from tarballs');
} catch {
  fail('runtime smoke program failed to build or run');
}

if (failures > 0) {
  console.error(`\n✗ tarball verification failed (${failures} problem(s)). Left artifacts in ${work}`);
  process.exit(1);
}
rmSync(work, { recursive: true, force: true });
console.log('\n✓ tarball verification passed');

#!/usr/bin/env node
// Release pre-flight: dry-run `npm publish` for every publishable @kerkit
// package and assert each one would publish under the expected name with
// public access. Runs no network writes and needs no credentials, so it is
// safe on pull requests (including from forks).
//
// Usage:
//   npm run build            # dist/ must exist first
//   node scripts/verify-publish.mjs
//
// Exit code 0 = every publishable package validated; non-zero = a problem a
// human must resolve before releasing.

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = join(repoRoot, 'packages');

// The npm scope every publishable package must live under. A stray name here
// would mean we are about to squat or leak a package outside the @kerkit org.
const SCOPE = '@kerkit/';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function discoverPublishable() {
  const found = [];
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgJsonPath = join(packagesDir, entry.name, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;
    const pkg = readJson(pkgJsonPath);
    if (pkg.private) continue;
    found.push({ dir: join(packagesDir, entry.name), name: pkg.name, pkg });
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exitCode = 1;
}

const packages = discoverPublishable();

console.log(`Found ${packages.length} publishable package(s) under packages/*\n`);

if (packages.length === 0) {
  fail('No publishable packages discovered — nothing to validate.');
  process.exit(1);
}

let ok = 0;
for (const { dir, name, pkg } of packages) {
  const rel = name;

  if (!name || !name.startsWith(SCOPE)) {
    fail(`${rel}: name does not live under the ${SCOPE} scope.`);
    continue;
  }

  if (!existsSync(join(dir, 'dist'))) {
    fail(`${rel}: dist/ is missing — run \`npm run build\` before verifying.`);
    continue;
  }

  // --access public is redundant with publishConfig but makes the intent
  // explicit and validates the flag path too. --dry-run performs no writes.
  // npm writes its notices to stderr, so combine both streams before matching.
  const res = spawnSync('npm', ['publish', '--dry-run', '--access', 'public'], {
    cwd: dir,
    encoding: 'utf8',
  });
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  if (res.status !== 0) {
    fail(`${rel}: \`npm publish --dry-run\` exited ${res.status}.\n${out}`);
    continue;
  }
  if (!out) {
    fail(`${rel}: \`npm publish --dry-run\` produced no output.`);
    continue;
  }

  const declaredPublic = pkg.publishConfig?.access === 'public';
  const nameEchoed = out.includes(`name: ${name}`) || out.includes(`+ ${name}@`);
  const publicAccess = /public access/.test(out);

  const problems = [];
  if (!declaredPublic) problems.push('package.json is missing publishConfig.access="public"');
  if (!nameEchoed) problems.push(`dry-run did not echo the expected name ${name}`);
  if (!publicAccess) problems.push('dry-run did not report "public access"');

  if (problems.length > 0) {
    fail(`${rel}: ${problems.join('; ')}`);
    continue;
  }

  console.log(`✓ ${name} — would publish with public access`);
  ok += 1;
}

console.log(`\n${ok}/${packages.length} package(s) validated for public publish.`);

if (process.exitCode === 1) {
  console.error('\nRelease pre-flight FAILED — resolve the issues above before publishing.');
  process.exit(1);
}

console.log('Release pre-flight PASSED.');

#!/usr/bin/env node
/**
 * prepack helper: copy the repository's Apache LICENSE and NOTICE into the
 * package being packed so every published tarball carries them.
 *
 * npm runs `prepack` with the cwd set to the package directory, so we copy the
 * root LICENSE/NOTICE (found relative to this script) into cwd. The copies are
 * git-ignored (see .gitignore) and listed in each package's `files` allowlist,
 * so they ship in the tarball without ever drifting from the canonical root
 * copies.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.cwd();

for (const file of ['LICENSE', 'NOTICE']) {
  const src = join(repoRoot, file);
  if (!existsSync(src)) {
    console.error(`copy-license: missing ${file} at repo root (${src})`);
    process.exit(1);
  }
  copyFileSync(src, join(target, file));
}

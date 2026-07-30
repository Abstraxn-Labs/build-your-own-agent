#!/usr/bin/env node
/**
 * Build shared packages when pnpm bin-linking fails (some NFS mounts).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const tsc = require.resolve('typescript/bin/tsc');

const packages = ['utils', 'core', 'wallet', 'mcp', 'llm', 'ui'];

for (const name of packages) {
  const config = path.join(root, 'packages', name, 'tsconfig.json');
  if (!existsSync(config)) {
    console.error(`Missing ${config}`);
    process.exit(1);
  }
  console.log(`Building packages/${name}…`);
  const result = spawnSync(process.execPath, [tsc, '-p', config], {
    stdio: 'inherit',
    cwd: root,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('Shared packages built.');

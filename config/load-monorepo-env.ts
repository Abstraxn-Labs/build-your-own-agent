import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

function findMonorepoRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        'Could not find abstraxn-agent-examples root (pnpm-workspace.yaml)',
      );
    }
    dir = parent;
  }
}

/** Load .env from the monorepo root (where .env.example lives). */
export function loadMonorepoEnv(cwd: string = process.cwd()): void {
  const root = findMonorepoRoot(cwd);
  const require = createRequire(path.join(root, 'package.json'));
  const { loadEnvConfig } = require('@next/env') as {
    loadEnvConfig: (dir: string) => void;
  };
  loadEnvConfig(root);
}

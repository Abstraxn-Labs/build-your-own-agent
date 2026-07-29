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
    loadEnvConfig: (
      dir: string,
      dev?: boolean,
      log?: Console,
      forceReload?: boolean,
    ) => void;
  };
  // forceReload: true is required — Next.js already calls loadEnvConfig() internally
  // against this app's own (monorepo-relative) directory before next.config.ts runs,
  // which has no .env of its own. @next/env caches that first call's result and, by
  // default, silently returns it on any later call in the same process — so without
  // forceReload, this call would never actually read the monorepo root's .env.
  loadEnvConfig(root, undefined, console, true);
}

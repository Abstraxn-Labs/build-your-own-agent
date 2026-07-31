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
  // Next.js already calls loadEnvConfig() once for the app's own directory
  // (which has no local .env) before next.config.ts runs. @next/env memoizes
  // that result, so calling it again for the monorepo root without
  // forceReload just returns the earlier (empty) cached result instead of
  // loading the root .env.
  loadEnvConfig(root, process.env.NODE_ENV !== 'production', console, true);
}

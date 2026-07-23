import fs from 'node:fs';
import path from 'node:path';

let loaded = false;

function findMonorepoRoot(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const eq = trimmed.indexOf('=');
  if (eq <= 0) return null;

  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

/**
 * Load `.env` from the monorepo root into `process.env`.
 * Skips keys already set. Safe to call multiple times.
 */
export function loadMonorepoEnv(cwd: string = process.cwd()): void {
  if (loaded) return;

  const root = findMonorepoRoot(cwd);
  if (!root) {
    loaded = true;
    return;
  }

  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) {
    loaded = true;
    return;
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }

  loaded = true;
}

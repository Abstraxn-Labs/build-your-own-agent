import { z } from 'zod';
import { loadMonorepoEnv } from './load-monorepo-env.js';

// ── Abstraxn Agent Kit ──────────────────────────────────────────────────────

export const abstraxnEnvSchema = z.object({
  ABSTRAXN_API_KEY: z.string().min(1, 'ABSTRAXN_API_KEY is required'),
  ABSTRAXN_AGENT_KIT_API_URL: z
    .string()
    .url()
    .default('https://agent-kit.abstraxn.com'),
  ABSTRAXN_USER_IDENTITY: z.string().min(1).default('demo@example.com'),
  ABSTRAXN_AGENT_ID: z.string().optional(),
  ABSTRAXN_MCP_TOKEN: z.string().optional(),
  ABSTRAXN_EVM_ADDRESS: z.string().optional(),
  ABSTRAXN_ACCESS_KEY: z.string().optional(),
  ABSTRAXN_ORGANIZATION_ID: z.string().optional(),
});

export type AbstraxnEnv = z.infer<typeof abstraxnEnvSchema>;

/** @deprecated Use AbstraxnEnv */
export type ExampleEnv = AbstraxnEnv;

export function loadAbstraxnEnv(
  source: Record<string, string | undefined> = process.env,
): AbstraxnEnv {
  loadMonorepoEnv();
  return parseEnv(abstraxnEnvSchema, source, 'Abstraxn');
}

// ── LLM provider ────────────────────────────────────────────────────────────

export const LLM_PROVIDERS = [
  'openai',
  'openrouter',
  'anthropic',
  'openai-compatible',
] as const;

export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const LLM_DEFAULT_MODELS: Record<LlmProvider, string> = {
  openai: 'gpt-4o-mini',
  openrouter: 'openai/gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  'openai-compatible': 'gpt-4o-mini',
};

export const llmEnvSchema = z.object({
  LLM_PROVIDER: z.enum(LLM_PROVIDERS).default('openai'),
  /** Primary API key for the chosen LLM provider */
  LLM_API_KEY: z.string().optional(),
  /** Model id (OpenAI id, OpenRouter slug, or Anthropic id) */
  LLM_MODEL: z.string().optional(),
  /**
   * Custom API base URL.
   * Required for `openai-compatible`. Optional override for others.
   * OpenRouter default: https://openrouter.ai/api/v1
   */
  LLM_BASE_URL: z.string().url().optional(),
  /** Legacy — use LLM_API_KEY instead */
  OPENAI_API_KEY: z.string().optional(),
  /** Legacy — use LLM_MODEL instead */
  OPENAI_MODEL: z.string().optional(),
});

export type LlmEnvInput = z.infer<typeof llmEnvSchema>;

export interface LlmEnv {
  LLM_PROVIDER: LlmProvider;
  LLM_API_KEY: string;
  LLM_MODEL: string;
  LLM_BASE_URL?: string;
}

export function loadLlmEnv(
  source: Record<string, string | undefined> = process.env,
): LlmEnv {
  loadMonorepoEnv();
  const parsed = parseEnv(llmEnvSchema, source, 'LLM');

  const apiKey = parsed.LLM_API_KEY ?? parsed.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error(
      'Missing LLM API key. Set LLM_API_KEY (recommended) or OPENAI_API_KEY (legacy).',
    );
  }

  const provider = parsed.LLM_PROVIDER;
  const model =
    parsed.LLM_MODEL ??
    parsed.OPENAI_MODEL ??
    LLM_DEFAULT_MODELS[provider];

  if (provider === 'openai-compatible' && !parsed.LLM_BASE_URL) {
    throw new Error(
      'LLM_BASE_URL is required when LLM_PROVIDER=openai-compatible (e.g. https://your-api.com/v1)',
    );
  }

  return {
    LLM_PROVIDER: provider,
    LLM_API_KEY: apiKey,
    LLM_MODEL: model,
    LLM_BASE_URL: parsed.LLM_BASE_URL,
  };
}

// ── Combined (optional convenience) ───────────────────────────────────────────

export function loadEnv(
  source: Record<string, string | undefined> = process.env,
): AbstraxnEnv & LlmEnv {
  loadMonorepoEnv();
  return { ...loadAbstraxnEnv(source), ...loadLlmEnv(source) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, string | undefined>,
  label: string,
): z.infer<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid ${label} environment:\n${details}`);
  }
  return parsed.data;
}

export function requireEnv(name: string): string {
  loadMonorepoEnv();
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function logInfo(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.log(`[abstraxn] ${message}`, meta);
  } else {
    console.log(`[abstraxn] ${message}`);
  }
}

export function logWarn(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.warn(`[abstraxn] ${message}`, meta);
  } else {
    console.warn(`[abstraxn] ${message}`);
  }
}

export function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

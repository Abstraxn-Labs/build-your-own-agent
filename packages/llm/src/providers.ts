import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import {
  loadLlmEnv,
  logInfo,
  type LlmEnv,
} from '@abstraxn-examples/utils';
import type { LanguageModel } from 'ai';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Resolve a Vercel AI SDK language model from env (or explicit config).
 *
 * Supports OpenAI, OpenRouter, Anthropic, and any OpenAI-compatible API.
 */
export function createLanguageModel(config?: LlmEnv): LanguageModel {
  const env = config ?? loadLlmEnv();
  const { LLM_PROVIDER, LLM_API_KEY, LLM_MODEL, LLM_BASE_URL } = env;

  logInfo('LLM configured', {
    provider: LLM_PROVIDER,
    model: LLM_MODEL,
    baseUrl: LLM_BASE_URL ?? defaultBaseUrl(LLM_PROVIDER),
  });

  switch (LLM_PROVIDER) {
    case 'openai': {
      const client = createOpenAI({
        apiKey: LLM_API_KEY,
        baseURL: LLM_BASE_URL,
      });
      return client(LLM_MODEL);
    }

    case 'openrouter': {
      const client = createOpenAI({
        apiKey: LLM_API_KEY,
        baseURL: LLM_BASE_URL ?? OPENROUTER_BASE_URL,
      });
      // OpenRouter proxies the classic Chat Completions API, not OpenAI's
      // newer Responses API — calling client(...) directly defaults to
      // Responses and 404s for most non-OpenAI models.
      return client.chat(LLM_MODEL);
    }

    case 'openai-compatible': {
      if (!LLM_BASE_URL) {
        throw new Error('LLM_BASE_URL is required for openai-compatible');
      }
      const client = createOpenAI({
        apiKey: LLM_API_KEY,
        baseURL: LLM_BASE_URL,
      });
      // Third-party OpenAI-compatible APIs (Groq, Together, local vLLM, etc.)
      // implement Chat Completions, not OpenAI's Responses API.
      return client.chat(LLM_MODEL);
    }

    case 'anthropic': {
      const client = createAnthropic({
        apiKey: LLM_API_KEY,
        baseURL: LLM_BASE_URL,
      });
      return client(LLM_MODEL);
    }

    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${String(LLM_PROVIDER)}`);
  }
}

function defaultBaseUrl(provider: LlmEnv['LLM_PROVIDER']): string | undefined {
  switch (provider) {
    case 'openrouter':
      return OPENROUTER_BASE_URL;
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'anthropic':
      return 'https://api.anthropic.com';
    default:
      return undefined;
  }
}

export { loadLlmEnv, type LlmEnv };

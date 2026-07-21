# LLM providers

Every example reads the same three env vars. Pick a provider and set your key + model.

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_PROVIDER` | No (default: `openai`) | `openai` · `openrouter` · `anthropic` · `openai-compatible` |
| `LLM_API_KEY` | Yes | API key for the provider you chose |
| `LLM_MODEL` | No | Model id — defaults per provider if omitted |
| `LLM_BASE_URL` | For `openai-compatible` only | OpenAI-compatible endpoint (e.g. Groq, Together, local vLLM) |

Legacy `OPENAI_API_KEY` / `OPENAI_MODEL` still work but `LLM_*` is preferred.

## Quick copy-paste

### OpenAI (default)

```bash
LLM_PROVIDER=openai
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
```

### OpenRouter

One key, many models (Claude, GPT, Llama, Mistral, …).

```bash
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-...
LLM_MODEL=anthropic/claude-3.5-sonnet
```

Browse models: [openrouter.ai/models](https://openrouter.ai/models)

### Anthropic (direct)

```bash
LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-...
LLM_MODEL=claude-3-5-sonnet-20241022
```

### OpenAI-compatible (Groq, Together, Ollama, vLLM, …)

Any API that speaks the OpenAI chat/completions format.

```bash
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your_key
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile
```

**Groq example**

```bash
LLM_PROVIDER=openai-compatible
LLM_API_KEY=gsk_...
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile
```

**Local Ollama example**

```bash
LLM_PROVIDER=openai-compatible
LLM_API_KEY=ollama
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2
```

## Default models (if `LLM_MODEL` is omitted)

| Provider | Default |
|----------|---------|
| `openai` | `gpt-4o-mini` |
| `openrouter` | `openai/gpt-4o-mini` |
| `anthropic` | `claude-3-5-sonnet-20241022` |
| `openai-compatible` | `gpt-4o-mini` (set your own for local APIs) |

## Where this is implemented

- Env parsing: [`packages/utils/src/index.ts`](../packages/utils/src/index.ts)
- Model factory: [`packages/llm/src/providers.ts`](../packages/llm/src/providers.ts)

No example app code changes when you switch providers — only `.env`.

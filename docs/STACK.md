# Tech stack

Versions are pinned in [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) `catalog:` so every package stays aligned.

| Dependency | Version | Notes |
|------------|---------|--------|
| Next.js | 16.x | App Router, Turbopack dev |
| React | 19.x | |
| Vercel AI SDK (`ai`) | 7.x | `streamText`, `tool`, `DefaultChatTransport`, `UIMessage` parts |
| `@ai-sdk/react` | 4.x | `useChat` + transport pattern |
| `@ai-sdk/openai` / `@ai-sdk/anthropic` | 4.x | Provider adapters |
| Zod | 4.x | Env + tool schemas |
| TypeScript | 5.9.x | Strict mode |
| `@abstraxn/agent-kit` | 1.4.x | Agent + MCP client |
| pnpm | 10.x | Workspaces + catalog |
| turbo | 2.x | Monorepo tasks |

## Modern patterns used

- **AI SDK 7 chat UI:** `DefaultChatTransport` + `useChat({ transport })` + `sendMessage({ text })`
- **AI SDK 7 server:** `convertToModelMessages()` + `stopWhen: stepCountIs(n)` + `toUIMessageStreamResponse()`
- **Tools:** `tool({ inputSchema, execute })` (not deprecated `parameters`)
- **LLM providers:** OpenAI, OpenRouter, Anthropic, OpenAI-compatible via env ([LLM-PROVIDERS.md](./LLM-PROVIDERS.md))
- **pnpm catalog:** bump once in `pnpm-workspace.yaml`, run `pnpm install` everywhere

## Upgrade policy

When bumping the catalog:

```bash
pnpm update -r --latest
pnpm run build:packages
pnpm typecheck
pnpm --filter @abstraxn-examples/hello-wallet build
```

Follow [AI SDK migration guides](https://ai-sdk.dev/docs/migration-guides) for major SDK jumps.

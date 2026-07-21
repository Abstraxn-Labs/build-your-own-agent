# Firecrawl Research Agent

Web research agent using Abstraxn MCP `firecrawl_scrape`.

> **Using only this example?** You have three choices:
>
> 1. **Clone and ignore** — run only this folder; leave other examples in the repo.
> 2. **Fork and delete** — fork the repo, delete other `examples/*`, keep `packages/`. See [Option B in the root README](../../README.md#option-b--fork-and-delete-cleanest-for-one-use-case).
> 3. **Customize here** — edit [`lib/agent.ts`](./lib/agent.ts) and ship.

## Run (from repo root)

```bash
cp .env.example .env
# ABSTRAXN_API_KEY + LLM_API_KEY (any provider — see docs/LLM-PROVIDERS.md)

pnpm --filter @abstraxn-examples/firecrawl-research dev
```

Open **http://localhost:3001**

Try: *Scrape https://abstraxn.com and summarize what they build.*

## Customize

Edit **[`lib/agent.ts`](./lib/agent.ts)** — system prompt and tool set. That is the main file for your crawling agent.

Enable Firecrawl in [Dashboard Integrations](https://docs.abstraxn.com/guides/ai/firecrawl-integration) (BYOK if your plan requires it).

## Docs

- [Firecrawl integration](https://docs.abstraxn.com/guides/ai/firecrawl-integration)
- [MCP integration](https://docs.abstraxn.com/guides/ai/mcp-integration)

## Blog

[Build a Web Research Agent with Abstraxn + Firecrawl](https://abstraxn.com/blogs/build-web-research-agent-firecrawl)

## Content pack

See [CONTENT.md](./CONTENT.md) (LinkedIn draft + video script).

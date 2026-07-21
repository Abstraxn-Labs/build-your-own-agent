# Content pack — Firecrawl Research Agent

Series: **Build your Agent with Abstraxn**

## Blog outline

**Title:** Build a Web Research Agent with Abstraxn + Firecrawl

1. Hook — agents that can read the live web
2. Architecture — Next.js → Vercel AI SDK → Abstraxn MCP → Firecrawl
3. Code — `lib/agent.ts` tool allowlist + chat route
4. Run in 5 minutes
5. CTA — Agent Hub, docs, GitHub

**Code refs:** `examples/01-firecrawl-research/lib/agent.ts`, `packages/mcp/src/index.ts` (`TOOL_SETS.firecrawl`)

## LinkedIn draft

Hook: Most “research agents” hallucinate. Ours scrape.

- Abstraxn Agent Kit + Firecrawl MCP tool
- Same Next.js scaffold as every use case in the series
- Clone, set two keys, ask it to scrape your docs

Repo: github.com/abstraxn/abstraxn-agent-examples  
Blog: abstraxn.com/blogs/build-web-research-agent-firecrawl  
#AIAgents #Web3 #MCP

## Video script (60–90s)

1. (0–10s) Title card: Build a Research Agent with Abstraxn
2. (10–25s) Show `.env` with Abstraxn + OpenAI keys
3. (25–45s) `pnpm dev` → chat UI
4. (45–75s) Prompt: scrape abstraxn.com → tool call → summary with URL
5. (75–90s) End card: GitHub + docs links

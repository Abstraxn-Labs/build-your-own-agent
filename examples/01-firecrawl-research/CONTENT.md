# Content pack — Firecrawl Research Agent

Series: **Build your Agent with Abstraxn**

## Blog format (merged — educational + developer)

One post, two audiences. Do **not** split into separate educational vs developer blogs.

| Section | Audience | Purpose |
|---------|----------|---------|
| Hook + why scrape | PM, evaluators | Problem framing — hallucinated research vs live web |
| How Abstraxn + Firecrawl fit | PM, architects | MCP model, table, architecture diagram |
| Try it without code | No-code / MCP users | Dashboard + MCP client path |
| Build it (steps + code) | Developers | Clone, `agent.ts`, route, run commands |
| Series CTA | Both | Next posts + GitHub |

**Live post:** abstraxn.com/blogs/build-web-research-agent-firecrawl

**Cover image text** (punchy — not the blog title):
- Headline: *Scrape, Don't Hallucinate*
- Subtitle: *Firecrawl through Abstraxn MCP — ground truth from the live web, not training data.*
- File: `abstraxn.com/public/blog-covers/cover-32.webp`

**Code refs:** `examples/01-firecrawl-research/lib/agent.ts`, `app/api/chat/route.ts`, `packages/mcp/src/index.ts` (`TOOL_SETS.firecrawl`)

## LinkedIn draft

Hook: Most “research agents” hallucinate. Ours scrape.

- Why: agents need ground truth from the live web, not training-data guesses
- No-code: enable Firecrawl in Abstraxn dashboard → MCP client
- Dev path: clone abstraxn-agent-examples, one file to customize (`lib/agent.ts`)

Repo: github.com/Abstraxn-Labs/abstraxn-agent-examples  
Blog: abstraxn.com/blogs/build-web-research-agent-firecrawl  
#AIAgents #MCP #Firecrawl #BuildYourOwnAgent

## Video script (60–90s)

1. (0–10s) Title: Why research agents need Firecrawl + Abstraxn MCP
2. (10–25s) Show dashboard Firecrawl toggle OR `.env` keys
3. (25–45s) `pnpm dev` → chat UI
4. (45–75s) Prompt: scrape abstraxn.com → tool call → summary with URL citation
5. (75–90s) End card: GitHub + “concept + code in one post”

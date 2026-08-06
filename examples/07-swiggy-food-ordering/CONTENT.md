# Content pack — Swiggy Food Ordering Agent

Series: **Build your Agent with Abstraxn**

## Blog outline

**Title:** Build a Food-Ordering Agent with Abstraxn + Swiggy MCP

1. Hook — an agent that can actually order your dinner
2. Architecture — Next.js → Vercel AI SDK → Abstraxn MCP bridge → Swiggy's own MCP server (OAuth 2.1 + PKCE)
3. Code — `lib/agent.ts` tool allowlist, `lib/swiggy-tools.ts` token injection, chat route
4. Safety — the `confirm: true` gate on `swiggy_place_order`, never claiming success without a real `order_id`
5. Run in 5 minutes (once you have a Swiggy access token)
6. CTA — Agent Hub, docs, GitHub

**Code refs:** `examples/05-swiggy-food-ordering/lib/agent.ts`,
`examples/05-swiggy-food-ordering/lib/swiggy-tools.ts`,
`packages/mcp/src/index.ts` (`TOOL_SETS.swiggyFoodOrdering`),
`web3-agent-kit-service/src/mcp/tools/swiggy-place-order.tool.ts`

## LinkedIn draft

Hook: Most "shopping agents" can browse. Ours can order.

- Abstraxn Agent Kit bridges Swiggy's own MCP server into your agent's tool list
- Same Next.js scaffold as every use case in the series
- A priced cart preview and an explicit confirm gate before any real order is placed

Repo: github.com/abstraxn/abstraxn-agent-examples
#AIAgents #Web3 #MCP

## Video script (60–90s)

1. (0–10s) Title card: Build a Food-Ordering Agent with Abstraxn
2. (10–25s) Show `.env` with Abstraxn + LLM + Swiggy token keys
3. (25–45s) `pnpm dev` → chat UI
4. (45–75s) Prompt: find a restaurant → menu → cart preview → confirm → order placed
5. (75–90s) End card: GitHub + docs links

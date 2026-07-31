# Content pack — OpenWeb Ninja x402 Agent

Series: **Build your Agent with Abstraxn**

## Blog outline

**Title:** Paying for Tools: An x402 Agent with Abstraxn + OpenWeb Ninja

1. Hook — agents that pay for their own tool calls, no API keys, no subscriptions
2. What's x402 — 402 Payment Required, signed on-chain, settled in USDC
3. Architecture — Next.js → Vercel AI SDK → Abstraxn MCP → OpenWeb Ninja's x402 gateway
4. The signing step — Abstraxn Agent Kit server-wallet signer, same flow as agent-app-service
5. Safety — preview-then-confirm, never auto-pay
6. Run in 5 minutes
7. CTA — Agent Hub, docs, GitHub

**Code refs:** `examples/06-openweb-ninja-x402/lib/paid-tools.ts`, `lib/x402-signing.ts`,
`app/api/pay/route.ts`, `app/page.tsx` (payment card UI).

## LinkedIn draft

Hook: Most agent demos call free tools. This one pays for them.

- Abstraxn Agent Kit signer SDK + OpenWeb Ninja's x402 gateway (26 tools, $0.003-$0.005/call)
- Same Next.js scaffold as every use case in the series
- 402 → sign → retry, with a real "Pay & Retry" button before anything gets spent

Repo: github.com/abstraxn/abstraxn-agent-examples
#AIAgents #x402 #MCP #Web3

## Video script (60–90s)

1. (0–10s) Title card: An Agent That Pays For Its Own Tools
2. (10–25s) Show `.env` with Abstraxn + OpenAI keys, wallet address in the banner
3. (25–45s) Prompt: "search the web for x402" → tool call → payment card appears
4. (45–75s) Click Pay & Retry → signed → real OpenWeb Ninja result renders
5. (75–90s) End card: GitHub + docs links

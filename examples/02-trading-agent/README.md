# Trading Agent

Real Coinbase Advanced Trade (CEX) tools — price, balance, place/cancel/list orders — via MCP, gated by a server-side per-trade USD policy cap.

## Run

```bash
pnpm --filter @abstraxn-examples/trading-agent dev
```

http://localhost:3002

On boot the example applies a **$50/day spend policy** (see `lib/session.ts`) on top of the server-side `COINBASE_MAX_ORDER_USD` per-trade cap enforced in `web3-agent-kit-service` before every `coinbase_place_order` call.

Requires `COINBASE_API_KEY_ID` / `COINBASE_API_SECRET` to be configured in `web3-agent-kit-service` (see its `.env.example`) — use a Sandbox-scoped CDP key with Trade ON / Transfer OFF while testing. A Coinbase error such as `INSUFFICIENT_FUND` on a zero-funds account is expected and correct.

## Docs

- [Agent Kit overview](https://docs.abstraxn.com/guides/ai/agent-kit-overview)
- [Interaction policies](https://docs.abstraxn.com/guides/ai/interaction-policies)

## Blog

[Build a Trading Agent with Abstraxn](https://abstraxn.com/blogs/build-trading-agent-abstraxn)

## Content pack

See [CONTENT.md](./CONTENT.md) (blog outline, LinkedIn draft, video script).

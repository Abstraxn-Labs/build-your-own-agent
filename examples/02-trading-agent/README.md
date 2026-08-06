# Trading Agent

Real Coinbase Advanced Trade (CEX) tools — price, balance, place/cancel/list orders — via MCP, gated by a server-side per-trade USD policy cap.

## Run

```bash
pnpm --filter @abstraxn-examples/trading-agent dev
```

http://localhost:3002

On boot the example applies a **$50/day spend policy** (see `lib/session.ts`) on top of the server-side `COINBASE_MAX_ORDER_USD` per-trade cap enforced in `web3-agent-kit-service` before every `coinbase_place_order` call.

This example is **BYOK-only**: `web3-agent-kit-service` holds no Coinbase key at all. Every `coinbase_*` tool except `coinbase_get_price` (a genuinely public Coinbase endpoint, needs no auth) requires a caller-minted bearer token. Set `COINBASE_BYOK_API_KEY_NAME` / `COINBASE_BYOK_API_KEY_SECRET` in this monorepo's root `.env` — this backend mints a short-lived (~120s), request-scoped bearer token locally from those keys and sends only the token to `web3-agent-kit-service` (via `X-Coinbase-Bearer-Token`); the real key never leaves this process. See `lib/coinbase-byok-tool.ts`. This stands in for "the user's own backend holds the key," not a real multi-tenant key store. Without these two env vars set, `/api/chat` returns a `COINBASE_BYOK_NOT_CONFIGURED` error instead of silently falling back to anything.

This talks to Coinbase's real, production API. There's no sandbox mode here. (Coinbase's actual Advanced Trade sandbox is a separate, unauthenticated endpoint with static canned data; it doesn't support price or key-permissions lookups, so it can't stand in for this demo.) Use a real CDP key with Trade ON / Transfer OFF, pointed at an account you know has zero funds, while testing. A Coinbase error such as `INSUFFICIENT_FUND` on a zero-funds account is expected and correct.

Also proactively call `coinbase_get_key_permissions` — a `403 Missing required scopes` on `coinbase_place_order` almost always means the key's Trade permission never actually took effect, not a code bug. `coinbase_preview_order` shows the estimated cost of an order before you place it.

## Docs

- [Agent Kit overview](https://docs.abstraxn.com/guides/ai/agent-kit-overview)
- [Interaction policies](https://docs.abstraxn.com/guides/ai/interaction-policies)

## Blog

[Build a Trading Agent with Abstraxn](https://abstraxn.com/blogs/build-trading-agent-abstraxn)

## Content pack

See [CONTENT.md](./CONTENT.md) (blog outline, LinkedIn draft, video script).

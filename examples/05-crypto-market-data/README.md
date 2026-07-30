# Crypto Market Data Agent

Live CoinMarketCap market data — quotes, technical analysis, holder metrics, news, trending
narratives, global/macro market context — via `cmc_*` MCP tools, each paid automatically
in USDC from the agent's own wallet using the x402 protocol.

## Run (from repo root)

```bash
cp .env.example .env
# ABSTRAXN_API_KEY + LLM_API_KEY (any provider — see docs/LLM-PROVIDERS.md)

pnpm --filter @abstraxn-examples/crypto-market-data dev
```

Open **http://localhost:3005**

Try: *What's the current price and 24h trend for Bitcoin?*

## This needs a funded wallet — there is no sandbox

Every `cmc_*` tool call pays CoinMarketCap directly (~$0.01, in USDC on **Base mainnet**)
from this agent's own wallet the moment you call it. `web3-agent-kit-service` never signs
anything — it only relays CoinMarketCap's x402 challenge back untouched. **This app**
signs it, using the agent's own cached server-wallet `accessKey` (see
[`lib/session.ts`](./lib/session.ts) and `@abstraxn-examples/wallet`'s `signX402Payment`) —
the same external-signing pattern used elsewhere in this series, just applied to an
upstream (not Abstraxn's own) x402 challenge. The signature itself is produced by
Abstraxn's server-wallet infrastructure, so a raw private key never touches this process
either.

CoinMarketCap's x402 endpoint has no test/sandbox mode: it's live mainnet only. Before
any `cmc_*` tool can succeed, this agent's wallet (`get_wallet_address`) needs a small
amount of real USDC on Base sent to it. A first call from a freshly-created, unfunded
agent is **expected** to fail with an insufficient-balance error — that failure is proof
the payment flow is real and working, not a bug to chase.

A hard per-call cap (`X402_MAX_PAYMENT_USD` in this app's `.env`, default `$0.05`) refuses
to sign any payment challenge priced above it, as defense against a misbehaving or
spoofed upstream.

## Customize

Edit **[`lib/agent.ts`](./lib/agent.ts)** — system prompt and tool set. Most `cmc_*` tools
need a CoinMarketCap numeric id rather than a ticker/name; the system prompt tells the
agent to resolve one with `cmc_search_cryptos` first when it doesn't already have it.

## Docs

- [MCP integration](https://docs.abstraxn.com/guides/ai/mcp-integration)
- [CoinMarketCap x402 MCP](https://coinmarketcap.com/api/documentation/ai-agent-hub/x402)

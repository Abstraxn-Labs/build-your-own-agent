# Stable Travel Flights Agent

Real flight fares, booking links, miles/points award availability, and live flight status —
via `stable_travel_*` MCP tools backed by [StableTravel](https://stabletravel.dev) (Google
Flights, Seats.aero, FlightAware), each paid automatically in USDC from the agent's own wallet
using the x402 protocol.

## Run (from repo root)

```bash
cp .env.example .env
# ABSTRAXN_API_KEY + LLM_API_KEY (any provider — see docs/LLM-PROVIDERS.md)

pnpm --filter @abstraxn-examples/stable-travel-flights dev
```

Open **http://localhost:3006**

Try: *Find flights from JFK to LAX on 2026-12-01*

## This needs a funded wallet — there is no sandbox

Every `stable_travel_*` tool call pays StableTravel directly (~$0.01–$0.02, in USDC on **Base
mainnet**) from this agent's own wallet the moment you call it. `web3-agent-kit-service` never
signs anything — it only relays StableTravel's x402 challenge back untouched (via the same
generic `paid_fetch` payment engine used for any x402-gated resource). **This app** signs it,
using the agent's own cached server-wallet `accessKey` (see [`lib/session.ts`](./lib/session.ts)
and `@abstraxn-examples/wallet`'s `signX402Payment`) — the same external-signing pattern used in
[`05-crypto-market-data`](../05-crypto-market-data) for CoinMarketCap, just applied to a
different upstream x402 challenge. The signature itself is produced by Abstraxn's server-wallet
infrastructure, so a raw private key never touches this process either.

StableTravel's x402 endpoints have no test/sandbox mode: it's live mainnet only. Before any
`stable_travel_*` tool can succeed, this agent's wallet (`get_wallet_address`) needs a small
amount of real USDC on Base sent to it. A first call from a freshly-created, unfunded agent is
**expected** to fail with an insufficient-balance error — that failure is proof the payment flow
is real and working, not a bug to chase.

A hard per-call cap (`X402_MAX_PAYMENT_USD` in this app's `.env`, default `$0.05`) refuses to
sign any payment challenge priced above it, as defense against a misbehaving or spoofed upstream.

## What this agent does NOT do

StableTravel is a flight **data** API, not a booking API. `stable_travel_get_booking_options`
returns real airline/OTA links and prices, but this agent never completes a purchase or moves
money for the ticket itself — the fare (hundreds of dollars) is a completely separate payment
from the few cents paid here for API access, and it has to be paid by a human on the airline's
or OTA's own site. Don't expect this chat to ever say a trip was booked or paid for.

## Customize

Edit **[`lib/agent.ts`](./lib/agent.ts)** — system prompt and tool set. Note the two-step flow
for real fares: `stable_travel_search_flights` first, then `stable_travel_get_booking_options`
with the `departure_token` of the chosen flight to get purchase links.

## Docs

- [MCP integration](https://docs.abstraxn.com/guides/ai/mcp-integration)
- [StableTravel API](https://stabletravel.dev)

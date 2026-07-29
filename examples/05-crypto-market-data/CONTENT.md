# Content pack — Crypto Market Data Agent

Series: **Build your Agent with Abstraxn**

## Blog outline

**Title:** Build a Pay-Per-Call Crypto Data Agent with Abstraxn (x402, No API Key)

1. Why pay-per-call beats a subscription for agent-consumed data — CoinMarketCap's x402
   endpoint needs no API key and no plan; every call is metered in USDC, on demand
2. Architecture — `web3-agent-kit-service` relays CoinMarketCap's 402 challenge untouched;
   this app signs it with the agent's own server-wallet `accessKey`, no platform signing
   key involved anywhere
3. Code — the `-32402` catch → `signX402Payment` → signed retry (`callToolWithAutoPay` in
   `@abstraxn-examples/mcp`)
4. Demo prompt — ask for BTC's price and trend, watch the pay-and-retry happen automatically
   in the terminal log
5. CTA — docs + Agent Hub

## LinkedIn draft

Hook: Your agent's data bill can finally match its actual usage — no subscription, no API
key, one cent at a time.

- CoinMarketCap's x402 endpoint bills per call, in USDC, no key required
- Abstraxn's MCP layer relays the 402 challenge untouched — no platform key ever signs it
- The agent signs and pays for its own data, from its own wallet, in one automatic retry

Repo + blog in comments.
#x402 #AIAgents #Abstraxn

## Video script (60–90s)

1. Title: Crypto Market Data Agent — pay-per-call with x402
2. Ask: "What's Bitcoin's price and 24h trend?"
3. Show terminal log: 402 challenge received → signed → retried → result
4. Show the final answer in chat
5. End card: GitHub path `examples/05-crypto-market-data`

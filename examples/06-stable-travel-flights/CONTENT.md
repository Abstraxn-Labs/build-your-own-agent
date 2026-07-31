# Content pack — Stable Travel Flights Agent

Series: **Build your Agent with Abstraxn**

## Blog outline

**Title:** Build a Pay-Per-Call Flight Search Agent with Abstraxn (x402, No API Key)

1. Why pay-per-call fits agent-consumed travel data — StableTravel's x402 endpoints need no
   API key and no plan; every search, booking-link lookup, or status check is metered in USDC,
   on demand
2. Architecture — `web3-agent-kit-service` relays StableTravel's 402 challenge untouched via the
   same generic `paid_fetch` engine used for any x402 resource; this app signs it with the
   agent's own server-wallet `accessKey`, no platform signing key involved anywhere
3. Code — the `-32402` catch → `signX402Payment` → signed retry (`callToolWithAutoPay` in
   `@abstraxn-examples/mcp`) — identical mechanism to `05-crypto-market-data`, different upstream
4. Demo prompt — search JFK → LAX, then ask for booking options, watch the pay-and-retry happen
   automatically in the terminal log
5. Important caveat to call out on camera: this agent finds fares and links, it does not book or
   pay for the ticket itself — that last step is still the human, on the airline's own site
6. CTA — docs + Agent Hub

## LinkedIn draft

Hook: Your travel agent's data bill can finally match its actual usage — no subscription, no API
key, one cent at a time.

- StableTravel's x402 endpoints bill per call, in USDC, no key required
- Abstraxn's MCP layer relays the 402 challenge untouched — no platform key ever signs it
- The agent signs and pays for its own flight search data, from its own wallet, in one automatic
  retry — then hands the human a real booking link to finish the purchase

Repo + blog in comments.
#x402 #AIAgents #Abstraxn

## Video script (60–90s)

1. Title: Stable Travel Flights Agent — pay-per-call flight search with x402
2. Ask: "Find flights from JFK to LAX on 2026-12-01"
3. Show terminal log: 402 challenge received → signed → retried → result
4. Ask: "Get booking options for the first one"
5. Show the real airline/OTA links in chat, and call out explicitly that booking/payment happens
   there, not in this chat
6. End card: GitHub path `examples/06-stable-travel-flights`

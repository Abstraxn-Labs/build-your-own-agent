# Warrant-Gated Transfer Agent

Chat agent built with Abstraxn Agent Kit. Every `transfer` tool call is checked by **KYI Warrant** (`@abstraxn/warrant`) using the **mandate API key** before MCP runs.

## Prerequisites

1. Root `.env` with `ABSTRAXN_API_KEY` + LLM keys (same as other examples).
2. KYI Warrant at `https://dev-warrant-api.abstraxn.com` (or override `WARRANT_URL`).
3. Sealed web3 mandate + env:

```env
WARRANT_URL=https://dev-warrant-api.abstraxn.com
WARRANT_MANDATE_API_KEY=<mandate.apiKey from wallet POC>
WARRANT_AGENT_ID=agent_web3_demo
```

`WARRANT_AGENT_ID` must match the mandate’s `agent_id` (Agent Kit’s own agent id can differ).

## Run

```bash
pnpm install
pnpm --filter @abstraxn-examples/warrant-gated-transfer dev
```

http://localhost:3009

## Demo prompts

- Allow: `Transfer 50 USDC on base to 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Deny (amount): same recipient, amount `150` (mandate max is 100)
- Deny (counterparty): transfer to `0x000000000000000000000000000000000000dead`

On DENY the agent explains `verdict`, `reasons`, and `receipt_id` — MCP `transfer` never runs.

## Keys

| Key | Role |
|-----|------|
| `ABSTRAXN_API_KEY` | Agent Kit app key (create/bind agent, MCP) |
| `WARRANT_MANDATE_API_KEY` | Per-mandate Kong key — runtime `check()` only |
| `WARRANT_AGENT_ID` | Must match sealed mandate `agent_id` |

## Code to customize

- [`lib/agent.ts`](./lib/agent.ts) — system prompt + tool set
- [`lib/warrant-gate.ts`](./lib/warrant-gate.ts) — Warrant wrap around `transfer`

## Content pack

See [CONTENT.md](./CONTENT.md).

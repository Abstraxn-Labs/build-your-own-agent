# Content pack — Warrant-Gated Transfer Agent

Series: **Build your Agent with Abstraxn**

## Blog outline

**Title:** Gate Agent Kit Transfers with KYI Warrant

1. Soft spend policies vs hard owner mandates
2. Mandate API key ≠ application API key
3. Flow: seal mandate → chat agent → Warrant before MCP transfer
4. Demo: ALLOW under limit, DENY over limit / bad counterparty
5. CTA — example `09-warrant-gated-transfer` + KYI Framework

## LinkedIn draft

Hook: Your agent’s transfer tool should ask permission — cryptographically.

- Abstraxn Agent Kit chat + KYI Warrant check before MCP
- Per-mandate API key at runtime (not the dashboard app key)
- Example: `examples/09-warrant-gated-transfer`

Owner seals the rules. The agent cannot overspend them.

## Video script (60–90s)

1. Title: Warrant-gated transfers
2. Show mandate sealed for Agent Kit agent id
3. Chat: transfer within limit → ALLOW + receipt
4. Chat: over limit → DENY, no MCP transfer
5. End card → GitHub example

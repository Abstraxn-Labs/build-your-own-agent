# Content pack — Transaction Monitoring Agent

Series: **Build your Agent with Abstraxn**

## Blog format (merged — educational + developer)

One post, two audiences. Do **not** split into separate educational vs developer blogs.

1. Ops need agents that watch, not just chat
2. Tools — `get_transaction_status`, balances, gas, analytics
3. Simulate before you send, decode after it lands — `tenderly_simulate_transaction` /
   `tenderly_explain_transaction`
4. Code walkthrough
5. Alert-style prompt examples
6. CTA

## LinkedIn draft

Hook: Your agent should notice a stuck tx before your users do — and know why it failed.

- Abstraxn MCP: status, balance, gas, analytics
- Tenderly: simulate before sending, decode a revert after the fact
- Same scaffold as Firecrawl + Trading examples
- Clone `examples/03-tx-monitoring`

## Video script (60–90s)

1. Title: Ops agents that watch the chain
2. Ask for wallet balance + gas
3. Simulate a transfer, then paste a failed tx hash → decoded revert reason
4. End card with repo link

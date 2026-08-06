# Content pack — Transaction Monitoring Agent

Series: **Build your Agent with Abstraxn**

## Blog outline

**Title:** Build a Transaction Monitoring Agent with Abstraxn

1. Ops need agents that watch, not just chat
2. Tools — `get_transaction_status`, `get_balance`, `get_gas_info`, `data_and_analytics`
3. Simulate before you send, decode after it lands — `tenderly_simulate_transaction` /
   `tenderly_explain_transaction` (requires `TENDERLY_ACCESS_KEY`, `TENDERLY_ACCOUNT`,
   `TENDERLY_PROJECT` on the MCP server side)
4. Code walkthrough — `lib/agent.ts` system prompt + `app/api/chat/route.ts`
5. Alert-style prompt examples — balance/gas check, simulate a transfer on base-sepolia,
   decode a failed tx hash
6. CTA

**Live post:** abstraxn.com/blogs/build-tx-monitoring-agent-abstraxn

**Code refs:** `examples/03-tx-monitoring/lib/agent.ts`, `app/api/chat/route.ts`,
`packages/mcp/src/index.ts` (`TOOL_SETS.txMonitoring`)

## LinkedIn draft

Hook: Your agent should notice a stuck tx before your users do — and know why it failed.

- Abstraxn MCP: status, balance, gas, analytics
- Tenderly: simulate before sending, decode a revert after the fact
- Same scaffold as Firecrawl + Trading examples
- Clone `examples/03-tx-monitoring`, run on port 3003

Repo: github.com/Abstraxn-Labs/abstraxn-agent-examples
Blog: abstraxn.com/blogs/build-tx-monitoring-agent-abstraxn
#AIAgents #MCP #Web3 #BuildYourOwnAgent

## Video script (60–90s)

1. Title card
2. Ask: "What is my wallet balance and current gas info?"
3. Ask: "Simulate sending 0.001 ETH to my own wallet on base-sepolia" → preview result
4. Paste a failed tx hash, ask "What happened with this transaction?" → decoded revert reason
5. End card with repo link

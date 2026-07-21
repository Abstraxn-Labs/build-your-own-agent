# Content pack — Transaction Monitoring Agent

Series: **Build your Agent with Abstraxn**

## Blog format (merged — educational + developer)

One post, two audiences. Do **not** split into separate educational vs developer blogs.

| Section | Audience | Purpose |
|---------|----------|---------|
| Hook + why ops layer | PM, evaluators | Agents that watch, not just chat |
| How MCP powers monitoring | Architects | Tool table, architecture diagram |
| Try it without code | MCP users | Balance, gas, tx status via dashboard MCP |
| Build it (steps + code) | Developers | `agent.ts`, run, demo prompts |
| Prompt tips + CTA | Both | Alert-style framing, series links |

**Live post:** abstraxn.com/blogs/build-tx-monitoring-agent-abstraxn (draft)

**Cover image text** (punchy — not the blog title):
- Headline suggestion: *Notice the Stuck Tx First*
- Subtitle suggestion: *Balances, gas, and confirmation status through Abstraxn MCP — alert-style, not guesses.*

**Code refs:** `examples/03-tx-monitoring/lib/agent.ts`, `packages/mcp` (`TOOL_SETS.txMonitoring`)

## LinkedIn draft

Hook: Your agent should notice a stuck tx before your users do.

- Why: conversational ops layer on top of on-chain tools
- No-code: MCP client + tx hash / balance prompts
- Dev path: clone `examples/03-tx-monitoring`

Repo: github.com/Abstraxn-Labs/abstraxn-agent-examples  
Blog: abstraxn.com/blogs/build-tx-monitoring-agent-abstraxn  
#AIAgents #Web3 #BuildYourOwnAgent

## Video script (60–90s)

1. Title: Ops agents that watch the chain
2. Ask for wallet balance + gas
3. Paste a tx hash → status summary
4. End card with repo link

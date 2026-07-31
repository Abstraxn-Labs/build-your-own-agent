# Content pack — Trading Agent

Series: **Build your Agent with Abstraxn**

## Blog format (merged — educational + developer)

One post, two audiences. Do **not** split into separate educational vs developer blogs.

| Section | Audience | Purpose |
|---------|----------|---------|
| Hook + why guardrails | PM, evaluators | Trading agents need spend caps before quotes |
| How quotes + policy fit | Architects | Layer table, architecture diagram |
| Try it without code | Dashboard users | agent.abstraxn.com spend policy + MCP |
| Build it (steps + code) | Developers | `session.ts` guardrails, `agent.ts`, run |
| Production notes + CTA | Both | Testnet-first, series links |

**Live post:** abstraxn.com/blogs/build-trading-agent-abstraxn (draft)

**Cover image text** (punchy — not the blog title):
- Headline suggestion: *Quote First, Cap Always*
- Subtitle suggestion: *Uniswap + EVM swap quotes through Abstraxn MCP — with a daily spend policy on boot.*

**Code refs:** `examples/02-trading-agent/lib/agent.ts`, `lib/session.ts`, `packages/mcp` (`TOOL_SETS.trading`)

## LinkedIn draft

Hook: A trading agent without a spend cap is a liability.

- Why: policy at the wallet layer, not in the prompt
- No-code: dashboard spend limits + MCP client
- Dev path: clone `examples/02-trading-agent`, guardrails in ~10 lines

Repo: github.com/Abstraxn-Labs/abstraxn-agent-examples  
Blog: abstraxn.com/blogs/build-trading-agent-abstraxn  
#DeFi #AIAgents #BuildYourOwnAgent

## Video script (60–90s)

1. Title: Why trading agents need spend caps
2. Show spend policy log on boot
3. Ask for a swap quote
4. Show tool result + policy callout
5. End card: GitHub path `examples/02-trading-agent`

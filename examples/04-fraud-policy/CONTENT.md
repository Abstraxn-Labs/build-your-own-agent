# Content pack — Fraud Policy Agent

Series: **Build your Agent with Abstraxn**

## Blog format (merged — educational + developer)

One post, two audiences. Do **not** split into separate educational vs developer blogs.

| Section | Audience | Purpose |
|---------|----------|---------|
| Hook + why hard stops | PM, evaluators | Prompt injection vs wallet policy |
| Honest framing | Compliance-minded | Policies ≠ full AML |
| How spend + interaction fit | Architects | Policy table, architecture diagram |
| Try it without code | Dashboard users | Dashboard policies + blocked transfer demo |
| Build it (steps + code) | Developers | `session.ts`, `agent.ts`, demo prompt |
| What this is not + CTA | Both | Guardrail layer first, series links |

**Live post:** abstraxn.com/blogs/build-fraud-policy-agent-abstraxn (draft)

**Cover image text** (punchy — not the blog title):
- Headline suggestion: *Hard Stops, Not Hope*
- Subtitle suggestion: *Spend caps + recipient blacklists — policy blocks the transfer, the agent explains why.*

**Code refs:** `examples/04-fraud-policy/lib/agent.ts`, `lib/session.ts`, `packages/mcp` (`TOOL_SETS.fraudPolicy`)

## LinkedIn draft

Hook: Prompt injection shouldn't empty your agent's wallet.

- Why: LLMs can be persuaded; wallet policy should not be
- No-code: dashboard spend + interaction policies
- Dev path: clone `examples/04-fraud-policy`, demo blocked transfer to 0x…dead

Not a full fraud suite — it's the guardrail layer every agent needs first.

Repo: github.com/Abstraxn-Labs/abstraxn-agent-examples  
Blog: abstraxn.com/blogs/build-fraud-policy-agent-abstraxn  
#AIAgents #Web3 #BuildYourOwnAgent

## Video script (60–90s)

1. Title: Policy-enforced agents
2. Show policies applied on boot
3. Ask agent to transfer to `0x…dead`
4. Show block + explanation
5. End card

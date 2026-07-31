# Build your Agent with Abstraxn

**Clone → pick one example → run in 5 minutes.**

Open-source examples for building AI agents with [`@abstraxn/agent-kit`](https://www.npmjs.com/package/@abstraxn/agent-kit) and Abstraxn MCP. Each example is a small Next.js chat app — not a full product.

[![Agent Kit docs](https://img.shields.io/badge/docs-Agent%20Kit-blue)](https://docs.abstraxn.com/guides/ai/agent-kit-overview)
[![npm agent-kit](https://img.shields.io/npm/v/@abstraxn/agent-kit)](https://www.npmjs.com/package/@abstraxn/agent-kit)

**Stack (kept current via pnpm catalog):** Next.js 16 · React 19 · AI SDK 7 · TypeScript 5.9 · Node 20+ · Zod 4

---

## I only want one agent (e.g. web crawling)

**You do not need to read or run the other examples.** They are separate apps in the same repo for discoverability — like chapters in a cookbook, not one big app.

| I want to… | Go here | Run |
|------------|---------|-----|
| **Web crawling / research (Firecrawl)** | [`examples/01-firecrawl-research`](examples/01-firecrawl-research) | `pnpm --filter @abstraxn-examples/firecrawl-research dev` |
| Trading / swap quotes | [`examples/02-trading-agent`](examples/02-trading-agent) | `pnpm --filter @abstraxn-examples/trading-agent dev` |
| Transaction monitoring | [`examples/03-tx-monitoring`](examples/03-tx-monitoring) | `pnpm --filter @abstraxn-examples/tx-monitoring dev` |
| Fraud / policy guardrails | [`examples/04-fraud-policy`](examples/04-fraud-policy) | `pnpm --filter @abstraxn-examples/fraud-policy dev` |
| Crypto market data (CoinMarketCap) | [`examples/05-crypto-market-data`](examples/05-crypto-market-data) | `pnpm --filter @abstraxn-examples/crypto-market-data dev` |
| Flight search / booking links (StableTravel) | [`examples/06-stable-travel-flights`](examples/06-stable-travel-flights) | `pnpm --filter @abstraxn-examples/stable-travel-flights dev` |
| Verify setup (smoke test) | [`examples/00-hello-wallet`](examples/00-hello-wallet) | `pnpm --filter @abstraxn-examples/hello-wallet dev` |

**Minimal steps (Firecrawl example):**

```bash
git clone https://github.com/Abstraxn-Labs/abstraxn-agent-examples.git
cd abstraxn-agent-examples
pnpm install
cp .env.example .env
# Set ABSTRAXN_API_KEY (Dashboard → Agentic Stack) and LLM_API_KEY (see docs/LLM-PROVIDERS.md)

# To run all the example
pnpm run dev
# → http://localhost:3000
```

Then open [`examples/01-firecrawl-research/lib/agent.ts`](examples/01-firecrawl-research/lib/agent.ts) — that is the **only file you need to customize** for your use case (system prompt + tool set).

### Why is everything in one repo?

| Piece | Do you need it for crawling only? | Why it exists |
|-------|----------------------------------|---------------|
| `examples/00-hello-wallet` | **No** — ignore it | Smoke-test example other developers use to verify setup |
| `packages/core`, `mcp`, `llm`, `utils` | **Yes** (via dependencies) | Shared glue so each example stays ~50 lines instead of 500 |
| `templates/next-agent` | Only if you add a new use case | Copy-paste scaffold for contributors |

So the monorepo is **not** “one giant app you must understand.” It is:

- **Shared packages** = integration code written once (Agent Kit bootstrap, MCP → AI SDK tools, env validation)
- **Examples** = thin shells; pick the one that matches your job

If you want a **private repo with only crawling**, fork this repo and delete the other `examples/*` folders. Keep `packages/` — your app still depends on it.

### Option A — Clone and ignore (fastest)

Use the full repo as-is. Run only the example you care about with `pnpm --filter`. Other folders sit on disk but never run.

### Option B — Fork and delete (cleanest for one use case)

Best when you want **your own GitHub repo** with only Firecrawl and no extra examples.

1. **Fork** [abstraxn-agent-examples](https://github.com/Abstraxn-Labs/abstraxn-agent-examples) on GitHub (or clone, then push to a new empty repo).
2. **Delete** the examples you do not need:

```bash
# Example: keep only Firecrawl
rm -rf examples/00-hello-wallet
rm -rf examples/02-trading-agent
rm -rf examples/03-tx-monitoring
rm -rf examples/04-fraud-policy
rm -rf examples/05-crypto-market-data
rm -rf examples/06-stable-travel-flights
# Optional: remove template if you are not adding new examples
rm -rf templates/next-agent
```

3. **Keep** these — your app depends on them:

```
packages/          # core, mcp, llm, wallet, utils — required
examples/01-firecrawl-research/   # your use case
pnpm-workspace.yaml
package.json
.env.example
```

4. Update `pnpm-workspace.yaml` if you removed folders (remove deleted paths from the `packages:` list).
5. Run `pnpm install` and `pnpm --filter @abstraxn-examples/firecrawl-research dev` as usual.

You now have a smaller repo that is **yours to customize** — rename the example folder, change branding, ship to production.

### Option C — Need a different use case later?

- **Stay on upstream:** clone the full repo again and run another `examples/*` folder.
- **On your fork:** pull from upstream, or copy one example folder + its `lib/agent.ts` pattern into your fork.

You never need to merge all use cases into one app — each example is independent.

---

## Prerequisites

- **Node.js 20.9+** (required by Next.js 16)
- [Abstraxn API key](https://app.abstraxn.com) (Dashboard → Agentic Stack → Overview)
- **LLM API key** — OpenAI, OpenRouter, Anthropic, or any OpenAI-compatible API ([LLM setup guide](docs/LLM-PROVIDERS.md))
- For Firecrawl: enable the integration in the Abstraxn dashboard ([guide](https://docs.abstraxn.com/guides/ai/firecrawl-integration))

---

## How it works (30 seconds)

```
Your chat UI (Next.js)
    → Vercel AI SDK (packages/llm)
    → Abstraxn MCP tools (packages/mcp)
    → @abstraxn/agent-kit (packages/core)
    → Agent Kit API + your agent wallet
```

Each example customizes **one file**: `lib/agent.ts` (name, system prompt, allowed MCP tools).

---

## All examples

| Example | Port | MCP tools (high level) |
|---------|------|-------------------------|
| [hello-wallet](examples/00-hello-wallet) | 3000 | balance, address, gas |
| [firecrawl-research](examples/01-firecrawl-research) | 3001 | `firecrawl_scrape` |
| [trading-agent](examples/02-trading-agent) | 3002 | swap quotes + spend policy |
| [tx-monitoring](examples/03-tx-monitoring) | 3003 | tx status, analytics |
| [fraud-policy](examples/04-fraud-policy) | 3004 | policies + blocked transfers |
| [crypto-market-data](examples/05-crypto-market-data) | 3005 | `cmc_*` (x402-paid CoinMarketCap data) |
| [stable-travel-flights](examples/06-stable-travel-flights) | 3006 | `stable_travel_*` (x402-paid StableTravel flight data) |

Blog walkthroughs: [abstraxn.com/blogs](https://abstraxn.com/blogs) · Index: [SERIES.md](SERIES.md)

---

## Repo layout

```
abstraxn-agent-examples/
├── packages/          # Shared integration (you import these, rarely edit)
│   ├── core/        # Create/bind agent, MCP client
│   ├── mcp/         # Tool allowlists + MCP → AI SDK
│   ├── llm/         # Chat loop (Vercel AI SDK)
│   ├── wallet/      # Spend + interaction policies
│   └── utils/       # Env validation
├── examples/        # One folder = one agent use case (pick yours)
├── templates/
│   └── next-agent/  # Copy to add a new example
├── .env.example
└── CONTRIBUTING.md
```

---

## Environment variables

Copy [`.env.example`](.env.example) to `.env` at the **repo root**.

### Abstraxn Agent Kit

| Variable | Required | Description |
|----------|----------|-------------|
| `ABSTRAXN_API_KEY` | Yes | Application API key from Abstraxn dashboard |
| `ABSTRAXN_USER_IDENTITY` | No | Stable user id for agent binding (default: `demo@example.com`) |
| `ABSTRAXN_AGENT_ID` | No | Reuse an existing agent instead of creating one |
| `ABSTRAXN_MCP_TOKEN` | No | Pair with `ABSTRAXN_AGENT_ID` for reuse |

### LLM (any provider)

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_PROVIDER` | No | `openai` (default) · `openrouter` · `anthropic` · `openai-compatible` |
| `LLM_API_KEY` | Yes | API key for your chosen provider |
| `LLM_MODEL` | No | Model id (defaults listed in [LLM-PROVIDERS.md](docs/LLM-PROVIDERS.md)) |
| `LLM_BASE_URL` | For custom APIs | Required for `openai-compatible` (Groq, Together, Ollama, …) |

**Examples:** OpenRouter → `LLM_PROVIDER=openrouter` + `LLM_MODEL=anthropic/claude-3.5-sonnet`.  
Full guide with copy-paste blocks: **[docs/LLM-PROVIDERS.md](docs/LLM-PROVIDERS.md)**  
Stack versions and upgrade notes: **[docs/STACK.md](docs/STACK.md)**

Legacy `OPENAI_API_KEY` / `OPENAI_MODEL` still work.

Never commit `.env` or keys.

---

## Build your own agent

1. Copy `templates/next-agent` → `examples/NN-your-name`
2. Edit `lib/agent.ts` (prompt + tools)
3. Add a tool set in [`packages/mcp/src/index.ts`](packages/mcp/src/index.ts) if needed
4. Add a row to the table above + open a PR

Details: [CONTRIBUTING.md](CONTRIBUTING.md)

---

## Scripts

```bash
pnpm install                 # once, at repo root
pnpm run build:packages      # build shared packages
pnpm typecheck               # typecheck everything
pnpm --filter @abstraxn-examples/<name> dev   # run one example
```

---

## Documentation

- [Agent Kit overview](https://docs.abstraxn.com/guides/ai/agent-kit-overview)
- [SDK quickstart](https://docs.abstraxn.com/guides/ai/sdk-quickstart)
- [MCP integration](https://docs.abstraxn.com/guides/ai/mcp-integration)
- [Firecrawl](https://docs.abstraxn.com/guides/ai/firecrawl-integration)
- [Interaction policies](https://docs.abstraxn.com/guides/ai/interaction-policies)

---

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

**License:** [MIT](LICENSE)

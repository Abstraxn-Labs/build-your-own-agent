# OpenWeb Ninja x402 Agent

Research + lead-gen agent using all 26 `openweb_ninja_*` MCP tools from `web3-agent-kit-service`
(web/SERP search, news, forums, images, AI answers, local business data, contacts, jobs,
Glassdoor, and more). Every call is pay-per-use over **x402** — no API key, no subscription —
signed with the **Abstraxn Agent Kit signer SDK**, the same server-wallet flow
`agent-app-service` uses in production.

> ⚠️ **Real money.** OpenWeb Ninja's x402 gateway only offers mainnet payment (Base, Polygon, or
> Arbitrum USDC — no testnet exists upstream). This example never pays automatically: on a 402 it
> shows the price and a **"Pay & Retry"** button, and only signs/spends when you click it.

> **Using only this example?** You have three choices:
>
> 1. **Clone and ignore** — run only this folder; leave other examples in the repo.
> 2. **Fork and delete** — fork the repo, delete other `examples/*`, keep `packages/`. See [Option B in the root README](../../README.md#option-b--fork-and-delete-cleanest-for-one-use-case).
> 3. **Customize here** — edit [`lib/agent.ts`](./lib/agent.ts) and ship.

## Run (from repo root)

```bash
cp .env.example .env
# ABSTRAXN_API_KEY + LLM_API_KEY (any provider — see docs/LLM-PROVIDERS.md)

pnpm --filter @abstraxn-examples/openweb-ninja-x402 dev
```

Open **http://localhost:3006**

Try: *Search the web for "abstraxn x402".* — the agent will call `openweb_ninja_web_search`,
get a 402 back, and ask you to confirm payment ($0.003 in USDC).

To actually see a real result, fund the wallet address shown in the page banner with a small
amount of USDC on Base (or Polygon/Arbitrum) before clicking **Pay & Retry**.

## How the payment flow works

1. The agent calls an `openweb_ninja_*` tool. The tool wrapper (`lib/paid-tools.ts`) probes it
   via the MCP server's raw `rpc()` method (not the SDK's `callTool()`, which drops the payment
   data on error) and gets back a `-32402` challenge.
2. The chat UI renders that as a payment card (price, network) instead of raw JSON.
3. You click **Pay & Retry** → `POST /api/pay` → `lib/x402-signing.ts::signOpenWebNinjaPayment`
   signs an EIP-3009 "exact" USDC payment authorization using the Abstraxn server-wallet signer
   (`AgentKitClient.getServerSigner()` → `.authenticate()` → `.createPublicClient()` →
   `.signTypedData()`, wrapped for `@x402/core`/`@x402/evm`) — a direct port of
   `agent-app-service`'s `AgentSigningService.createX402PaymentPayloadForAgent`.
4. The signed payment is attached and the same tool call is retried; the real OpenWeb Ninja
   result comes back and renders in place of the payment card.

## Customize

Edit **[`lib/agent.ts`](./lib/agent.ts)** — system prompt and tool allowlist (`OPENWEB_NINJA_TOOL_NAMES`).
That is the main file for narrowing this down to fewer tools or a different flavor (e.g. just
lead-gen tools, or just research tools).

## Docs

- [MCP integration](https://docs.abstraxn.com/guides/ai/mcp-integration)

## Content pack

See [CONTENT.md](./CONTENT.md) (LinkedIn draft + video script).

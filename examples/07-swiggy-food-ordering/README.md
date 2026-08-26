# Swiggy Food Ordering Agent

Food-ordering agent using Abstraxn MCP `swiggy_*` tools (saved addresses, search restaurants, browse/search menu, manage cart, payment options, place order, track order, order history, coupons).

> **Using only this example?** You have three choices:
>
> 1. **Clone and ignore** — run only this folder; leave other examples in the repo.
> 2. **Fork and delete** — fork the repo, delete other `examples/*`, keep `packages/`. See [Option B in the root README](../../README.md#option-b--fork-and-delete-cleanest-for-one-use-case).
> 3. **Customize here** — edit [`lib/agent.ts`](./lib/agent.ts) and ship.

## Prerequisites

This example implements Swiggy's OAuth 2.1 + PKCE flow directly — no manual
token wrangling needed. On first run, open the app and click **Connect
Swiggy Account**; you'll be redirected to Swiggy's real login page
(`mcp.swiggy.com`), log in with your own Swiggy account, and get redirected
back. From then on, the agent's `swiggy_*` tool calls use your connected
account automatically (tokens are refreshed in the background before they
expire).

If your Swiggy account doesn't yet have OAuth/MCP access enabled, the
Connect flow will fail at Swiggy's own login/consent screen — that's
controlled entirely by Swiggy, not by this example or by Abstraxn.

### Optional fallback: manual tokens

If you already have a Swiggy `access_token`/`refresh_token` pair from
another source (e.g. Claude.ai's own Swiggy connector), you can still set
`SWIGGY_ACCESS_TOKEN`/`SWIGGY_REFRESH_TOKEN` in `.env` as a manual override.
These are only used as a fallback when no account is connected via the
in-app OAuth flow.

## Run (from repo root)

```bash
cp .env.example .env
# ABSTRAXN_API_KEY + LLM_API_KEY (any provider — see docs/LLM-PROVIDERS.md)

pnpm --filter @abstraxn-examples/swiggy-food-ordering dev
```

Open **http://localhost:3007** and click **Connect Swiggy Account**.

This example chat UI has **no Swiggy widgets**. Cart totals and UPI QR codes are rendered
from tool results in the chat (and a sticky QR card in the sidebar when payment is pending).

Try: *Find a highly-rated biryani place near me and show me the menu.* Confirm the cart in
chat, choose **UPI**, scan the QR, then type *I've paid*.

## Customize

Edit **[`lib/agent.ts`](./lib/agent.ts)** — system prompt and tool set. That is the main file for your food-ordering agent.

The Swiggy connection is handled by **[`lib/swiggy-oauth.ts`](./lib/swiggy-oauth.ts)**
(OAuth 2.1 + PKCE + Dynamic Client Registration against Swiggy's real
endpoints) and injected server-side (never pasted into chat) by
**[`lib/swiggy-tools.ts`](./lib/swiggy-tools.ts)**, which wraps the
`swiggy_*` tools before handing them to the chat loop.

## Safety: order confirmation

`swiggy_place_order` only places a real order when called with
`confirm: true`, an `addressId`, and a `paymentMethod` ("Cash" or "UPI").
The system prompt instructs the agent to always show the priced cart
summary from `swiggy_manage_cart` and the available methods from
`swiggy_get_payment_options`, and get the user's explicit go-ahead before
setting `confirm: true` — see the tool's description in
`web3-agent-kit-service/src/mcp/tools/swiggy-place-order.tool.ts` for the
full contract. A UPI order isn't final until `swiggy_check_payment_status`
confirms it — the agent never claims success before that.

## Docs

- [MCP integration](https://docs.abstraxn.com/guides/ai/mcp-integration)
- Swiggy's own OAuth metadata: `https://mcp.swiggy.com/.well-known/oauth-authorization-server`

## Content pack

See [CONTENT.md](./CONTENT.md) (LinkedIn draft + video script).

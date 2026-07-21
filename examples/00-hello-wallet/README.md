# Hello Wallet

Smoke-test Abstraxn Agent Kit: `get_wallet_address`, `get_balance`, `get_gas_info`.

## Run

```bash
# from repo root
cp .env.example .env   # once — edit ABSTRAXN_API_KEY + LLM_API_KEY
pnpm install
pnpm run build:packages
pnpm --filter @abstraxn-examples/hello-wallet dev
```

Open http://localhost:3000

**Important:** `.env` lives at the **repo root**. Next.js loads it via `next.config.ts`. After creating or editing `.env`, **restart** the dev server (`Ctrl+C`, then run `dev` again). You should see `- Environments: .env` in the startup log.

Try: *What is my wallet address and native balance?*

## Docs

- [SDK quickstart](https://docs.abstraxn.com/guides/ai/sdk-quickstart)
- [MCP tools reference](https://docs.abstraxn.com/guides/ai/mcp-tools-reference)

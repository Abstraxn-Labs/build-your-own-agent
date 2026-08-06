# Transaction Monitoring Agent

Watch balances, gas, and transaction status through Abstraxn MCP — plus simulate transactions
before sending them and decode what happened in ones that already landed, powered by Tenderly.

## Run

```bash
pnpm --filter @abstraxn-examples/tx-monitoring dev
```

http://localhost:3003

## Tenderly setup

The Abstraxn MCP server (`web3-agent-kit-service`) must have `TENDERLY_ACCESS_KEY`,
`TENDERLY_ACCOUNT`, and `TENDERLY_PROJECT` configured in its environment — get these from your
[Tenderly dashboard](https://dashboard.tenderly.co) — for `tenderly_simulate_transaction` and
`tenderly_explain_transaction` to work. This example itself needs no Tenderly credentials; it
only calls those tools by name over MCP, same as any other tool.

## Docs

- [MCP tools reference](https://docs.abstraxn.com/guides/ai/mcp-tools-reference)

## Blog

[Build a Transaction Monitoring Agent with Abstraxn](https://abstraxn.com/blogs/build-tx-monitoring-agent-abstraxn)

## Content pack

See [CONTENT.md](./CONTENT.md) (blog outline, LinkedIn draft, video script).

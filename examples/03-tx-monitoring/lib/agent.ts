import type { AgentConfig } from '@abstraxn-examples/llm';

export const agentMeta = {
  title: 'Transaction Monitoring',
  subtitle: 'Watch balances, gas, and transaction status via Abstraxn MCP.',
  capabilities: [
    'get_transaction_status',
    'get_balance',
    'get_gas_info',
    'data_and_analytics',
  ],
  docsUrl: 'https://docs.abstraxn.com/guides/ai/mcp-tools-reference',
};

export const agentConfig: AgentConfig = {
  name: 'Tx Monitoring Agent',
  tools: 'txMonitoring',
  system: `You monitor wallets and transactions.
When given a tx hash, call get_transaction_status.
When asked about balances or gas, use the matching tools.
Present alert-style summaries: status, risk notes, and recommended next checks.
Do not invent on-chain data.`,
};

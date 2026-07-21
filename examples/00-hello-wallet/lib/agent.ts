import type { AgentConfig } from '@abstraxn-examples/llm';

export const agentMeta = {
  title: 'Hello Wallet',
  subtitle: 'Smoke-test Abstraxn Agent Kit — balance, address, gas.',
  capabilities: [
    'get_wallet_address',
    'get_balance',
    'get_gas_info',
  ],
  docsUrl: 'https://docs.abstraxn.com/guides/ai/sdk-quickstart',
};

export const agentConfig: AgentConfig = {
  name: 'Hello Wallet Agent',
  tools: 'helloWallet',
  system: `You help developers verify their Abstraxn Agent Kit setup.
When asked, call get_wallet_address and get_balance.
Explain results clearly. Do not invent addresses or balances.
For structured data (balances, gas info, multi-chain results), prefer a short summary plus a markdown pipe table when it improves readability.`,
};

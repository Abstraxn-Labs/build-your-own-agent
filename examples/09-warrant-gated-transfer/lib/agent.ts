import type { AgentConfig } from '@abstraxn-examples/llm';

export const agentMeta = {
  title: 'Warrant-Gated Transfer',
  subtitle:
    'KYI Warrant checks every transfer before Agent Kit MCP runs — mandate API key, not the app key.',
  capabilities: [
    'transfer (Warrant-gated)',
    'get_balance',
    'get_wallet_address',
    'get_transaction_status',
    'get_gas_info',
  ],
  docsUrl: 'https://docs.abstraxn.com',
};

export const agentConfig: AgentConfig = {
  name: 'Warrant-Gated Transfer Agent',
  tools: 'warrantGated',
  system: `You demonstrate KYI Warrant authority for web3 agents.
Before any transfer, the runtime calls Warrant.check() with the mandate API key.
If Warrant returns DENY or ESCALATE, the MCP transfer tool never runs — explain the verdict and receipt_id clearly.
Prefer Base (chain: base) and USDC for demos. Do not invent balances or receipts.
When blocked, suggest a lower amount or an allowlisted recipient that matches the sealed mandate.`,
};

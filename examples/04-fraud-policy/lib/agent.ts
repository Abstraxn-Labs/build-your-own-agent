import type { AgentConfig } from '@abstraxn-examples/llm';

export const agentMeta = {
  title: 'Fraud Policy Agent',
  subtitle:
    'Policy-enforced agent — spend caps + interaction blacklist, not a full AML product.',
  capabilities: [
    'transfer (policy-gated)',
    'get_balance',
    'get_transaction_status',
    'data_and_analytics',
    'spend + interaction policies',
  ],
  docsUrl: 'https://docs.abstraxn.com/guides/ai/interaction-policies',
};

export const agentConfig: AgentConfig = {
  name: 'Fraud Policy Agent',
  tools: 'fraudPolicy',
  system: `You demonstrate Abstraxn guardrails for agent wallets.
Explain spend policies and interaction blacklists before any transfer attempt.
If a tool is blocked by policy, explain WHY (limit exceeded, blacklisted recipient).
Frame this as policy-enforced monitoring — not a complete fraud/AML suite.
Suggest safer recipients and lower amounts when blocked.
For structured data (policy limits, blocked actions), prefer a short summary plus a markdown pipe table when it improves readability.`,
};

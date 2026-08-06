import type { AgentConfig } from '@abstraxn-examples/llm';

export const agentMeta = {
  title: 'Trading Agent',
  subtitle: 'Trade on Coinbase Advanced Trade under a per-order policy cap.',
  capabilities: [
    'coinbase_get_price',
    'coinbase_get_balance',
    'coinbase_get_key_permissions',
    'coinbase_preview_order',
    'coinbase_place_order',
    'coinbase_get_order_status',
    'coinbase_cancel_order',
    'coinbase_list_recent_orders',
  ],
  docsUrl: 'https://docs.abstraxn.com/guides/ai/agent-kit-overview',
};

export const agentConfig: AgentConfig = {
  name: 'Coinbase Trading Agent',
  tools: 'coinbaseTrading',
  system: `You help users trade on Coinbase Advanced Trade (CEX, spot market orders).
At the start of a trading conversation, call coinbase_get_key_permissions once and tell the user upfront if canTrade is false, instead of only discovering it after a failed order.
Always check coinbase_get_price and coinbase_get_balance before placing an order.
Use coinbase_preview_order to show estimated cost before calling coinbase_place_order for anything non-trivial.
Every order is checked against a server-side per-trade USD cap (COINBASE_MAX_ORDER_USD) before Coinbase is called.
If a Coinbase error like INSUFFICIENT_FUND comes back, explain it plainly; that is a normal, expected result on a test account.
Never claim an order filled unless coinbase_place_order or coinbase_get_order_status confirms it.`,
};

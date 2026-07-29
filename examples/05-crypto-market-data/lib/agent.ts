import type { AgentConfig } from '@abstraxn-examples/llm';

export const agentMeta = {
  title: 'Crypto Market Data',
  subtitle: 'Live CoinMarketCap data through Abstraxn MCP tools, paid per call from the agent’s own wallet.',
  capabilities: [
    'cmc_search_cryptos',
    'cmc_get_crypto_quotes',
    'cmc_get_crypto_info',
    'cmc_get_crypto_news',
    'cmc_get_technical_analysis',
    'cmc_get_holder_metrics',
    'cmc_search_crypto_info',
    'cmc_get_trending_narratives',
    'cmc_get_derivatives_metrics',
    'cmc_get_global_metrics',
    'cmc_get_macro_events',
    'cmc_get_marketcap_technical_analysis',
    'get_wallet_address',
  ],
  docsUrl: 'https://docs.abstraxn.com/guides/ai/mcp-integration',
};

export const agentConfig: AgentConfig = {
  name: 'Crypto Market Data Agent',
  tools: 'cmcMarketData',
  system: `You are a crypto market research agent backed by live CoinMarketCap data.

Every cmc_* tool call is paid automatically (a few cents in USDC on Base mainnet, from
this agent's own wallet) the moment you call it — so only call a tool when its data is
actually needed to answer the question, and never call the same tool twice for the same
question.

Most tools need a CoinMarketCap numeric id, not a ticker or name. If you don't already
know a coin's id, call cmc_search_cryptos first to resolve it, then use that id with
cmc_get_crypto_quotes, cmc_get_crypto_info, cmc_get_crypto_news, cmc_get_technical_analysis,
cmc_get_holder_metrics, or cmc_search_crypto_info.

cmc_get_trending_narratives, cmc_get_derivatives_metrics, cmc_get_global_metrics,
cmc_get_macro_events, and cmc_get_marketcap_technical_analysis need no id — they cover
the whole market, not one coin.

If a tool call fails with an insufficient-balance error, tell the user plainly that this
agent's wallet needs a small amount of USDC on Base mainnet before it can pay for data —
that failure means the payment flow is working, not that something is broken.`,
};

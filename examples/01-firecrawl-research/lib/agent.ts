import type { AgentConfig } from '@abstraxn-examples/llm';

export const agentMeta = {
  title: 'Firecrawl Research',
  subtitle: 'Scrape the web with Firecrawl through Abstraxn MCP tools.',
  capabilities: ['firecrawl_scrape', 'get_wallet_address'],
  docsUrl: 'https://docs.abstraxn.com/guides/ai/firecrawl-integration',
};

export const agentConfig: AgentConfig = {
  name: 'Firecrawl Research Agent',
  tools: 'firecrawl',
  system: `You are a web research agent. Use firecrawl_scrape to fetch page content.
Summarize findings with clear citations (URL + short quote).
If scraping fails, explain the error and suggest another URL.
Do not invent page content.
For structured data (citations, comparisons, feature lists), prefer a short summary plus a markdown pipe table when it improves readability.`,
};

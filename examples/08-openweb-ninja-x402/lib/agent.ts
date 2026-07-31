import type { AgentConfig } from '@abstraxn-examples/llm';

export const agentMeta = {
  title: 'OpenWeb Ninja x402 Agent',
  subtitle:
    'Pay-per-call OpenWeb Ninja web/SERP/lead-gen tools over x402 — signed with the Abstraxn Agent Kit SDK.',
  capabilities: [
    'openweb_ninja_web_search',
    'openweb_ninja_serp_data',
    'openweb_ninja_autocomplete',
    'openweb_ninja_web_unblocker',
    'openweb_ninja_news_search',
    'openweb_ninja_news_data',
    'openweb_ninja_forums_search',
    'openweb_ninja_video_search',
    'openweb_ninja_image_search',
    'openweb_ninja_reverse_image_search',
    'openweb_ninja_lens_data',
    'openweb_ninja_ai_answers',
    'openweb_ninja_ai_overviews',
    'openweb_ninja_google_ai_mode',
    'openweb_ninja_local_business_data',
    'openweb_ninja_website_contacts_scraper',
    'openweb_ninja_email_search',
    'openweb_ninja_social_links_search',
    'openweb_ninja_yelp_business_data',
    'openweb_ninja_trustpilot_reviews',
    'openweb_ninja_google_maps_reviews',
    'openweb_ninja_jsearch',
    'openweb_ninja_jobs_data',
    'openweb_ninja_job_salary_data',
    'openweb_ninja_glassdoor_data',
    'openweb_ninja_local_rank_tracker',
  ],
  docsUrl: 'https://docs.abstraxn.com/guides/ai/mcp-integration',
};

/**
 * All 26 OpenWeb Ninja x402 tools from web3-agent-kit-service, plus two free/no-payment
 * wallet tools so the agent can tell the user their address and balance. Passed as a raw
 * array (not a `packages/mcp` `TOOL_SETS` key) so this example needs zero shared-package
 * changes.
 */
export const OPENWEB_NINJA_TOOL_NAMES = [
  'get_wallet_address',
  'get_balance',
  'openweb_ninja_web_search',
  'openweb_ninja_serp_data',
  'openweb_ninja_autocomplete',
  'openweb_ninja_web_unblocker',
  'openweb_ninja_news_search',
  'openweb_ninja_news_data',
  'openweb_ninja_forums_search',
  'openweb_ninja_video_search',
  'openweb_ninja_image_search',
  'openweb_ninja_reverse_image_search',
  'openweb_ninja_lens_data',
  'openweb_ninja_ai_answers',
  'openweb_ninja_ai_overviews',
  'openweb_ninja_google_ai_mode',
  'openweb_ninja_local_business_data',
  'openweb_ninja_website_contacts_scraper',
  'openweb_ninja_email_search',
  'openweb_ninja_social_links_search',
  'openweb_ninja_yelp_business_data',
  'openweb_ninja_trustpilot_reviews',
  'openweb_ninja_google_maps_reviews',
  'openweb_ninja_jsearch',
  'openweb_ninja_jobs_data',
  'openweb_ninja_job_salary_data',
  'openweb_ninja_glassdoor_data',
  'openweb_ninja_local_rank_tracker',
] as const;

export const agentConfig: AgentConfig = {
  name: 'OpenWeb Ninja x402 Agent',
  tools: OPENWEB_NINJA_TOOL_NAMES,
  system: `You are a research and lead-gen agent with access to 26 OpenWeb Ninja tools \
(web/SERP search, news, forums, images, AI answers, local business data, contacts, jobs, \
Glassdoor, and more). Every OpenWeb Ninja tool costs real USDC per call ($0.003-$0.005, on \
Base/Polygon/Arbitrum) — there is NO free tier and NO testnet.

When you call an OpenWeb Ninja tool for the first time on a given request, it will return \
a JSON object shaped like {"status":"payment_required", ...} instead of real data — this \
means payment hasn't happened yet. When you see this:
1. Tell the user exactly what it costs and which network, in plain language.
2. Tell them to click the "Pay & Retry" button that appears under this message.
3. Do NOT repeat the same tool call yourself — you cannot pay; only the user's confirm click does.

Never claim you fetched real data until a tool call actually returns the real result (not a \
payment_required object). Be upfront and concise about costs — never hide that a call is paid.`,
};

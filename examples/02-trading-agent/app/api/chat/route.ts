import { createAgentChat } from '@abstraxn-examples/llm';
import { agentConfig } from '@/lib/agent';
import { createMcpFromBootstrap, getOrCreateSession } from '@/lib/session';
import { createByokCoinbaseTools, loadCoinbaseByokConfig } from '@/lib/coinbase-byok-tool';
import type { UIMessage } from 'ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  // Every coinbase_* tool except coinbase_get_price is BYOK-only server-side — there is no
  // server-held CDP key to fall back to, so this backend must mint its own bearer tokens.
  const byok = loadCoinbaseByokConfig();
  if (!byok) {
    return new Response(
      JSON.stringify({
        error: 'COINBASE_BYOK_NOT_CONFIGURED',
        message:
          'Set COINBASE_BYOK_API_KEY_NAME and COINBASE_BYOK_API_KEY_SECRET in .env — every ' +
          'coinbase_* tool except coinbase_get_price requires a caller-minted bearer token ' +
          '(BYOK). See README.md.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const session = await getOrCreateSession({
    name: agentConfig.name,
    description: agentConfig.system.slice(0, 120),
  });
  const mcp = createMcpFromBootstrap(session);

  // Wrap every coinbase_* tool except coinbase_get_price so each call carries a bearer token
  // minted locally, right here, from a key that never leaves this backend (see
  // lib/coinbase-byok-tool.ts). coinbase_get_price stays on the normal MCP path since the
  // server-side tool now calls Coinbase's public ticker endpoint directly — no key needed.
  const extraTools = createByokCoinbaseTools({
    mcpBaseUrl: process.env.ABSTRAXN_AGENT_KIT_API_URL ?? 'https://agent-kit.abstraxn.com',
    mcpToken: session.mcpToken,
    byok,
  });

  const result = await createAgentChat({
    mcp,
    config: {
      ...agentConfig,
      system: `${agentConfig.system}\n\nAgent wallet: ${session.evmAddress ?? 'unknown'}\n\nAll trading tools use a bearer token minted locally for this session (BYOK) — there is no server-held Coinbase key.`,
    },
    messages,
    extraTools,
  });

  return result.toUIMessageStreamResponse();
}

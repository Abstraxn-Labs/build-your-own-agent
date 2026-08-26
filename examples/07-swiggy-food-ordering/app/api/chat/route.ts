import { createAgentChat } from '@abstraxn-examples/llm';
import { agentConfig } from '@/lib/agent';
import { createMcpFromBootstrap, getOrCreateSession } from '@/lib/session';
import { createSwiggyTools } from '@/lib/swiggy-tools';
import { getValidAccessToken } from '@/lib/swiggy-oauth';
import type { UIMessage } from 'ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };
  const session = await getOrCreateSession({
    name: agentConfig.name,
    description: agentConfig.system.slice(0, 120),
  });
  const mcp = createMcpFromBootstrap(session);
  const swiggyTools = await createSwiggyTools(mcp);
  const oauth = await getValidAccessToken();
  const authLine = oauth?.accessToken
    ? 'Host status: Swiggy is CONNECTED. Tokens are auto-injected — call swiggy_* tools now; do not ask the user to link Swiggy.'
    : 'Host status: Swiggy is NOT connected. Ask the user to click "Connect Swiggy Account" before ordering.';

  const result = await createAgentChat({
    mcp,
    config: {
      ...agentConfig,
      system: `${agentConfig.system}\n\n${authLine}\nAgent wallet: ${session.evmAddress ?? 'unknown'}`,
    },
    messages,
    extraTools: swiggyTools,
  });

  return result.toUIMessageStreamResponse();
}

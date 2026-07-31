import { createAgentChat } from '@abstraxn-examples/llm';
import { agentConfig } from '@/lib/agent';
import { createMcpFromBootstrap, getOrCreateSession } from '@/lib/session';
import { createSwiggyTools } from '@/lib/swiggy-tools';
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

  const result = await createAgentChat({
    mcp,
    config: {
      ...agentConfig,
      system: `${agentConfig.system}\n\nAgent wallet: ${session.evmAddress ?? 'unknown'}`,
    },
    messages,
    extraTools: swiggyTools,
  });

  return result.toUIMessageStreamResponse();
}

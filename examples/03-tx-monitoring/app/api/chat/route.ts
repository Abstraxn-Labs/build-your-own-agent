import { createAgentChat } from '@abstraxn-examples/llm';
import { agentConfig } from '@/lib/agent';
import { createMcpFromBootstrap, getOrCreateSession } from '@/lib/session';
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

  const result = await createAgentChat({
    mcp,
    config: {
      ...agentConfig,
      system: `${agentConfig.system}\n\nAgent wallet: ${session.evmAddress ?? 'unknown'}`,
    },
    messages,
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error('[tx-monitoring/api/chat]', error);
      return error instanceof Error ? error.message : 'An error occurred.';
    },
  });
}

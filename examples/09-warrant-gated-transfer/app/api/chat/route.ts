import { agentConfig } from '@/lib/agent';
import { createMcpFromBootstrap, getOrCreateSession } from '@/lib/session';
import { createWarrantGatedChat, loadWarrantEnv } from '@/lib/warrant-gate';
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

  const warrantEnv = loadWarrantEnv();
  /** Warrant agent_id must match the sealed mandate (WARRANT_AGENT_ID). */
  const warrantAgentId = warrantEnv.agentId ?? session.agent.id;

  const result = await createWarrantGatedChat({
    mcp,
    config: {
      ...agentConfig,
      system: `${agentConfig.system}

Agent Kit wallet: ${session.evmAddress ?? 'unknown'}
Agent Kit agent id: ${session.agent.id}
Warrant mandate agent_id: ${warrantAgentId}
Demo allowlist: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (max $100 USD).`,
    },
    messages,
    agentId: warrantAgentId,
  });

  return result.toUIMessageStreamResponse();
}

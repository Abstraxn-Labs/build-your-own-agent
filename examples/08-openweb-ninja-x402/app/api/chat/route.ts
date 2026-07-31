import { buildSystemPrompt, createLanguageModel } from '@abstraxn-examples/llm';
import { loadLlmEnv } from '@abstraxn-examples/utils';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { agentConfig, OPENWEB_NINJA_TOOL_NAMES } from '@/lib/agent';
import { createMcpFromBootstrap, getOrCreateSession } from '@/lib/session';
import { paidMcpToolsToAiSdk } from '@/lib/paid-tools';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };
  const session = await getOrCreateSession({
    name: agentConfig.name,
    description: agentConfig.system.slice(0, 120),
  });
  const mcp = createMcpFromBootstrap(session);

  // Deliberately does NOT use @abstraxn-examples/llm's createAgentChat: that helper calls
  // packages/mcp's mcpToolsToAiSdk(mcp, toolNames), whose listAllowedTools() treats an
  // EMPTY allowlist as "no filter" and returns every MCP tool unfiltered — not what we
  // want here, and not something to patch since packages/* stays untouched for this
  // example. Composing streamText directly keeps the tool list to exactly
  // OPENWEB_NINJA_TOOL_NAMES (via the payment-aware paidMcpToolsToAiSdk wrapper).
  const tools = await paidMcpToolsToAiSdk(mcp, OPENWEB_NINJA_TOOL_NAMES);

  const model = createLanguageModel(loadLlmEnv());
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model,
    system: buildSystemPrompt(agentConfig, { evmAddress: session.evmAddress ?? undefined }),
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}

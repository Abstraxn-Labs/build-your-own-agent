import type { McpClient } from '@abstraxn/agent-kit';
import {
  mcpToolsToAiSdk,
  resolveToolNames,
  type ToolSetName,
} from '@abstraxn-examples/mcp';
import type { LlmEnv } from '@abstraxn-examples/utils';
import { loadLlmEnv } from '@abstraxn-examples/utils';
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type ToolSet,
  type UIMessage,
} from 'ai';
import { createLanguageModel } from './providers.js';

export interface AgentConfig {
  name: string;
  system: string;
  /** Named tool set or explicit MCP tool names. */
  tools: ToolSetName | readonly string[];
  /** Override LLM_MODEL for this agent only */
  model?: string;
}

export interface CreateAgentChatOptions {
  mcp: McpClient;
  config: AgentConfig;
  messages: UIMessage[];
  /** Extra tools merged after MCP tools (e.g. local helpers). */
  extraTools?: ToolSet;
  /** Optional LLM config (defaults to env) */
  llm?: LlmEnv;
}

/**
 * Build a system prompt with a consistent Abstraxn series framing.
 */
export function buildSystemPrompt(
  config: Pick<AgentConfig, 'name' | 'system'>,
  extras?: { evmAddress?: string; capabilities?: string[] },
): string {
  const lines = [
    `You are ${config.name}, an AI agent built with Abstraxn Agent Kit.`,
    'You use Abstraxn MCP tools to take real actions. Prefer tools over guessing.',
    'Be concise. When a tool fails, explain the error and suggest a next step.',
    '',
    config.system,
  ];

  if (extras?.evmAddress) {
    lines.push('', `Agent wallet (EVM): ${extras.evmAddress}`);
  }
  if (extras?.capabilities?.length) {
    lines.push('', `Capabilities: ${extras.capabilities.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Stream a chat turn with MCP tools wired into the Vercel AI SDK.
 */
export async function createAgentChat(options: CreateAgentChatOptions) {
  const toolNames = resolveToolNames(options.config.tools);
  const mcpTools = await mcpToolsToAiSdk(options.mcp, toolNames);
  const tools = { ...mcpTools, ...options.extraTools };

  const baseLlm = options.llm ?? loadLlmEnv();
  const model = createLanguageModel(
    options.config.model
      ? { ...baseLlm, LLM_MODEL: options.config.model }
      : baseLlm,
  );

  const modelMessages = await convertToModelMessages(options.messages);

  return streamText({
    model,
    system: buildSystemPrompt(options.config),
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(8),
  });
}

export { createLanguageModel } from './providers.js';

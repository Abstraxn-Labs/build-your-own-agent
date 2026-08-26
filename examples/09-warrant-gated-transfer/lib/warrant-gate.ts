import type { McpClient } from '@abstraxn/agent-kit';
import { Warrant } from '@abstraxn/warrant';
import {
  mcpToolsToAiSdk,
  resolveToolNames,
} from '@abstraxn-examples/mcp';
import {
  buildSystemPrompt,
  createLanguageModel,
  type AgentConfig,
} from '@abstraxn-examples/llm';
import { loadLlmEnv } from '@abstraxn-examples/utils';
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type Tool,
  type UIMessage,
} from 'ai';

export function loadWarrantEnv(
  source: Record<string, string | undefined> = process.env,
): { apiUrl: string; apiKey: string; agentId?: string } {
  const apiUrl = (
    source.WARRANT_URL ?? 'https://dev-warrant-api.abstraxn.com'
  ).replace(/\/$/, '');
  const apiKey = source.WARRANT_MANDATE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'WARRANT_MANDATE_API_KEY is required. Seal a web3 mandate (application API key), copy the one-time mandate apiKey, and set it in .env.',
    );
  }
  const agentId =
    source.WARRANT_AGENT_ID?.trim() || source.AGENT_ID?.trim() || undefined;
  return { apiUrl, apiKey, agentId };
}

function parseAmount(args: Record<string, unknown>): number {
  const raw = args.amount;
  const n =
    typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Wrap MCP `transfer` so Warrant.check() runs first. DENY/ESCALATE never call MCP.
 */
export function wrapTransferWithWarrant(
  tools: Record<string, Tool>,
  opts: { warrant: Warrant; agentId: string },
): Record<string, Tool> {
  const transfer = tools.transfer;
  if (!transfer || typeof transfer.execute !== 'function') {
    console.warn(
      '[warrant] transfer tool missing — Warrant gate NOT active. Tools:',
      Object.keys(tools),
    );
    return tools;
  }
  console.log(`[warrant] gate armed for agent_id=${opts.agentId}`);

  const originalExecute = transfer.execute.bind(transfer);

  return {
    ...tools,
    transfer: {
      ...transfer,
      execute: async (args, options) => {
        const input = (args ?? {}) as Record<string, unknown>;
        const to = String(input.to ?? '');
        const amount = parseAmount(input);
        console.log(
          `[warrant] check start agent=${opts.agentId} amount=${amount} to=${to}`,
        );
        // Demo mandates use USD limits; treat transfer amount as USD for Warrant.
        const decision = await opts.warrant.check({
          agent_id: opts.agentId,
          domain: 'web3',
          action_type: 'transfer',
          value: { amount, currency: 'USD' },
          counterparty: to ? { id: to, type: 'address' } : null,
        });
        console.log(
          `[warrant] check done verdict=${decision.verdict} receipt=${decision.receipt_id} decision=${decision.decision_id}`,
        );

        if (decision.verdict !== 'ALLOW') {
          return JSON.stringify(
            {
              blocked_by: 'kyi_warrant',
              verdict: decision.verdict,
              reasons: decision.reasons,
              receipt_id: decision.receipt_id,
              decision_id: decision.decision_id,
              matched_mandate_ids: decision.matched_mandate_ids,
              receipt_generated: true,
              note:
                'DENY/ESCALATE still produce a signed Warrant receipt. Always quote receipt_id from this JSON only. Never invent receipt ids.',
              hint: 'Transfer aborted before Agent Kit MCP transfer. Use an allowlisted recipient or a lower amount that matches the sealed mandate.',
            },
            null,
            2,
          );
        }

        const result = await originalExecute(args, options);
        const suffix = `\n\n[Warrant ALLOW receipt_id=${decision.receipt_id} decision_id=${decision.decision_id}]`;
        return typeof result === 'string' ? `${result}${suffix}` : result;
      },
    } as Tool,
  };
}

/**
 * Same shape as createAgentChat, with Warrant gating on transfer.
 */
export async function createWarrantGatedChat(options: {
  mcp: McpClient;
  config: AgentConfig;
  messages: UIMessage[];
  /**
   * Fallback agent id for Warrant.check(). Prefer WARRANT_AGENT_ID in .env
   * (must match the sealed mandate — e.g. agent_web3_demo).
   */
  agentId: string;
}) {
  const { apiUrl, apiKey, agentId: envAgentId } = loadWarrantEnv();
  const warrantAgentId = envAgentId || options.agentId;
  const warrant = new Warrant({ apiUrl, apiKey, onError: 'deny' });

  const toolNames = resolveToolNames(options.config.tools);
  let tools = await mcpToolsToAiSdk(options.mcp, toolNames);
  tools = wrapTransferWithWarrant(tools, {
    warrant,
    agentId: warrantAgentId,
  });

  const baseLlm = loadLlmEnv();
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

import { AgentKitError, type McpClient, type McpToolDescriptor } from '@abstraxn/agent-kit';
import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { signX402Payment, type X402SigningSession } from '@abstraxn-examples/wallet';
import { logInfo, logWarn } from '@abstraxn-examples/utils';

export type { X402SigningSession };

/** Core wallet / read tools shared across most examples. */
export const CORE_EVM_WALLET_TOOLS = [
  'get_balance',
  'get_wallet_address',
  'get_gas_info',
  'get_token_info',
  'get_transaction_status',
  'token_chart',
] as const;

export const TOOL_SETS = {
  helloWallet: ['get_balance', 'get_wallet_address', 'get_gas_info'] as const,
  firecrawl: ['firecrawl_scrape', 'get_wallet_address'] as const,
  trading: [
    'uniswap_swap_quote',
    'evm_swap_quote',
    'get_balance',
    'get_wallet_address',
    'get_token_info',
    'get_token_price',
    'get_transaction_status',
    'token_chart',
  ] as const,
  coinbaseTrading: [
    'coinbase_get_price',
    'coinbase_get_balance',
    'coinbase_get_key_permissions',
    'coinbase_preview_order',
    'coinbase_place_order',
    'coinbase_get_order_status',
    'coinbase_cancel_order',
    'coinbase_list_recent_orders',
    'get_wallet_address',
  ] as const,
  txMonitoring: [
    'get_transaction_status',
    'get_balance',
    'get_wallet_address',
    'get_gas_info',
    'get_token_info',
    'data_and_analytics',
    'token_chart',
  ] as const,
  fraudPolicy: [
    'get_balance',
    'get_wallet_address',
    'get_transaction_status',
    'get_gas_info',
    'transfer',
    'data_and_analytics',
  ] as const,
  cmcMarketData: [
    'cmc_search_cryptos',
    'cmc_get_crypto_quotes',
    'cmc_get_crypto_info',
    'cmc_get_crypto_news',
    'cmc_get_technical_analysis',
    'cmc_get_holder_metrics',
    'cmc_search_crypto_info',
    'cmc_get_trending_narratives',
    'cmc_get_derivatives_metrics',
    'cmc_get_global_metrics',
    'cmc_get_macro_events',
    'cmc_get_marketcap_technical_analysis',
    'get_wallet_address',
  ] as const,
} as const;

export type ToolSetName = keyof typeof TOOL_SETS;

function jsonSchemaToZod(
  schema: Record<string, unknown> | undefined,
): z.ZodTypeAny {
  if (!schema || schema.type !== 'object') {
    return z.record(z.string(), z.unknown()).default({});
  }

  const properties = (schema.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const required = new Set((schema.required as string[] | undefined) ?? []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let field: z.ZodTypeAny;
    switch (prop.type) {
      case 'string':
        field = z.string();
        break;
      case 'number':
      case 'integer':
        field = z.number();
        break;
      case 'boolean':
        field = z.boolean();
        break;
      case 'array':
        field = z.array(z.unknown());
        break;
      default:
        field = z.unknown();
    }
    if (typeof prop.description === 'string') {
      field = field.describe(prop.description);
    }
    shape[key] = required.has(key) ? field : field.optional();
  }

  return z.object(shape).passthrough();
}

function extractText(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return String(result);
  }
  const r = result as {
    content?: Array<{ type?: string; text?: string }>;
    isError?: boolean;
  };
  if (Array.isArray(r.content)) {
    return r.content
      .map((c) => c.text ?? JSON.stringify(c))
      .join('\n');
  }
  return JSON.stringify(result, null, 2);
}

/**
 * List MCP tools and optionally filter by allowlist.
 */
export async function listAllowedTools(
  mcp: McpClient,
  allowedTools?: readonly string[],
): Promise<McpToolDescriptor[]> {
  const tools = await mcp.listTools();
  if (!allowedTools || allowedTools.length === 0) return tools;
  const allow = new Set(allowedTools);
  return tools.filter((t) => allow.has(t.name));
}

/**
 * Calls an MCP tool, catching a `-32402` payment-required response and completing it
 * automatically: sign the challenge with `session`'s own cached `accessKey` (via
 * `signX402Payment`), then retry once with the signed `paymentPayload`. Calls
 * `mcp.rpc()` directly rather than `mcp.callTool()` — `callTool()` discards
 * `error.data`, which is exactly where the payment challenge lives.
 */
export async function callToolWithAutoPay(
  mcp: McpClient,
  name: string,
  args: Record<string, unknown>,
  session: X402SigningSession,
): Promise<unknown> {
  const first = await mcp.rpc(
    'tools/call',
    { name, arguments: args },
    { executionContext: 'delegated' },
  );
  if (!first.error) {
    return first.result;
  }
  if (first.error.code !== -32402) {
    logWarn(`x402: "${name}" failed with a non-payment error`, {
      code: first.error.code,
      message: first.error.message,
    });
    throw new AgentKitError(first.error.message, String(first.error.code));
  }

  const data = (first.error.data ?? {}) as {
    paymentRequirements?: Parameters<typeof signX402Payment>[1];
    invoiceId?: string;
    x402PaymentUrl?: string;
  };
  logInfo(`x402: "${name}" requires payment`, {
    accepts: data.paymentRequirements?.accepts,
    invoiceId: data.invoiceId,
    x402PaymentUrl: data.x402PaymentUrl,
  });
  if (!data.paymentRequirements) {
    throw new AgentKitError(
      'Payment required but no paymentRequirements were present on the MCP error.',
      'X402_CHALLENGE_MISSING',
    );
  }

  const paymentPayload = await signX402Payment(session, data.paymentRequirements);
  logInfo(`x402: signed payment for "${name}"`, {
    x402Version: paymentPayload.x402Version,
    accepted: paymentPayload.accepted,
  });

  const retry = await mcp.rpc(
    'tools/call',
    { name, arguments: args, paymentPayload },
    { executionContext: 'delegated' },
  );
  if (retry.error) {
    logWarn(`x402: signed retry for "${name}" was still rejected`, {
      code: retry.error.code,
      message: retry.error.message,
      data: retry.error.data,
    });
    throw new AgentKitError(
      `Payment was signed and submitted, but "${name}" still failed: ${retry.error.message}`,
      String(retry.error.code),
    );
  }
  logInfo(`x402: "${name}" paid and completed`, { result: retry.result });
  return retry.result;
}

/**
 * Map Abstraxn MCP tools into Vercel AI SDK `tool()` definitions. When `session` is
 * provided, tool calls that come back payment-required are automatically signed and
 * retried via `callToolWithAutoPay`; without it, tools are called exactly as before.
 */
export async function mcpToolsToAiSdk(
  mcp: McpClient,
  allowedTools?: readonly string[],
  session?: X402SigningSession,
): Promise<Record<string, Tool>> {
  const descriptors = await listAllowedTools(mcp, allowedTools);
  const mapped: Record<string, Tool> = {};

  for (const desc of descriptors) {
    const parameters = jsonSchemaToZod(
      desc.inputSchema as Record<string, unknown> | undefined,
    );

    mapped[desc.name] = tool({
      description: desc.description || `MCP tool: ${desc.name}`,
      inputSchema: parameters,
      execute: async (args) => {
        const result = session
          ? await callToolWithAutoPay(
              mcp,
              desc.name,
              (args ?? {}) as Record<string, unknown>,
              session,
            )
          : await mcp.callTool(desc.name, (args ?? {}) as Record<string, unknown>);
        return extractText(result);
      },
    });
  }

  return mapped;
}

/**
 * Resolve a named tool set (or custom list) to string names.
 */
export function resolveToolNames(
  setOrNames: ToolSetName | readonly string[],
): readonly string[] {
  if (typeof setOrNames === 'string') {
    return TOOL_SETS[setOrNames];
  }
  return setOrNames;
}

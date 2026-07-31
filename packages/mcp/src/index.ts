import type { McpClient, McpToolDescriptor } from '@abstraxn/agent-kit';
import { tool, type Tool } from 'ai';
import { z } from 'zod';

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
  txMonitoring: [
    'get_transaction_status',
    'tenderly_simulate_transaction',
    'tenderly_explain_transaction',
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
  swiggyFoodOrdering: [
    'swiggy_get_addresses',
    'swiggy_search_restaurants',
    'swiggy_get_menu',
    'swiggy_search_menu',
    'swiggy_manage_cart',
    'swiggy_get_payment_options',
    'swiggy_place_order',
    'swiggy_check_payment_status',
    'swiggy_get_order_status',
    'swiggy_get_order_history',
    'swiggy_get_order_details',
    'swiggy_fetch_coupons',
    'swiggy_apply_coupon',
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
 * Map Abstraxn MCP tools into Vercel AI SDK `tool()` definitions.
 */
export async function mcpToolsToAiSdk(
  mcp: McpClient,
  allowedTools?: readonly string[],
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
        const result = await mcp.callTool(
          desc.name,
          (args ?? {}) as Record<string, unknown>,
        );
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

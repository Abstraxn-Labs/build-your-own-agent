import { tool } from 'ai';
import { z } from 'zod';
import type { Tool } from 'ai';
import { mintCoinbaseBearerToken } from '@abstraxn-examples/wallet';

const MCP_PATH = '/mcp';

export interface CoinbaseByokConfig {
  keyName: string;
  keySecret: string;
}

/** Reads the BYOK credentials this example needs from its own env — required, not optional. */
export function loadCoinbaseByokConfig(): CoinbaseByokConfig | null {
  const keyName = process.env.COINBASE_BYOK_API_KEY_NAME?.trim();
  const keySecret = process.env.COINBASE_BYOK_API_KEY_SECRET?.trim();
  return keyName && keySecret ? { keyName, keySecret } : null;
}

interface McpJsonRpcResult {
  result?: { content?: Array<{ type: string; text: string }> };
  error?: { code: number; message: string };
}

interface CoinbaseEndpoint {
  method: 'GET' | 'POST';
  path: string;
}

interface CoinbaseByokToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  /** Must resolve to the exact method + path the server-side MCP tool will call — the bearer
   * token's `uri` claim is scoped to it, so a mismatch here causes Coinbase to reject the call. */
  endpoint: (args: Record<string, unknown>) => CoinbaseEndpoint;
}

/**
 * BYOK: builds one MCP tool that bypasses the shared MCP client entirely for this call, so
 * it can attach an X-Coinbase-Bearer-Token header (agent-kit's McpClient only supports a
 * fixed header set — no generic passthrough). The real CDP key lives only in this backend's
 * own env (COINBASE_BYOK_API_KEY_*), standing in for "the user's own backend holds the key" —
 * never sent to Abstraxn, which only ever sees a ~120s, method+path-scoped bearer token.
 */
export function createByokCoinbaseTool(options: {
  mcpBaseUrl: string;
  mcpToken: string;
  byok: CoinbaseByokConfig;
  def: CoinbaseByokToolDef;
}): Tool {
  return tool({
    description: options.def.description,
    inputSchema: options.def.inputSchema,
    execute: async (args) => {
      const typedArgs = args as Record<string, unknown>;
      const { method, path } = options.def.endpoint(typedArgs);
      const bearerToken = mintCoinbaseBearerToken({
        keyName: options.byok.keyName,
        keySecret: options.byok.keySecret,
        method,
        path,
      });

      const response = await fetch(`${options.mcpBaseUrl}${MCP_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: options.mcpToken,
          'X-Coinbase-Bearer-Token': bearerToken,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: options.def.name, arguments: typedArgs },
        }),
      });

      const payload = (await response.json()) as McpJsonRpcResult;
      if (payload.error) {
        return { error: payload.error.code, message: payload.error.message };
      }

      const text = payload.result?.content?.[0]?.text;
      return text ? (JSON.parse(text) as unknown) : payload.result;
    },
  });
}

const SIDE_SCHEMA = z.enum(['BUY', 'SELL']);

/**
 * Every coinbase_* tool except coinbase_get_price, mirroring the method+path each one calls
 * server-side (see web3-agent-kit-service/src/mcp/tools/coinbase/coinbase-*.tool.ts) so the
 * bearer token minted for it is scoped correctly.
 */
export const COINBASE_BYOK_TOOL_DEFS: CoinbaseByokToolDef[] = [
  {
    name: 'coinbase_get_balance',
    description: 'Lists Coinbase Advanced Trade account balances for the caller.',
    inputSchema: z.object({
      limit: z.number().optional().describe('Maximum number of accounts to return.'),
    }),
    endpoint: () => ({ method: 'GET', path: '/api/v3/brokerage/accounts' }),
  },
  {
    name: 'coinbase_place_order',
    description:
      'Places a Coinbase Advanced Trade market order using a bearer token minted locally ' +
      "from this backend's own CDP key (BYOK) — the key itself is never sent to Abstraxn.",
    inputSchema: z.object({
      product_id: z.string().describe('Coinbase product id (e.g. "BTC-USD").'),
      side: SIDE_SCHEMA,
      quote_size: z.string().describe('Order size in quote currency, as a decimal string.'),
    }),
    endpoint: () => ({ method: 'POST', path: '/api/v3/brokerage/orders' }),
  },
  {
    name: 'coinbase_get_order_status',
    description: 'Gets the status of a single Coinbase Advanced Trade order by order_id.',
    inputSchema: z.object({
      order_id: z.string().describe('Coinbase order id.'),
    }),
    endpoint: (args) => ({
      method: 'GET',
      path: `/api/v3/brokerage/orders/historical/${String(args.order_id)}`,
    }),
  },
  {
    name: 'coinbase_cancel_order',
    description: 'Cancels one or more open Coinbase Advanced Trade orders (batch cancel).',
    inputSchema: z.object({
      order_ids: z.array(z.string()).describe('Coinbase order ids to cancel.'),
    }),
    endpoint: () => ({ method: 'POST', path: '/api/v3/brokerage/orders/batch_cancel' }),
  },
  {
    name: 'coinbase_list_recent_orders',
    description: 'Lists recent Coinbase Advanced Trade orders, optionally filtered by product.',
    inputSchema: z.object({
      product_id: z.string().optional().describe('Coinbase product id to filter by.'),
      limit: z.number().optional().describe('Maximum number of orders to return.'),
    }),
    endpoint: () => ({ method: 'GET', path: '/api/v3/brokerage/orders/historical/batch' }),
  },
  {
    name: 'coinbase_get_key_permissions',
    description:
      "Checks what the caller's Coinbase key is actually allowed to do — view, trade, transfer.",
    inputSchema: z.object({}),
    endpoint: () => ({ method: 'GET', path: '/api/v3/brokerage/key_permissions' }),
  },
  {
    name: 'coinbase_preview_order',
    description:
      'Previews a Coinbase Advanced Trade market order without placing it — estimated total, ' +
      'commission, and slippage from Coinbase itself.',
    inputSchema: z.object({
      product_id: z.string().describe('Coinbase product id (e.g. "BTC-USD").'),
      side: SIDE_SCHEMA,
      quote_size: z.string().describe('Order size in quote currency, as a decimal string.'),
    }),
    endpoint: () => ({ method: 'POST', path: '/api/v3/brokerage/orders/preview' }),
  },
];

/** Builds all seven BYOK-wrapped coinbase_* tools, keyed by tool name, for `extraTools`. */
export function createByokCoinbaseTools(options: {
  mcpBaseUrl: string;
  mcpToken: string;
  byok: CoinbaseByokConfig;
}): Record<string, Tool> {
  return Object.fromEntries(
    COINBASE_BYOK_TOOL_DEFS.map((def) => [
      def.name,
      createByokCoinbaseTool({ ...options, def }),
    ]),
  );
}

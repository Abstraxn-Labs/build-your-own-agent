import type { McpClient, McpToolDescriptor } from '@abstraxn/agent-kit';
import type { PaymentRequired } from '@x402/core/types';
import { tool, type Tool } from 'ai';
import { z } from 'zod';

/**
 * Example-local replacement for `@abstraxn-examples/mcp`'s `mcpToolsToAiSdk`, used only
 * here. `McpClient.callTool()` throws on any JSON-RPC error and drops `response.error.data`
 * — exactly where the x402 402 challenge (`data.paymentRequirements`) lives — so paid tools
 * must call the lower-level `mcp.rpc('tools/call', ...)` directly instead.
 */

export interface PaymentRequiredToolResult {
  status: 'payment_required';
  toolName: string;
  args: Record<string, unknown>;
  paymentRequired: PaymentRequired;
}

function jsonSchemaToZod(schema: Record<string, unknown> | undefined): z.ZodTypeAny {
  if (!schema || schema.type !== 'object') {
    return z.record(z.string(), z.unknown()).default({});
  }

  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
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

async function listAllowedTools(
  mcp: McpClient,
  allowedTools: readonly string[],
): Promise<McpToolDescriptor[]> {
  const tools = await mcp.listTools();
  const allow = new Set(allowedTools);
  return tools.filter((t) => allow.has(t.name));
}

/**
 * Calls `name` via the raw `rpc()` endpoint and normalizes the response into either a
 * plain success string (same shape `extractText` in packages/mcp produces) or a
 * `PaymentRequiredToolResult` when the server responds -32402.
 */
export async function callPaidTool(
  mcp: McpClient,
  name: string,
  args: Record<string, unknown>,
): Promise<string | PaymentRequiredToolResult> {
  const response = await mcp.rpc('tools/call', { name, arguments: args });

  if (response.error) {
    if (response.error.code === -32402) {
      const data = response.error.data as { paymentRequirements?: PaymentRequired } | undefined;
      if (data?.paymentRequirements) {
        return {
          status: 'payment_required',
          toolName: name,
          args,
          paymentRequired: data.paymentRequirements,
        };
      }
    }
    return JSON.stringify({
      status: 'error',
      code: response.error.code,
      message: response.error.message,
    });
  }

  const result = response.result as { content?: Array<{ type?: string; text?: string }> } | undefined;
  if (result?.content) {
    return result.content.map((c) => c.text ?? JSON.stringify(c)).join('\n');
  }
  return JSON.stringify(result ?? { status: 'ok' });
}

/**
 * Retries a tool call with a signed `paymentPayload` attached — used by `/api/pay` after
 * the user confirms. Also goes through `rpc()` directly (not `callTool()`) so a settlement
 * failure's `error.data` isn't silently dropped either.
 */
export async function retryPaidTool(
  mcp: McpClient,
  name: string,
  args: Record<string, unknown>,
  paymentPayload: unknown,
): Promise<{ ok: true; result: unknown } | { ok: false; error: { code?: number; message: string } }> {
  const response = await mcp.rpc('tools/call', { name, arguments: args, paymentPayload });
  if (response.error) {
    console.error('[retryPaidTool] full JSON-RPC error response:\n' + JSON.stringify(response.error, null, 2));
    return { ok: false, error: { code: response.error.code, message: response.error.message } };
  }
  return { ok: true, result: response.result };
}

/**
 * Maps allowed MCP tools into Vercel AI SDK `tool()` definitions whose `execute()` never
 * signs or pays — it only probes and, on a 402, returns a `PaymentRequiredToolResult` (as
 * JSON text) for the UI to render as a "Pay & Retry" card. Actual payment happens only via
 * a user-initiated call to `/api/pay` (see `app/api/pay/route.ts`), never automatically.
 */
export async function paidMcpToolsToAiSdk(
  mcp: McpClient,
  allowedTools: readonly string[],
): Promise<Record<string, Tool>> {
  const descriptors = await listAllowedTools(mcp, allowedTools);
  const mapped: Record<string, Tool> = {};

  for (const desc of descriptors) {
    const parameters = jsonSchemaToZod(desc.inputSchema);

    mapped[desc.name] = tool({
      description: desc.description || `MCP tool: ${desc.name}`,
      inputSchema: parameters,
      execute: async (args) => {
        const outcome = await callPaidTool(mcp, desc.name, (args ?? {}) as Record<string, unknown>);
        return typeof outcome === 'string' ? outcome : JSON.stringify(outcome);
      },
    });
  }

  return mapped;
}

import type { McpClient } from '@abstraxn/agent-kit';
import { mcpToolsToAiSdk, resolveToolNames } from '@abstraxn-examples/mcp';
import type { Tool, ToolSet } from 'ai';
import { getValidAccessToken } from './swiggy-oauth';

export interface SwiggyTokens {
  accessToken?: string;
  refreshToken?: string;
}

function loadSwiggyTokensFromEnv(): SwiggyTokens {
  return {
    accessToken: process.env.SWIGGY_ACCESS_TOKEN,
    refreshToken: process.env.SWIGGY_REFRESH_TOKEN,
  };
}

/**
 * Prefers a real account connected via the in-app "Connect Swiggy Account"
 * OAuth flow (lib/swiggy-oauth.ts) — refreshed proactively before expiry.
 * Falls back to manually-configured env vars for users who already have a
 * token pair from elsewhere (e.g. Claude.ai's own Swiggy connector).
 */
async function resolveSwiggyTokens(): Promise<SwiggyTokens> {
  const oauthRecord = await getValidAccessToken();
  if (oauthRecord) {
    return {
      accessToken: oauthRecord.accessToken,
      refreshToken: oauthRecord.refreshToken,
    };
  }
  return loadSwiggyTokensFromEnv();
}

/**
 * Swiggy's MCP tools require the user's own Swiggy OAuth access_token per
 * call — the LLM (and the chat user) should never be asked to paste that
 * into the conversation. This wraps the swiggy_* tools so the token is
 * injected server-side, then returns them keyed by the same tool names so
 * passing this as `extraTools` to createAgentChat shadows the unwrapped
 * versions it resolves internally from `agentConfig.tools`.
 */
export async function createSwiggyTools(
  mcp: McpClient,
  tokens?: SwiggyTokens,
): Promise<ToolSet> {
  const resolvedTokens = tokens ?? (await resolveSwiggyTokens());
  const swiggyToolNames = resolveToolNames('swiggyFoodOrdering');
  const tools = await mcpToolsToAiSdk(mcp, swiggyToolNames);

  if (!resolvedTokens.accessToken) {
    // No Swiggy account connected yet — leave the tools as-is; calling them
    // will surface SWIGGY_TOKEN_MISSING from web3-agent-kit-service.
    return tools;
  }

  const wrapped: ToolSet = {};
  for (const [name, toolDef] of Object.entries(tools)) {
    const original = toolDef as Tool & {
      execute?: (args: Record<string, unknown>) => Promise<unknown>;
    };
    wrapped[name] = {
      ...original,
      execute: async (args: Record<string, unknown>) =>
        original.execute?.({
          ...args,
          access_token: resolvedTokens.accessToken,
          refresh_token: resolvedTokens.refreshToken,
        }),
    } as Tool;
  }
  return wrapped;
}

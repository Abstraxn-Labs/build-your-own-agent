import {
  AgentKitClient,
  type AgentResponse,
  type CreateAgentWithWalletResponse,
  type McpClient,
} from '@abstraxn/agent-kit';
import { loadAbstraxnEnv, logInfo, type AbstraxnEnv } from '@abstraxn-examples/utils';

export type { AgentKitClient, AgentResponse, McpClient };

export type { AbstraxnEnv };
/** @deprecated Use AbstraxnEnv */
export type ExampleEnv = AbstraxnEnv;

export interface BootstrappedAgent {
  client: AgentKitClient;
  agent: AgentResponse;
  mcpToken: string;
  evmAddress?: string;
  accessKey?: string;
  organizationId?: string;
  env: AbstraxnEnv;
}

export interface BootstrapOptions {
  name: string;
  description: string;
  /** When true, create a new agent if ABSTRAXN_AGENT_ID is unset. */
  createIfMissing?: boolean;
  env?: AbstraxnEnv;
}

/**
 * Create an AgentKitClient from env.
 */
export function createAgentKitClient(env?: AbstraxnEnv): AgentKitClient {
  const resolved = env ?? loadAbstraxnEnv();
  return new AgentKitClient({
    apiKey: resolved.ABSTRAXN_API_KEY,
    baseUrl: resolved.ABSTRAXN_AGENT_KIT_API_URL,
  });
}

/**
 * Bootstrap an agent session for examples.
 *
 * Prefer reusing `ABSTRAXN_AGENT_ID` + `ABSTRAXN_MCP_TOKEN` when set.
 * Otherwise creates a server-wallet agent and binds it for an MCP token.
 */
export async function bootstrapAgent(
  options: BootstrapOptions,
): Promise<BootstrappedAgent> {
  const env = options.env ?? loadAbstraxnEnv();
  const client = createAgentKitClient(env);

  if (env.ABSTRAXN_AGENT_ID && env.ABSTRAXN_MCP_TOKEN) {
    const agent = await client.getAgent(env.ABSTRAXN_AGENT_ID);
    logInfo('Reusing existing agent', { agentId: agent.id });
    return {
      client,
      agent,
      mcpToken: env.ABSTRAXN_MCP_TOKEN,
      evmAddress: env.ABSTRAXN_EVM_ADDRESS ?? agent.evmAddress ?? undefined,
      accessKey: env.ABSTRAXN_ACCESS_KEY,
      organizationId: env.ABSTRAXN_ORGANIZATION_ID,
      env,
    };
  }

  if (options.createIfMissing === false) {
    throw new Error(
      'ABSTRAXN_AGENT_ID and ABSTRAXN_MCP_TOKEN are required when createIfMissing is false',
    );
  }

  logInfo('Creating agent with server wallet', { name: options.name });
  const created: CreateAgentWithWalletResponse = await client.createAgent({
    name: options.name,
    description: options.description,
    userIdentity: env.ABSTRAXN_USER_IDENTITY,
    userEmail: env.ABSTRAXN_USER_IDENTITY.includes('@')
      ? env.ABSTRAXN_USER_IDENTITY
      : undefined,
    metadata: { series: 'build-your-agent-with-abstraxn' },
  });

  const bindInput = {
    userIdentity: env.ABSTRAXN_USER_IDENTITY,
    name: options.name,
    description: options.description,
    evmAddress: created.wallet.evmAddress || undefined,
    solanaAddress: created.wallet.solanaAddress || undefined,
  };

  const bound = await client.bindAgent(bindInput);
  const mcpToken = bound.mcpToken ?? created.agent.mcpToken ?? created.agent.apiKey;

  if (!mcpToken) {
    throw new Error(
      'No mcpToken returned from bindAgent — check Agent Kit credentials',
    );
  }

  logInfo('Agent ready', {
    agentId: bound.id,
    evmAddress: created.wallet.evmAddress,
  });

  return {
    client,
    agent: bound,
    mcpToken,
    evmAddress: created.wallet.evmAddress || undefined,
    accessKey: created.wallet.accessKey,
    organizationId: created.wallet.organizationId,
    env,
  };
}

/**
 * Create an MCP client from a bootstrapped session.
 */
export function createMcpFromBootstrap(session: BootstrappedAgent): McpClient {
  return session.client.createMcpClient(session.mcpToken);
}

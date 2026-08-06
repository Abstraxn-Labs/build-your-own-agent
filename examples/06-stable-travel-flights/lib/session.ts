import fs from 'node:fs';
import path from 'node:path';
import {
  bootstrapAgent,
  createAgentKitClient,
  createMcpFromBootstrap,
  type BootstrappedAgent,
} from '@abstraxn-examples/core';
import { loadAbstraxnEnv } from '@abstraxn-examples/utils';

declare global {
  // eslint-disable-next-line no-var
  var __abstraxnAgentSession: BootstrappedAgent | undefined;
}

/** Local-storage persistence for the bootstrapped agent (accessKey included) so it
 * survives dev-server restarts instead of creating a brand-new agent every time. */
const SESSION_FILE = path.join(process.cwd(), '.abstraxn-agent-session.json');

interface PersistedSession {
  agentId: string;
  mcpToken: string;
  evmAddress?: string;
  accessKey?: string;
  organizationId?: string;
}

function loadPersistedSession(): PersistedSession | null {
  try {
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) as PersistedSession;
  } catch {
    return null;
  }
}

function savePersistedSession(session: BootstrappedAgent): void {
  const persisted: PersistedSession = {
    agentId: session.agent.id,
    mcpToken: session.mcpToken,
    evmAddress: session.evmAddress,
    accessKey: session.accessKey,
    organizationId: session.organizationId,
  };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(persisted, null, 2));
}

export async function getOrCreateSession(options: {
  name: string;
  description: string;
}): Promise<BootstrappedAgent> {
  if (globalThis.__abstraxnAgentSession) {
    savePersistedSession(globalThis.__abstraxnAgentSession);
    return globalThis.__abstraxnAgentSession;
  }

  const persisted = loadPersistedSession();
  if (persisted) {
    const env = loadAbstraxnEnv();
    const client = createAgentKitClient(env);
    const agent = await client.getAgent(persisted.agentId);
    const session: BootstrappedAgent = {
      client,
      agent,
      mcpToken: persisted.mcpToken,
      evmAddress: persisted.evmAddress,
      accessKey: persisted.accessKey,
      organizationId: persisted.organizationId,
      env,
    };
    globalThis.__abstraxnAgentSession = session;
    return session;
  }

  const session = await bootstrapAgent({
    name: options.name,
    description: options.description,
    createIfMissing: true,
  });

  globalThis.__abstraxnAgentSession = session;
  savePersistedSession(session);
  return session;
}

export { createMcpFromBootstrap };

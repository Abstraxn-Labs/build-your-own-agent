import {
  bootstrapAgent,
  createMcpFromBootstrap,
  type BootstrappedAgent,
} from '@abstraxn-examples/core';

declare global {
  // eslint-disable-next-line no-var
  var __abstraxnAgentSession: BootstrappedAgent | undefined;
}

export async function getOrCreateSession(options: {
  name: string;
  description: string;
}): Promise<BootstrappedAgent> {
  if (globalThis.__abstraxnAgentSession) {
    return globalThis.__abstraxnAgentSession;
  }

  const session = await bootstrapAgent({
    name: options.name,
    description: options.description,
    createIfMissing: true,
  });

  globalThis.__abstraxnAgentSession = session;
  return session;
}

export { createMcpFromBootstrap };
export type { BootstrappedAgent };

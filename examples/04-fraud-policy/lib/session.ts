import {
  bootstrapAgent,
  createMcpFromBootstrap,
  type BootstrappedAgent,
} from '@abstraxn-examples/core';
import { applyDemoGuardrails } from '@abstraxn-examples/wallet';

/** Demo blacklist — replace with a real address you control for live demos. */
const DEMO_BLACKLIST = [
  '0x000000000000000000000000000000000000dead',
];

declare global {
  // eslint-disable-next-line no-var
  var __abstraxnAgentSession: BootstrappedAgent | undefined;
  // eslint-disable-next-line no-var
  var __abstraxnPoliciesApplied: boolean | undefined;
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

  if (!globalThis.__abstraxnPoliciesApplied) {
    await applyDemoGuardrails(session.client, session.agent.id, {
      spend: {
        enabled: true,
        budgetUsd: '10',
        period: 'daily',
        hardBlock: true,
      },
      interaction: {
        name: 'fraud-demo-guardrails',
        chain: 'base',
        blacklistedRecipients: DEMO_BLACKLIST,
        maxNativeAmount: '0.01',
        hardBlock: true,
      },
    });
    globalThis.__abstraxnPoliciesApplied = true;
  }

  globalThis.__abstraxnAgentSession = session;
  return session;
}

export { createMcpFromBootstrap };

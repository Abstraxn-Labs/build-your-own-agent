import type {
  AgentKitClient,
  CreateInteractionPolicyInput,
  InteractionPolicyResponse,
  UpdateSpendPolicyInput,
} from '@abstraxn/agent-kit';
import { logInfo, logWarn } from '@abstraxn-examples/utils';

export interface DemoSpendPolicy {
  enabled?: boolean;
  budgetUsd?: string;
  period?: 'daily' | 'monthly';
  hardBlock?: boolean;
}

export interface DemoInteractionPolicy {
  name?: string;
  enabled?: boolean;
  hardBlock?: boolean;
  /** Chain key used by Agent Kit policies (e.g. "base", "ethereum"). */
  chain?: string;
  /** Recipients that must never receive funds. */
  blacklistedRecipients?: string[];
  /** Max native amount per tx (decimal string in native units or wei per API). */
  maxNativeAmount?: string;
}

/**
 * Apply a spend policy to an agent. Safe to call repeatedly in demos.
 */
export async function applySpendPolicy(
  client: AgentKitClient,
  agentId: string,
  policy: DemoSpendPolicy = {},
): Promise<void> {
  const input: UpdateSpendPolicyInput = {
    enabled: policy.enabled ?? true,
    budgetUsd: policy.budgetUsd ?? '25',
    period: policy.period ?? 'daily',
    hardBlock: policy.hardBlock ?? true,
  };

  await client.updateSpendPolicy(agentId, input);
  logInfo('Spend policy applied', { agentId, ...input });
}

/**
 * Create a simple interaction policy for fraud / guardrail demos.
 */
export async function applyInteractionPolicy(
  client: AgentKitClient,
  agentId: string,
  policy: DemoInteractionPolicy = {},
): Promise<InteractionPolicyResponse | null> {
  const chain = policy.chain ?? 'base';
  const rules: CreateInteractionPolicyInput['rules'] = {};

  if (policy.blacklistedRecipients?.length) {
    rules.recipientBlacklist = [
      {
        chain,
        addresses: policy.blacklistedRecipients,
      },
    ];
  }

  if (policy.maxNativeAmount) {
    rules.nativeAmountLimits = [
      {
        chain,
        max: policy.maxNativeAmount,
      },
    ];
  }

  if (!rules.recipientBlacklist && !rules.nativeAmountLimits) {
    logWarn('No interaction rules provided — skipping policy create');
    return null;
  }

  const input: CreateInteractionPolicyInput = {
    name: policy.name ?? 'demo-guardrails',
    enabled: policy.enabled ?? true,
    hardBlock: policy.hardBlock ?? true,
    rules,
  };

  const created = await client.createInteractionPolicy(agentId, input);
  logInfo('Interaction policy created', {
    agentId,
    policyId: created.id,
    name: created.name,
  });
  return created;
}

/**
 * Convenience: apply both spend + interaction policies for trading / fraud demos.
 */
export async function applyDemoGuardrails(
  client: AgentKitClient,
  agentId: string,
  options?: {
    spend?: DemoSpendPolicy;
    interaction?: DemoInteractionPolicy;
  },
): Promise<void> {
  await applySpendPolicy(client, agentId, options?.spend);
  if (options?.interaction) {
    await applyInteractionPolicy(client, agentId, options.interaction);
  }
}

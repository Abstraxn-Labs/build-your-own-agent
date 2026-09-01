import { agentConfig } from '@/lib/agent';
import { getOrCreateSession } from '@/lib/session';
import {
  buildFoodRules,
  createMandateForSwiggy,
  loadWarrantEnv,
} from '@/lib/warrant-policy';

export const runtime = 'nodejs';

type Body = {
  policyName?: string;
  domain?: string;
  amountMaxPerAction?: number;
  currency?: string;
  categoryDenylist?: string;
  counterpartyAllowlist?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const amountMax = Number(body.amountMaxPerAction);
    if (!Number.isFinite(amountMax) || amountMax <= 0) {
      return Response.json(
        { error: true, message: 'amountMaxPerAction must be a positive number.' },
        { status: 400 },
      );
    }

    const { appApiKey } = loadWarrantEnv();
    if (!appApiKey) {
      return Response.json(
        {
          error: true,
          message:
            'Set WARRANT_APP_API_KEY to your Abstraxn app key with KYI subscription.',
        },
        { status: 400 },
      );
    }

    const session = await getOrCreateSession({
      name: agentConfig.name,
      description: agentConfig.system.slice(0, 120),
    });

    const domain = body.domain?.trim() || 'food';
    const currency = body.currency?.trim() || 'INR';
    const policyName = body.policyName?.trim() || 'Swiggy checkout policy';
    const rules = buildFoodRules({
      amountMaxPerAction: amountMax,
      currency,
      categoryDenylist: body.categoryDenylist,
      counterpartyAllowlist: body.counterpartyAllowlist,
    });

    const agentId =
      loadWarrantEnv().agentId || session.agent.id || 'swiggy_food_agent';

    const state = await createMandateForSwiggy({
      agentId,
      policyName,
      domain,
      rules,
      amountMax,
      currency,
    });

    return Response.json({
      error: false,
      mandateId: state.mandateId,
      agentId: state.agentId,
      domain: state.domain,
      hash: state.hash,
      policyName: state.policyName,
      createdAt: state.createdAt,
      amountMax: state.amountMax ?? null,
      currency: state.currency ?? null,
      sealerAddress: state.sealerAddress,
      onchainTxHash: state.onchainTxHash ?? null,
      onchainStatus: state.onchainStatus ?? null,
      enforcementEnabled: true,
      // apiKey stays server-side
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: true, message }, { status: 500 });
  }
}

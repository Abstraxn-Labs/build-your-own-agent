import { agentConfig } from '@/lib/agent';
import { getOrCreateSession } from '@/lib/session';
import {
  getPolicyState,
  isWarrantEnforcementEnabled,
  loadWarrantEnv,
  setWarrantEnforcementEnabled,
} from '@/lib/warrant-policy';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getOrCreateSession({
    name: agentConfig.name,
    description: agentConfig.system.slice(0, 120),
  });
  const env = loadWarrantEnv();
  const policy = getPolicyState();
  const hasMandate = Boolean(policy?.mandateApiKey || env.mandateApiKey);

  return Response.json({
    sessionAgentId: session.agent.id,
    agentId: policy?.agentId || env.agentId || session.agent.id,
    apiUrl: env.apiUrl,
    hasMandate,
    hasPolicy: hasMandate,
    source: policy?.mandateApiKey ? 'runtime' : env.mandateApiKey ? 'env' : 'none',
    policyName: policy?.policyName ?? null,
    mandateId: policy?.mandateId ?? null,
    domain: policy?.domain ?? 'food',
    hash: policy?.hash ?? null,
    amountMax: policy?.amountMax ?? null,
    currency: policy?.currency ?? null,
    createdAt: policy?.createdAt ?? null,
    sealerAddress: policy?.sealerAddress ?? null,
    onchainTxHash: policy?.onchainTxHash ?? null,
    onchainStatus: policy?.onchainStatus ?? null,
    enforcementEnabled: isWarrantEnforcementEnabled(),
    evmAddress: session.evmAddress ?? null,
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as { enforcementEnabled?: boolean };
  if (typeof body.enforcementEnabled !== 'boolean') {
    return Response.json(
      { error: true, message: 'enforcementEnabled boolean required' },
      { status: 400 },
    );
  }
  setWarrantEnforcementEnabled(body.enforcementEnabled);
  return Response.json({
    error: false,
    enforcementEnabled: isWarrantEnforcementEnabled(),
  });
}

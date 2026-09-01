import {
  Warrant,
  hashMandateRules,
  mandateSealMessage,
  type RuleSet,
} from '@abstraxn/warrant';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

export type SwiggyPolicyState = {
  policyName: string;
  mandateId: string;
  mandateApiKey: string;
  agentId: string;
  domain: string;
  hash: string;
  sealerAddress: string;
  createdAt: string;
  amountMax?: number;
  currency?: string;
  /** Polygon Amoy register_mandate tx when KYI returns it (often async). */
  onchainTxHash?: string | null;
  onchainStatus?: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __swiggyWarrantPolicy: SwiggyPolicyState | undefined;
  // eslint-disable-next-line no-var
  var __swiggyWarrantEnforcement: boolean | undefined;
}

export function getPolicyState(): SwiggyPolicyState | null {
  return globalThis.__swiggyWarrantPolicy ?? null;
}

export function setPolicyState(state: SwiggyPolicyState | null): void {
  globalThis.__swiggyWarrantPolicy = state ?? undefined;
}

/** When false, place_order skips Warrant.check (demo toggle). Default true if a key exists. */
export function isWarrantEnforcementEnabled(): boolean {
  if (typeof globalThis.__swiggyWarrantEnforcement === 'boolean') {
    return globalThis.__swiggyWarrantEnforcement;
  }
  return Boolean(getPolicyState()?.mandateApiKey || loadWarrantEnv().mandateApiKey);
}

export function setWarrantEnforcementEnabled(enabled: boolean): void {
  globalThis.__swiggyWarrantEnforcement = enabled;
}

export function loadWarrantEnv(source: Record<string, string | undefined> = process.env): {
  apiUrl: string;
  /** Application key — createMandate (KYI subscription). */
  appApiKey?: string;
  /** Runtime mandate key — check(). */
  mandateApiKey?: string;
  agentId?: string;
} {
  const apiUrl = (source.WARRANT_URL ?? 'https://dev-warrant-api.abstraxn.com').replace(
    /\/$/,
    '',
  );
  return {
    apiUrl,
    appApiKey:
      source.WARRANT_APP_API_KEY?.trim() ||
      source.ABSTRAXN_API_KEY?.trim() ||
      undefined,
    mandateApiKey: source.WARRANT_MANDATE_API_KEY?.trim() || undefined,
    agentId:
      source.WARRANT_AGENT_ID?.trim() || source.AGENT_ID?.trim() || undefined,
  };
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildFoodRules(input: {
  amountMaxPerAction: number;
  currency: string;
  categoryDenylist?: string;
  counterpartyAllowlist?: string;
}): RuleSet {
  const rules: RuleSet['rules'] = [
    {
      type: 'amount_max_per_action',
      value: input.amountMaxPerAction,
      currency: input.currency || 'INR',
    },
  ];
  const deny = splitCsv(input.categoryDenylist);
  if (deny.length) rules.push({ type: 'category_denylist', value: deny });
  const allow = splitCsv(input.counterpartyAllowlist);
  if (allow.length) rules.push({ type: 'counterparty_allowlist', value: allow });
  return { rules };
}

type CreateMandateResult = {
  id?: string;
  apiKey?: string;
  hash?: string;
  status?: string;
  onchain?: unknown;
};

function extractOnchainMeta(result: CreateMandateResult): {
  txHash: string | null;
  status: string | null;
} {
  const onchain = result.onchain;
  if (!onchain || typeof onchain !== 'object') {
    return {
      txHash: null,
      status: typeof result.status === 'string' ? result.status : null,
    };
  }
  const o = onchain as Record<string, unknown>;
  const candidates = [o.txHash, o.tx_hash, o.transactionHash, o.hash];
  let txHash: string | null = null;
  for (const c of candidates) {
    if (typeof c === 'string' && /^0x[a-fA-F0-9]{64}$/.test(c)) {
      txHash = c;
      break;
    }
  }
  const status =
    typeof o.status === 'string'
      ? o.status
      : typeof result.status === 'string'
        ? result.status
        : null;
  return { txHash, status };
}

/**
 * Seal like poc-mandate-wallet: hash rules → EIP-191 sign → createMandate.
 * Uses a local viem account (demo sealer). If KYI's expected seal message
 * differs, retry once with the recovered address so create still succeeds.
 */
export async function createMandateForSwiggy(params: {
  agentId: string;
  policyName: string;
  domain: string;
  rules: RuleSet;
  amountMax: number;
  currency: string;
}): Promise<SwiggyPolicyState> {
  const { apiUrl, appApiKey } = loadWarrantEnv();
  if (!appApiKey) {
    throw new Error(
      'WARRANT_APP_API_KEY (or ABSTRAXN_API_KEY with KYI subscription) is required to create a mandate.',
    );
  }

  const hash = hashMandateRules(params.rules);
  const message = mandateSealMessage(hash);
  const account = privateKeyToAccount(generatePrivateKey());
  const signature = await account.signMessage({ message });

  const admin = new Warrant({ apiUrl, apiKey: appApiKey, onError: 'deny' });

  async function postCreate(principal: string, pubkeyRef: string) {
    return (await admin.createMandate({
      agent_id: params.agentId,
      principal_id: principal,
      domain: params.domain,
      rules: params.rules,
      owner_signature: signature,
      owner_pubkey_ref: pubkeyRef,
      valid_until: null,
    })) as CreateMandateResult;
  }

  let result: CreateMandateResult;
  let sealerAddress = account.address.toLowerCase();
  try {
    result = await postCreate(sealerAddress, `eip155:8453:${sealerAddress}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const got = msg.match(/got (0x[a-fA-F0-9]+)/i)?.[1];
    if (!got) throw err;
    sealerAddress = got.toLowerCase();
    result = await postCreate(sealerAddress, `eip155:8453:${sealerAddress}`);
  }

  const mandateId = typeof result?.id === 'string' ? result.id : '';
  const mandateApiKey = typeof result?.apiKey === 'string' ? result.apiKey : '';
  if (!mandateId || !mandateApiKey) {
    throw new Error('Warrant createMandate did not return mandate id/apiKey.');
  }

  const onchain = extractOnchainMeta(result);
  const state: SwiggyPolicyState = {
    policyName: params.policyName,
    mandateId,
    mandateApiKey,
    agentId: params.agentId,
    domain: params.domain,
    hash: typeof result.hash === 'string' ? result.hash : hash,
    sealerAddress,
    createdAt: new Date().toISOString(),
    amountMax: params.amountMax,
    currency: params.currency,
    onchainTxHash: onchain.txHash,
    onchainStatus: onchain.status,
  };
  setPolicyState(state);
  setWarrantEnforcementEnabled(true);
  return state;
}

export function resolveMandateForCheck(): {
  apiUrl: string;
  apiKey: string;
  agentId: string;
  domain: string;
} | null {
  if (!isWarrantEnforcementEnabled()) return null;
  const env = loadWarrantEnv();
  const policy = getPolicyState();
  const apiKey = policy?.mandateApiKey || env.mandateApiKey;
  if (!apiKey) return null;
  return {
    apiUrl: env.apiUrl,
    apiKey,
    agentId: policy?.agentId || env.agentId || 'swiggy_food_agent',
    domain: policy?.domain || 'food',
  };
}

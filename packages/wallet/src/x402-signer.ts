import type { AgentKitClient } from '@abstraxn/agent-kit';
import type {
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
} from '@x402/core/types';
import { x402Client } from '@x402/core/client';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { toClientEvmSigner } from '@x402/evm';
import { createPublicClient, http, defineChain, type Chain } from 'viem';
import { base } from 'viem/chains';

/**
 * Minimal shape `signX402Payment` needs to sign a challenge — a `BootstrappedAgent`
 * (from `@abstraxn-examples/core`) already satisfies this structurally, no glue required.
 */
export interface X402SigningSession {
  client: AgentKitClient;
  agent: { userIdentity: string };
  evmAddress?: string;
  accessKey?: string;
  organizationId?: string;
}

const BASE_CHAIN_ID = base.id;
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_NETWORK = `eip155:${BASE_CHAIN_ID}`;

function chainRpcUrl(): string {
  return (process.env.CHAIN_RPC_BASE || 'https://base.publicnode.com').trim();
}

function maxPaymentUsd(): number {
  const raw = Number((process.env.X402_MAX_PAYMENT_USD || '0.05').trim());
  return Number.isFinite(raw) && raw > 0 ? raw : 0.05;
}

function defineBaseCompatibleChain(rpcUrl: string): Chain {
  return defineChain({ ...base, rpcUrls: { default: { http: [rpcUrl] } } });
}

/**
 * Refuses to sign anything but exactly what this signer supports: the `exact` scheme,
 * Base mainnet, native USDC, within `X402_MAX_PAYMENT_USD`. Checked both on the raw
 * challenge (fail fast, before authenticating a signer) and — authoritatively — on
 * whatever requirement the x402 SDK actually selected when building the payment payload,
 * since `accepts[]` can list more than one option and the SDK's own selector decides
 * among them.
 */
function assertAcceptableRequirement(requirement: PaymentRequirements): void {
  if (requirement.scheme !== 'exact') {
    throw new Error(
      `Payment requirement uses unsupported scheme "${requirement.scheme}" (expected "exact"). Refusing to sign.`,
    );
  }
  if (requirement.network !== BASE_NETWORK) {
    throw new Error(
      `Payment requirement targets unsupported network "${requirement.network}" (expected ${BASE_NETWORK}). Refusing to sign.`,
    );
  }
  if (requirement.asset?.toLowerCase() !== BASE_USDC.toLowerCase()) {
    throw new Error(
      `Payment requirement uses unsupported asset "${requirement.asset}" (expected Base USDC ${BASE_USDC}). Refusing to sign.`,
    );
  }

  const cap = maxPaymentUsd();
  const atomicAmount = Number(requirement.amount);
  const requestedUsd = Number.isFinite(atomicAmount)
    ? atomicAmount / 1_000_000
    : NaN;
  if (!Number.isFinite(requestedUsd) || requestedUsd > cap) {
    throw new Error(
      `Payment requirement requested $${Number.isFinite(requestedUsd) ? requestedUsd.toFixed(4) : requirement.amount}, ` +
        `which exceeds the configured X402_MAX_PAYMENT_USD cap of $${cap}. Refusing to sign.`,
    );
  }
}

/**
 * Signs an x402 "exact" EVM payment challenge using the session's own cached server-wallet
 * `accessKey` — the external-signing architecture from `agentic-ai`'s
 * `agent-signing.service.ts`, moved here so the MCP-tool-hosting service never has to hold
 * a signing secret for this flow. `accessKey` reuse is required, not optional: the
 * `@abstraxn/server-signer` SDK generates a brand-new random key when none is supplied,
 * which fails against any wallet that already exists.
 */
export async function signX402Payment(
  session: X402SigningSession,
  paymentRequired: PaymentRequired,
): Promise<PaymentPayload> {
  const accepts = paymentRequired.accepts;
  const first = Array.isArray(accepts) ? accepts[0] : undefined;
  if (!first) {
    throw new Error('Payment challenge has no accepts[] entry to evaluate.');
  }
  assertAcceptableRequirement(first);

  if (!session.accessKey) {
    throw new Error(
      'Signing requires a server-wallet accessKey on the session. Set ABSTRAXN_ACCESS_KEY ' +
        'when reusing an existing agent, or bootstrap a fresh server-wallet agent.',
    );
  }
  if (!session.organizationId) {
    throw new Error(
      'Signing requires a server-wallet organizationId on the session. Set ' +
        'ABSTRAXN_ORGANIZATION_ID when reusing an existing agent.',
    );
  }
  if (!session.evmAddress) {
    throw new Error('Signing requires an EVM address on the session.');
  }

  const rpcUrl = chainRpcUrl();
  const serverSigner = session.client.getServerSigner();
  await serverSigner.authenticate({
    userIdentity: session.agent.userIdentity,
    accessKey: session.accessKey,
  });

  const evmAddress = session.evmAddress.toLowerCase() as `0x${string}`;
  const kitPublic = serverSigner.createPublicClient({
    rpcUrl,
    chainId: BASE_CHAIN_ID,
    organizationId: session.organizationId,
    fromAddress: evmAddress,
  });

  const partialSigner = {
    address: evmAddress,
    signTypedData: async (bundle: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }) => kitPublic.signTypedData({ typedData: bundle }),
  };

  const viemReader = createPublicClient({
    chain: defineBaseCompatibleChain(rpcUrl),
    transport: http(rpcUrl),
  });

  const evmSigner = toClientEvmSigner(partialSigner, {
    readContract: viemReader.readContract.bind(viemReader),
    getTransactionCount: viemReader.getTransactionCount.bind(viemReader),
    estimateFeesPerGas: viemReader.estimateFeesPerGas.bind(viemReader),
  });

  const x402 = new x402Client();
  registerExactEvmScheme(x402, {
    signer: evmSigner,
    schemeOptions: { [BASE_CHAIN_ID]: { rpcUrl } },
  });

  const paymentPayload = await x402.createPaymentPayload(paymentRequired);
  assertAcceptableRequirement(paymentPayload.accepted);
  return paymentPayload;
}

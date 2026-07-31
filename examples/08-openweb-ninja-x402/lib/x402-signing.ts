import { x402Client } from '@x402/core/client';
import type { PaymentPayload, PaymentRequired, PaymentRequirements } from '@x402/core/types';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { toClientEvmSigner } from '@x402/evm';
import { createPublicClient, http } from 'viem';
import type { BootstrappedAgent } from './session';
import { parseCaip2EvmChainId, resolveEvmRpcUrl, resolveViemChain } from './evm-chains';

const ERC20_BALANCE_OF_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export interface BalanceCheckError {
  message: string;
}

/**
 * Reads the agent wallet's balance of an x402-quoted ERC-20 (USDC) and compares it
 * against the required amount — mirrors agent-app-service's pre-flight
 * `validateX402PaymentRequirementBalance` so a caller gets a clear message instead of
 * a confusing on-chain revert when signing/settling.
 */
export async function checkUsdcBalance(
  session: BootstrappedAgent,
  requirement: Pick<PaymentRequirements, 'asset' | 'amount' | 'network'>,
): Promise<BalanceCheckError | null> {
  if (!session.evmAddress) {
    return { message: 'Agent has no EVM wallet address.' };
  }

  const chainId = parseCaip2EvmChainId(String(requirement.network));
  const rpcUrl = resolveEvmRpcUrl(chainId);
  const publicClient = createPublicClient({ chain: resolveViemChain(chainId), transport: http(rpcUrl) });

  const required = BigInt(requirement.amount);
  const balance = await publicClient.readContract({
    address: requirement.asset as `0x${string}`,
    abi: ERC20_BALANCE_OF_ABI,
    functionName: 'balanceOf',
    args: [session.evmAddress as `0x${string}`],
  });

  if (balance < required) {
    return {
      message:
        `Insufficient USDC balance on chain ${chainId}: wallet ${session.evmAddress} has ` +
        `${balance.toString()} atomic units, needs ${required.toString()}. Fund this address with a ` +
        'small amount of USDC before paying.',
    };
  }
  return null;
}

/**
 * Direct port of agent-app-service's `AgentSigningService.createX402PaymentPayloadForAgent`
 * (src/agents/agent-signing.service.ts). Sources `accessKey` / `organizationId` / `evmAddress` /
 * `userIdentity` from the in-memory `BootstrappedAgent` session instead of a decrypted DB row —
 * this example has no database, and `bootstrapAgent()` already returns these already-decrypted
 * (never persisted anywhere, so there's nothing to decrypt).
 */
export async function signOpenWebNinjaPayment(
  session: BootstrappedAgent,
  paymentRequired: PaymentRequired,
): Promise<PaymentPayload> {
  if (!session.accessKey || !session.organizationId || !session.evmAddress) {
    throw new Error(
      'Agent wallet metadata is incomplete — accessKey/organizationId/evmAddress are required to sign ' +
        'x402 payments. Re-check ABSTRAXN_* env vars or agent creation.',
    );
  }

  const accepts = paymentRequired.accepts;
  if (!Array.isArray(accepts) || accepts.length === 0) {
    throw new Error('paymentRequired has no accepts[].');
  }

  const chainId = parseCaip2EvmChainId(String(accepts[0]!.network));
  const rpcUrl = resolveEvmRpcUrl(chainId);
  const chain = resolveViemChain(chainId);

  // Same AgentKitClient instance the session already authenticated with — no need to
  // construct a fresh one the way agent-app-service does per-request in its backend.
  const serverSigner = session.client.getServerSigner();
  await serverSigner.authenticate({
    userIdentity: session.env.ABSTRAXN_USER_IDENTITY,
    accessKey: session.accessKey,
  });

  const kitPublic = serverSigner.createPublicClient({
    rpcUrl,
    chainId,
    organizationId: session.organizationId,
    fromAddress: session.evmAddress as `0x${string}`,
  });

  const partialSigner = {
    address: session.evmAddress as `0x${string}`,
    signTypedData: async (bundle: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }) =>
      kitPublic.signTypedData({
        typedData: {
          domain: bundle.domain,
          types: bundle.types,
          primaryType: bundle.primaryType,
          message: bundle.message,
        },
      }),
  };

  const viemReader = createPublicClient({ chain, transport: http(rpcUrl) });

  const evmSigner = toClientEvmSigner(partialSigner, {
    readContract: viemReader.readContract.bind(viemReader),
    getTransactionCount: viemReader.getTransactionCount.bind(viemReader),
    estimateFeesPerGas: viemReader.estimateFeesPerGas.bind(viemReader),
  });

  const x402 = new x402Client();
  registerExactEvmScheme(x402, {
    signer: evmSigner,
    schemeOptions: { [chainId]: { rpcUrl } },
  });

  // OpenWeb Ninja's x402 gateway only ever offers the "exact" (EIP-3009) scheme — no
  // "upto"/Permit2 registration needed here, unlike agent-app-service which also
  // registers UptoEvmScheme for Bitrefill's mainnet challenges.
  return x402.createPaymentPayload(paymentRequired);
}

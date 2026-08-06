import { arbitrum, base, polygon, type Chain } from 'viem/chains';

/**
 * OpenWeb Ninja's x402 gateway only ever quotes these three mainnets (no testnet
 * option exists upstream) — scoped to just these, unlike agent-app-service's much
 * broader `evm-chain.config.ts` which also handles Sepolia/other chains for other tools.
 */
const CHAINS: Record<number, Chain> = {
  [base.id]: base,
  [polygon.id]: polygon,
  [arbitrum.id]: arbitrum,
};

const DEFAULT_RPC_URLS: Record<number, string> = {
  [base.id]: process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org',
  [polygon.id]: process.env.POLYGON_RPC_URL?.trim() || 'https://polygon-rpc.com',
  [arbitrum.id]: process.env.ARBITRUM_RPC_URL?.trim() || 'https://arb1.arbitrum.io/rpc',
};

/** Parses an x402 `accepts[].network` (CAIP-2, e.g. "eip155:8453") into a numeric chainId. */
export function parseCaip2EvmChainId(network: string): number {
  const trimmed = network.trim();
  const match = /^eip155:(\d+)$/.exec(trimmed);
  if (!match) {
    throw new Error(
      `Unsupported x402 network "${network}" — expected CAIP-2 (eip155:<chainId>). ` +
        'OpenWeb Ninja only quotes Base (eip155:8453), Polygon (eip155:137), or Arbitrum (eip155:42161).',
    );
  }
  return Number(match[1]);
}

export function resolveEvmRpcUrl(chainId: number): string {
  const rpcUrl = DEFAULT_RPC_URLS[chainId];
  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for chainId ${chainId}.`);
  }
  return rpcUrl;
}

export function resolveViemChain(chainId: number): Chain {
  const chain = CHAINS[chainId];
  if (!chain) {
    throw new Error(
      `Unsupported chainId ${chainId} — this example only handles Base/Polygon/Arbitrum mainnet.`,
    );
  }
  return chain;
}

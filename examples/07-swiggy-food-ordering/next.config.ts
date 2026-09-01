import type { NextConfig } from 'next';
import { loadMonorepoEnv } from '../../config/load-monorepo-env';

loadMonorepoEnv();

const nextConfig: NextConfig = {
  transpilePackages: [
    '@abstraxn-examples/core',
    '@abstraxn-examples/mcp',
    '@abstraxn-examples/wallet',
    '@abstraxn-examples/llm',
    '@abstraxn-examples/utils',
  ],
  serverExternalPackages: ['viem', '@abstraxn/warrant'],
};

export default nextConfig;

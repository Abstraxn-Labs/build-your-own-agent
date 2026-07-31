'use client';

import { AgentChatPage } from '@abstraxn-examples/ui';
import { agentMeta } from '@/lib/agent';

export default function HomePage() {
  return (
    <AgentChatPage
      agentMeta={agentMeta}
      emptyStatePrompt='Try: "Quote a small USDC to ETH swap on Base and explain the route."'
    />
  );
}

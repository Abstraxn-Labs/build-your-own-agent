'use client';

import { AgentChatPage } from '@abstraxn-examples/ui';
import { agentMeta } from '@/lib/agent';

export default function HomePage() {
  return (
    <AgentChatPage
      agentMeta={agentMeta}
      emptyStatePrompt='Try: "What is my wallet balance and current gas info?", "Simulate sending 0.001 ETH to my own wallet on base-sepolia", or paste a tx hash and ask "What happened with this transaction?"'
    />
  );
}

'use client';

import { AgentChatPage } from '@abstraxn-examples/ui';
import { agentMeta } from '@/lib/agent';

export default function HomePage() {
  return (
    <AgentChatPage
      agentMeta={agentMeta}
      emptyStatePrompt='Try: "What is my wallet address and native balance?"'
    />
  );
}

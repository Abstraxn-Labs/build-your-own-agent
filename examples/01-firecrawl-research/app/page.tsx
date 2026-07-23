'use client';

import { AgentChatPage } from '@abstraxn-examples/ui';
import { agentMeta } from '@/lib/agent';

export default function HomePage() {
  return (
    <AgentChatPage
      agentMeta={agentMeta}
      emptyStatePrompt='Try: "Scrape https://abstraxn.com and summarize what Abstraxn builds."'
    />
  );
}

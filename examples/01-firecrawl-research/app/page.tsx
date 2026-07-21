'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useMemo, useState, type FormEvent } from 'react';
import { agentMeta } from '@/lib/agent';

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function toolNames(message: UIMessage): string[] {
  return message.parts
    .filter((part) => part.type.startsWith('tool-') || part.type === 'dynamic-tool')
    .map((part) => ('toolName' in part ? String(part.toolName) : part.type));
}

export default function HomePage() {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat' }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const [input, setInput] = useState('');
  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    void sendMessage({ text });
    setInput('');
  };

  return (
    <main
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '32px 20px 48px',
        display: 'grid',
        gap: 20,
      }}
    >
      <header style={{ display: 'grid', gap: 8 }}>
        <p
          style={{
            margin: 0,
            color: 'var(--muted)',
            fontSize: 13,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Build your Agent with Abstraxn
        </p>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>{agentMeta.title}</h1>
        <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.5 }}>
          {agentMeta.subtitle}
        </p>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 280px',
          gap: 16,
        }}
        className="layout"
      >
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            minHeight: 480,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'grid', gap: 12 }}>
            {messages.length === 0 && (
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Try: &quot;Scrape https://abstraxn.com and summarize what Abstraxn builds.&quot;
              </p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  background: message.role === 'user' ? 'var(--user)' : 'var(--assistant)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.45,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--muted)',
                    marginBottom: 6,
                    fontFamily: 'var(--mono)',
                    textTransform: 'uppercase',
                  }}
                >
                  {message.role}
                </div>
                {messageText(message)}
                {toolNames(message).length ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ok)' }}>
                    Tools: {toolNames(message).join(', ')}
                  </div>
                ) : null}
              </div>
            ))}
            {error ? (
              <p style={{ color: 'var(--danger)', margin: 0 }}>{error.message}</p>
            ) : null}
          </div>
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              gap: 8,
              padding: 12,
              borderTop: '1px solid var(--border)',
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the agent…"
              disabled={isLoading}
              style={{
                flex: 1,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text)',
                padding: '10px 12px',
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 0,
                borderRadius: 8,
                padding: '10px 16px',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? '…' : 'Send'}
            </button>
          </form>
        </div>

        <aside
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 16,
            height: 'fit-content',
          }}
        >
          <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>What this agent can do</h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', lineHeight: 1.6 }}>
            {agentMeta.capabilities.map((capability) => (
              <li key={capability} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                {capability}
              </li>
            ))}
          </ul>
          <p style={{ margin: '16px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Docs:{' '}
            <a href={agentMeta.docsUrl} target="_blank" rel="noreferrer">
              SDK quickstart
            </a>
          </p>
        </aside>
      </section>

      <style>{`
        @media (max-width: 800px) {
          .layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}

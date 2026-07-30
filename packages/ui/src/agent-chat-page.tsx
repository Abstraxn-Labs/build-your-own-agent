'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { type AgentMeta, messageText, toolNames } from './chat-utils.js';
import { MessageBody } from './message-body.js';

export interface AgentChatPageProps {
  agentMeta: AgentMeta;
  emptyStatePrompt: string;
}

export function AgentChatPage({ agentMeta, emptyStatePrompt }: AgentChatPageProps) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat' }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status, error]);

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
        className="agent-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 280px',
          gap: 16,
        }}
      >
        <div
          className="chat-panel"
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="chat-messages">
            {messages.length === 0 && (
              <p style={{ color: 'var(--muted)', margin: 0 }}>{emptyStatePrompt}</p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  background: message.role === 'user' ? 'var(--user)' : 'var(--assistant)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 12px',
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
                <MessageBody text={messageText(message)} />
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
            <div ref={messagesEndRef} />
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
                color: 'var(--accent-fg)',
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
    </main>
  );
}

'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { agentMeta } from '@/lib/agent';

interface PaymentRequiredOutput {
  status: 'payment_required';
  toolName: string;
  args: Record<string, unknown>;
  paymentRequired: {
    accepts: Array<{ network: string; asset: string; amount: string; payTo: string }>;
  };
}

interface PayCardState {
  status: 'idle' | 'paying' | 'ok' | 'error';
  message?: string;
  result?: unknown;
}

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function isToolPart(part: UIMessage['parts'][number]): boolean {
  return part.type.startsWith('tool-') || part.type === 'dynamic-tool';
}

function toolName(part: UIMessage['parts'][number]): string {
  return 'toolName' in part ? String(part.toolName) : part.type;
}

function parsePaymentRequired(part: UIMessage['parts'][number]): PaymentRequiredOutput | null {
  if (!isToolPart(part) || !('state' in part) || part.state !== 'output-available') return null;
  const output = (part as { output?: unknown }).output;
  if (typeof output !== 'string') return null;
  try {
    const parsed = JSON.parse(output);
    return parsed?.status === 'payment_required' ? (parsed as PaymentRequiredOutput) : null;
  } catch {
    return null;
  }
}

/**
 * `/api/pay` forwards the raw MCP `tools/call` result, whose `content[].text` entries are
 * themselves JSON-encoded strings — rendering that as-is produces one unreadable
 * backslash-escaped blob. Parse those inner strings so the UI shows real nested JSON.
 */
function formatToolResult(result: unknown): unknown {
  if (!result || typeof result !== 'object' || !('content' in result)) return result;
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return result;

  const parsed = content.map((c: { type?: string; text?: string }) => {
    if (c?.type !== 'text' || typeof c.text !== 'string') return c;
    try {
      return JSON.parse(c.text);
    } catch {
      return c.text;
    }
  });

  return parsed.length === 1 ? parsed[0] : parsed;
}

function networkLabel(network: string): string {
  if (network === 'eip155:8453') return 'Base';
  if (network === 'eip155:137') return 'Polygon';
  if (network === 'eip155:42161') return 'Arbitrum';
  return network;
}

function PaymentCard({ cardKey, payment }: { cardKey: string; payment: PaymentRequiredOutput }) {
  const [state, setState] = useState<PayCardState>({ status: 'idle' });
  const accepted = payment.paymentRequired.accepts[0];
  const priceUsd = accepted ? (Number(accepted.amount) / 1e6).toFixed(3) : '?';
  const network = accepted ? networkLabel(accepted.network) : 'unknown';

  const handlePay = async () => {
    setState({ status: 'paying' });
    try {
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: payment.toolName,
          args: payment.args,
          paymentRequired: payment.paymentRequired,
        }),
      });
      const data = (await res.json()) as { ok: boolean; result?: unknown; error?: { message: string } };
      if (data.ok) {
        setState({ status: 'ok', result: formatToolResult(data.result) });
      } else {
        setState({ status: 'error', message: data.error?.message ?? 'Payment failed.' });
      }
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div
      key={cardKey}
      style={{
        marginTop: 8,
        padding: 12,
        borderRadius: 8,
        border: '1px solid var(--warn)',
        background: 'rgba(232, 184, 75, 0.08)',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 600, marginBottom: 6 }}>
        💳 Payment required — {payment.toolName}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>
        This call costs <strong>${priceUsd}</strong> in USDC on <strong>{network}</strong>. Clicking Pay
        signs the payment with your Abstraxn agent wallet and retries the call.
      </div>
      {state.status === 'idle' || state.status === 'paying' ? (
        <button
          onClick={handlePay}
          disabled={state.status === 'paying'}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 0,
            borderRadius: 6,
            padding: '8px 14px',
            fontWeight: 600,
            cursor: state.status === 'paying' ? 'default' : 'pointer',
            opacity: state.status === 'paying' ? 0.7 : 1,
          }}
        >
          {state.status === 'paying' ? 'Paying…' : `Pay $${priceUsd} & Retry`}
        </button>
      ) : state.status === 'ok' ? (
        <div>
          <div style={{ color: 'var(--ok)', fontSize: 12, marginBottom: 6 }}>✓ Paid — result:</div>
          <pre
            style={{
              margin: 0,
              fontSize: 11,
              fontFamily: 'var(--mono)',
              whiteSpace: 'pre-wrap',
              maxHeight: 240,
              overflow: 'auto',
            }}
          >
            {JSON.stringify(state.result, null, 2)}
          </pre>
        </div>
      ) : (
        <div style={{ color: 'var(--danger)', fontSize: 12 }}>✗ {state.message}</div>
      )}
    </div>
  );
}

export default function HomePage() {
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat' }), []);
  const { messages, sendMessage, status, error } = useChat({ transport });
  const [input, setInput] = useState('');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    fetch('/api/pay')
      .then((r) => r.json())
      .then((d: { evmAddress: string | null }) => setWalletAddress(d.evmAddress))
      .catch(() => setWalletAddress(null));
  }, []);

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
        <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.5 }}>{agentMeta.subtitle}</p>
        <div
          style={{
            marginTop: 4,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--warn)',
            background: 'rgba(232, 184, 75, 0.08)',
            fontSize: 12,
            color: 'var(--warn)',
          }}
        >
          ⚠️ Every tool here spends real USDC on mainnet (Base/Polygon/Arbitrum) — no testnet, no free
          tier. Nothing is paid until you click &quot;Pay &amp; Retry&quot; below a tool call.
          {walletAddress ? (
            <>
              {' '}
              Fund this wallet before paying: <code style={{ fontFamily: 'var(--mono)' }}>{walletAddress}</code>
            </>
          ) : null}
        </div>
      </header>

      <section
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 16 }}
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
                Try: &quot;Search the web for the latest OpenWeb Ninja pricing.&quot;
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
                {message.parts.filter(isToolPart).map((part, i) => {
                  const payment = parsePaymentRequired(part);
                  const key = `${message.id}-${i}`;
                  return payment ? (
                    <PaymentCard key={key} cardKey={key} payment={payment} />
                  ) : (
                    <div key={key} style={{ marginTop: 8, fontSize: 12, color: 'var(--ok)' }}>
                      Tool: {toolName(part)}
                    </div>
                  );
                })}
              </div>
            ))}
            {error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{error.message}</p> : null}
          </div>
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}
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
          <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>26 OpenWeb Ninja tools</h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              color: 'var(--muted)',
              lineHeight: 1.6,
              maxHeight: 320,
              overflow: 'auto',
            }}
          >
            {agentMeta.capabilities.map((capability) => (
              <li key={capability} style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                {capability}
              </li>
            ))}
          </ul>
          <p style={{ margin: '16px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Docs:{' '}
            <a href={agentMeta.docsUrl} target="_blank" rel="noreferrer">
              MCP integration
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

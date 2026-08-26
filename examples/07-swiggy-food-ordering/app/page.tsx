'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { DraftCartChrome } from '@/components/draft-cart-chrome';
import { agentMeta } from '@/lib/agent';
import { DraftCartProvider, useDraftCart } from '@/lib/draft-cart';
import {
  displayAssistantText,
  displayUserText,
  latestPendingPayment,
  messageHasCardFeed,
  ToolResultPanels,
} from '@/lib/tool-panels';

const CAPABILITY_LABELS: Record<string, string> = {
  swiggy_get_addresses: 'Saved delivery addresses',
  swiggy_search_restaurants: 'Search nearby restaurants',
  swiggy_get_menu: 'Browse full menus',
  swiggy_search_menu: 'Find dishes by name',
  swiggy_manage_cart: 'Build and review cart',
  swiggy_get_payment_options: 'Choose how to pay',
  swiggy_place_order: 'Place order with UPI QR',
  swiggy_check_payment_status: 'Confirm payment status',
  swiggy_get_order_status: 'Track an active order',
  swiggy_get_order_history: 'Past order history',
  swiggy_get_order_details: 'Order details',
  swiggy_fetch_coupons: 'Discover coupons',
  swiggy_apply_coupon: 'Apply a coupon',
};

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function PaymentSidebarCard({ data }: { data: Record<string, unknown> }) {
  const paymentUrl =
    typeof data.paymentUrl === 'string'
      ? data.paymentUrl
      : typeof data.payment_url === 'string'
        ? data.payment_url
        : undefined;
  const paymentQrImage =
    typeof data.paymentQrImage === 'string' ? data.paymentQrImage : undefined;
  const paymentQrPayload =
    typeof data.paymentQrPayload === 'string' ? data.paymentQrPayload : undefined;
  const qrData = paymentQrPayload || paymentUrl;
  const img =
    paymentQrImage &&
    (paymentQrImage.startsWith('data:image/') || /^https?:\/\//i.test(paymentQrImage))
      ? paymentQrImage
      : qrData
        ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(qrData)}`
        : null;

  return (
    <div className="pay-card">
      <div className="pay-card-title">Pay with UPI</div>
      <p className="pay-card-copy">
        Scan the QR or open the link, then type &quot;I&apos;ve paid&quot; in chat.
      </p>
      {img ? (
        <div className="pay-card-qr-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt="UPI QR"
            width={200}
            height={200}
            className="pay-card-qr"
          />
        </div>
      ) : (
        <p className="pay-card-wait">Waiting for QR from Swiggy…</p>
      )}
      {paymentUrl ? (
        <a href={paymentUrl} target="_blank" rel="noreferrer" className="pay-card-link">
          Open payment link
        </a>
      ) : null}
    </div>
  );
}

function HomePageInner() {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat' }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoading = status === 'submitted' || status === 'streaming';
  const pendingPayment = useMemo(() => latestPendingPayment(messages), [messages]);
  const draftCart = useDraftCart();

  const [swiggyConnected, setSwiggyConnected] = useState<boolean | null>(null);
  const [swiggyError, setSwiggyError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('swiggy') === 'error') {
      setSwiggyError(params.get('reason') ?? 'unknown_error');
    }
    if (params.has('swiggy')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    fetch('/api/swiggy/auth/status')
      .then((res) => res.json())
      .then((data: { connected: boolean }) => setSwiggyConnected(data.connected))
      .catch(() => setSwiggyConnected(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status, error, draftCart.itemCount]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    void sendMessage({ text });
    setInput('');
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="app-eyebrow">Abstraxn Agent</p>
        <h1 className="app-title">{agentMeta.title}</h1>
        <p className="app-subtitle">{agentMeta.subtitle}</p>
      </header>

      <div className="swiggy-status">
        <span>
          <span
            className={`swiggy-status-dot ${
              swiggyConnected ? 'ok' : swiggyConnected === null ? '' : 'warn'
            }`}
          />
          {swiggyConnected === null
            ? 'Checking Swiggy connection…'
            : swiggyConnected
              ? 'Swiggy account connected'
              : swiggyError
                ? `Connection failed (${swiggyError}) — try again`
                : 'Connect Swiggy to start ordering'}
        </span>
        {!swiggyConnected && (
          <a href="/api/swiggy/auth/start" className="swiggy-connect-btn">
            Connect Swiggy
          </a>
        )}
      </div>

      <section className="layout">
        <div className="chat-panel">
          <div className="chat-scroll">
            {messages.length === 0 && (
              <div className="chat-empty">
                <p className="chat-empty-kicker">Ready when you are</p>
                <h2 className="chat-empty-title">What are you craving?</h2>
                <p className="chat-empty-copy">
                  Add several dishes to your draft cart, tap Confirm &amp; show cart,
                  then pay with UPI — all in this chat.
                </p>
              </div>
            )}
            {messages.map((message) => {
              const rawText = messageText(message);
              const isUser = message.role === 'user';
              const hasCards = !isUser && messageHasCardFeed(message);
              const text = isUser
                ? displayUserText(rawText)
                : displayAssistantText(rawText, hasCards);
              return (
                <div key={message.id} className="chat-turn">
                  {text ? (
                    <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}>
                      <div className="chat-bubble-role">
                        {isUser ? 'You' : 'Agent'}
                      </div>
                      {text}
                    </div>
                  ) : null}
                  {!isUser ? (
                    <ToolResultPanels
                      message={message}
                      disabled={isLoading}
                      onPick={(pickText) => {
                        if (isLoading) return;
                        void sendMessage({ text: pickText });
                      }}
                      onAddToDraft={(item) => {
                        draftCart.addItem(item);
                      }}
                      onSelectAddress={(id, label) => {
                        draftCart.setAddress(id, label);
                      }}
                      onSelectRestaurant={(id, name) => {
                        draftCart.setRestaurant(id, name);
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
            {error ? (
              <p className="chat-soft-error">{error.message}</p>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <DraftCartChrome
            disabled={isLoading}
            onConfirm={(message) => {
              if (isLoading) return;
              void sendMessage({ text: message });
            }}
          />

          <form onSubmit={handleSubmit} className="chat-composer">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                pendingPayment
                  ? "After paying, type: I've paid"
                  : draftCart.itemCount > 0
                    ? 'Add more dishes, or confirm your cart…'
                    : 'Ask the agent…'
              }
              disabled={isLoading}
              className="chat-input"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="chat-send"
            >
              {isLoading ? '…' : 'Send'}
            </button>
          </form>
        </div>

        <aside className="side-panel">
          {pendingPayment ? <PaymentSidebarCard data={pendingPayment} /> : null}
          <h2 className="side-heading">How it works</h2>
          <ol className="side-copy">
            <li>Choose a delivery address</li>
            <li>Add multiple dishes to your draft cart</li>
            <li>Confirm &amp; sync cart, then pay with UPI</li>
            <li>Type &quot;I&apos;ve paid&quot; after scanning</li>
          </ol>
          <h2 className="side-heading">Capabilities</h2>
          <ul className="side-capabilities">
            {agentMeta.capabilities.map((capability) => (
              <li key={capability}>
                <span className="side-cap-mark" aria-hidden />
                {CAPABILITY_LABELS[capability] ?? capability}
              </li>
            ))}
          </ul>
          <p className="side-docs">
            Docs:{' '}
            <a href={agentMeta.docsUrl} target="_blank" rel="noreferrer">
              MCP integration
            </a>
          </p>
        </aside>
      </section>
    </main>
  );
}

export default function HomePage() {
  return (
    <DraftCartProvider>
      <HomePageInner />
    </DraftCartProvider>
  );
}

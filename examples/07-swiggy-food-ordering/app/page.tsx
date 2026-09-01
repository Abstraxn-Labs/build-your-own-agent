'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { DraftCartChrome } from '@/components/draft-cart-chrome';
import { AccountSidebar } from '@/components/account-sidebar';
import { SidebarHelp } from '@/components/sidebar-help';
import { agentMeta } from '@/lib/agent';
import { DraftCartProvider, useDraftCart } from '@/lib/draft-cart';
import {
  displayAssistantText,
  displayUserText,
  latestAddressFailureKey,
  latestAddressesMessageId,
  latestPendingPayment,
  latestPickedAddressFromMessages,
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

type WarrantStatus = {
  sessionAgentId?: string;
  agentId: string;
  apiUrl: string;
  hasMandate: boolean;
  hasPolicy: boolean;
  source: 'runtime' | 'env' | 'none';
  policyName: string | null;
  mandateId: string | null;
  domain: string | null;
  hash: string | null;
  amountMax: number | null;
  currency: string | null;
  createdAt: string | null;
  sealerAddress: string | null;
  onchainTxHash: string | null;
  onchainStatus: string | null;
  enforcementEnabled: boolean;
  evmAddress: string | null;
};

type MandateReceipt = {
  mandateId: string;
  hash: string | null;
  amountMax: number | null;
  currency: string | null;
  onchainTxHash: string | null;
  onchainStatus: string | null;
  createdAt: string | null;
};


function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function paymentKeyOf(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  const paas =
    typeof data.paasId === 'string'
      ? data.paasId
      : typeof data.paas_id === 'string'
        ? data.paas_id
        : '';
  const url =
    typeof data.paymentUrl === 'string'
      ? data.paymentUrl
      : typeof data.payment_url === 'string'
        ? data.payment_url
        : '';
  const key = paas || url;
  return key || 'pending';
}

function PaymentSidebarCard({
  data,
  onChangeOrder,
}: {
  data: Record<string, unknown>;
  onChangeOrder?: () => void;
}) {
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
      {onChangeOrder ? (
        <button type="button" className="pay-card-edit" onClick={onChangeOrder}>
          Change order instead
        </button>
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
  const pendingPaymentRaw = useMemo(() => latestPendingPayment(messages), [messages]);
  const [dismissedPaymentKey, setDismissedPaymentKey] = useState<string | null>(null);
  const activePaymentKey = paymentKeyOf(pendingPaymentRaw);
  const pendingPayment =
    pendingPaymentRaw && activePaymentKey && activePaymentKey !== dismissedPaymentKey
      ? pendingPaymentRaw
      : null;
  const draftCart = useDraftCart();
  const latestAddressesMsgId = useMemo(
    () => latestAddressesMessageId(messages),
    [messages],
  );
  const addressFailureKey = useMemo(
    () => latestAddressFailureKey(messages),
    [messages],
  );
  const handledAddressFailureRef = useRef<string | null>(null);
  const addressRefreshSentRef = useRef<string | null>(null);

  const dismissStalePayment = () => {
    if (activePaymentKey) setDismissedPaymentKey(activePaymentKey);
  };

  // Hard recovery: Swiggy rejected addressId → clear local address immediately.
  useEffect(() => {
    if (!addressFailureKey) return;
    if (handledAddressFailureRef.current === addressFailureKey) return;
    handledAddressFailureRef.current = addressFailureKey;
    draftCart.invalidateAddress();
    if (activePaymentKey) setDismissedPaymentKey(activePaymentKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on new failure key
  }, [addressFailureKey]);

  // Then ask for fresh addresses once the chat is idle.
  useEffect(() => {
    if (!addressFailureKey) return;
    if (addressRefreshSentRef.current === addressFailureKey) return;
    if (isLoading) return;
    addressRefreshSentRef.current = addressFailureKey;
    void sendMessage({ text: draftCart.buildRefreshAddressMessage() });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send once per failure
  }, [addressFailureKey, isLoading]);

  // Keep draft address in sync with the latest chat address pick (survives HMR / missed clicks).
  useEffect(() => {
    if (draftCart.addressInvalid) return;
    const picked = latestPickedAddressFromMessages(messages);
    if (!picked) return;
    if (draftCart.addressId === picked.id && draftCart.addressReady) return;
    draftCart.setAddress(picked.id, picked.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate from message stream
  }, [messages, draftCart.addressInvalid]);

  const [swiggyConnected, setSwiggyConnected] = useState<boolean | null>(null);
  const [swiggyError, setSwiggyError] = useState<string | null>(null);
  const [warrantStatus, setWarrantStatus] = useState<WarrantStatus | null>(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [mandateReceipt, setMandateReceipt] = useState<MandateReceipt | null>(null);
  const [policyForm, setPolicyForm] = useState({
    policyName: 'Swiggy checkout policy',
    amountMaxPerAction: '500',
    currency: 'INR',
    categoryDenylist: 'alcohol,non_veg',
  });

  const refreshWarrantStatus = () =>
    fetch('/api/warrant/status')
      .then((res) => res.json())
      .then((data: WarrantStatus) => {
        setWarrantStatus(data);
      })
      .catch(() => {
        setWarrantStatus(null);
      });

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
    void refreshWarrantStatus();
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

  const handleToggleEnforcement = async () => {
    if (!warrantStatus || toggleBusy) return;
    setToggleBusy(true);
    try {
      const next = !warrantStatus.enforcementEnabled;
      const res = await fetch('/api/warrant/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enforcementEnabled: next }),
      });
      const data = (await res.json()) as { error?: boolean; message?: string };
      if (!res.ok || data.error) {
        throw new Error(data.message || 'Failed to update mandate toggle.');
      }
      await refreshWarrantStatus();
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : String(err));
    } finally {
      setToggleBusy(false);
    }
  };

  const handlePolicySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPolicyError(null);
    setPolicyBusy(true);
    try {
      const payload = {
        ...policyForm,
        domain: 'food',
        amountMaxPerAction: Number(policyForm.amountMaxPerAction),
      };
      const res = await fetch('/api/warrant/mandate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        error?: boolean;
        message?: string;
        mandateId?: string;
        hash?: string | null;
        amountMax?: number | null;
        currency?: string | null;
        onchainTxHash?: string | null;
        onchainStatus?: string | null;
        createdAt?: string | null;
      };
      if (!res.ok || data.error) {
        throw new Error(data.message || 'Failed to create mandate.');
      }
      if (data.mandateId) {
        setMandateReceipt({
          mandateId: data.mandateId,
          hash: data.hash ?? null,
          amountMax: data.amountMax ?? null,
          currency: data.currency ?? null,
          onchainTxHash: data.onchainTxHash ?? null,
          onchainStatus: data.onchainStatus ?? null,
          createdAt: data.createdAt ?? null,
        });
      }
      await refreshWarrantStatus();
      setShowPolicyModal(false);
    } catch (error) {
      setPolicyError(error instanceof Error ? error.message : String(error));
    } finally {
      setPolicyBusy(false);
    }
  };

  return (
    <main className="app-shell">
      <aside className="side-panel">
        <AccountSidebar
          swiggyConnected={swiggyConnected}
          swiggyError={swiggyError}
          warrantStatus={warrantStatus}
          toggleBusy={toggleBusy}
          policyError={policyError}
          mandateReceipt={mandateReceipt}
          onOpenPolicyModal={() => {
            setPolicyError(null);
            setShowPolicyModal(true);
          }}
          onToggleEnforcement={() => void handleToggleEnforcement()}
          onDismissReceipt={() => setMandateReceipt(null)}
        />
        {pendingPayment ? (
          <PaymentSidebarCard
            data={pendingPayment}
            onChangeOrder={() => {
              dismissStalePayment();
              if (!isLoading) {
                void sendMessage({
                  text: 'I want to change my order before paying. Clear the pending payment, refresh my delivery addresses, then help me update the cart.',
                });
              }
            }}
          />
        ) : null}
        <SidebarHelp capabilityLabels={CAPABILITY_LABELS} docsUrl={agentMeta.docsUrl} />
      </aside>

      <header className="app-header">
        <p className="app-eyebrow">Abstraxn Agent</p>
        <h1 className="app-title">{agentMeta.title}</h1>
        <p className="app-subtitle">{agentMeta.subtitle}</p>
      </header>

      <div className="chat-panel">
          <div className="chat-scroll">
            {messages.length === 0 && (
              <div className="chat-empty">
                <p className="chat-empty-kicker">Ready when you are</p>
                <h2 className="chat-empty-title">What are you craving?</h2>
                <p className="chat-empty-copy">
                  Browse nearby spots, build a draft cart, then pay with UPI —
                  all in this chat.
                </p>
                <div className="chat-empty-prompts">
                  {[
                    'Show my delivery addresses',
                    'Find nearby restaurants',
                    'Search for biryani',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="chat-empty-prompt"
                      disabled={isLoading || !swiggyConnected}
                      onClick={() => {
                        if (isLoading || !swiggyConnected) return;
                        void sendMessage({ text: prompt });
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
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
                      addressesStale={
                        Boolean(latestAddressesMsgId) &&
                        message.id !== latestAddressesMsgId
                      }
                      onPick={(pickText) => {
                        if (isLoading) return;
                        void sendMessage({ text: pickText });
                      }}
                      onAddToDraft={(item) => {
                        dismissStalePayment();
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
              dismissStalePayment();
              void sendMessage({ text: message });
            }}
          />

          <form onSubmit={handleSubmit} className="chat-composer">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                pendingPayment
                  ? "After paying, type: I've paid — or tap Change order"
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

      <footer className="app-footer">
        <span>Swiggy food ordering demo</span>
        <a href={agentMeta.docsUrl} target="_blank" rel="noreferrer">
          Abstraxn MCP docs
        </a>
      </footer>

      {showPolicyModal ? (
        <div className="policy-modal-overlay" role="dialog" aria-modal="true" aria-label="Create warrant mandate">
          <button
            type="button"
            className="policy-modal-scrim"
            aria-label="Close mandate modal"
            onClick={() => setShowPolicyModal(false)}
          />
          <div className="policy-modal-card">
            <div className="policy-modal-head">
              <div className="policy-modal-head-copy">
                <span className="policy-modal-badge">KYI Warrant</span>
                <h3>Create food mandate</h3>
                <p className="policy-modal-lead">
                  Set spend and category rules, then seal. Flip the warrant switch
                  on to enforce them at checkout.
                </p>
                <p className="policy-modal-meta">
                  Agent{' '}
                  <code>{warrantStatus?.agentId ?? 'swiggy_food_agent'}</code>
                </p>
              </div>
              <button
                type="button"
                className="policy-modal-close"
                aria-label="Close"
                onClick={() => setShowPolicyModal(false)}
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            <form className="policy-form" onSubmit={handlePolicySubmit}>
              <label>
                Policy name
                <input
                  value={policyForm.policyName}
                  onChange={(e) =>
                    setPolicyForm((prev) => ({ ...prev, policyName: e.target.value }))
                  }
                  required
                />
              </label>
              <div className="policy-grid">
                <label>
                  Max amount per order (₹)
                  <input
                    type="number"
                    min={1}
                    value={policyForm.amountMaxPerAction}
                    onChange={(e) =>
                      setPolicyForm((prev) => ({
                        ...prev,
                        amountMaxPerAction: e.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  Currency
                  <input
                    value={policyForm.currency}
                    onChange={(e) =>
                      setPolicyForm((prev) => ({ ...prev, currency: e.target.value }))
                    }
                    required
                  />
                </label>
              </div>
              <label>
                Category denylist
                <input
                  value={policyForm.categoryDenylist}
                  onChange={(e) =>
                    setPolicyForm((prev) => ({
                      ...prev,
                      categoryDenylist: e.target.value,
                    }))
                  }
                  placeholder="alcohol,non_veg"
                />
                <span className="policy-field-hint">Comma-separated categories to block</span>
              </label>
              {policyError ? <p className="chat-soft-error">{policyError}</p> : null}
              <div className="policy-form-actions">
                <button
                  type="button"
                  className="policy-cancel-btn"
                  onClick={() => setShowPolicyModal(false)}
                  disabled={policyBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="policy-submit-btn"
                  disabled={policyBusy}
                >
                  {policyBusy ? 'Sealing…' : 'Seal & create mandate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
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

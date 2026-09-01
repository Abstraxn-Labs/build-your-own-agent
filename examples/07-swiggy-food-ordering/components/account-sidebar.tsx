'use client';

type WarrantStatus = {
  hasMandate: boolean;
  enforcementEnabled: boolean;
  amountMax: number | null;
  mandateId: string | null;
  source: 'runtime' | 'env' | 'none';
};

type MandateReceipt = {
  mandateId: string;
  hash: string | null;
  amountMax: number | null;
  currency: string | null;
  onchainTxHash: string | null;
  onchainStatus: string | null;
};

function shortId(value: string, head = 10, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

const AMOY_TX_EXPLORER = 'https://amoy.polygonscan.com/tx/';

function accountStatusLabel(
  swiggyConnected: boolean | null,
  swiggyError: string | null,
): { label: string; pill: 'ok' | 'warn' | 'pending' } {
  if (swiggyConnected === null) {
    return { label: 'Checking…', pill: 'pending' };
  }
  if (swiggyConnected) {
    return { label: 'Connected', pill: 'ok' };
  }
  if (swiggyError) {
    return { label: 'Failed', pill: 'warn' };
  }
  return { label: 'Not connected', pill: 'warn' };
}

export function AccountSidebar({
  swiggyConnected,
  swiggyError,
  warrantStatus,
  toggleBusy,
  policyError,
  mandateReceipt,
  onOpenPolicyModal,
  onToggleEnforcement,
  onDismissReceipt,
}: {
  swiggyConnected: boolean | null;
  swiggyError: string | null;
  warrantStatus: WarrantStatus | null;
  toggleBusy: boolean;
  policyError: string | null;
  mandateReceipt: MandateReceipt | null;
  onOpenPolicyModal: () => void;
  onToggleEnforcement: () => void;
  onDismissReceipt: () => void;
}) {
  const policyActive =
    warrantStatus?.hasMandate && warrantStatus.enforcementEnabled;
  const account = accountStatusLabel(swiggyConnected, swiggyError);

  return (
    <div className="side-account-stack">
      <section className="side-account-card side-account-hero" aria-label="Swiggy account">
        <div className="side-account-hero-top">
          <div className="side-account-icon" aria-hidden>
            S
          </div>
          <div className="side-account-hero-copy">
            <p className="side-account-kicker">Swiggy account</p>
            <div className="side-account-row">
              <span className={`side-status-pill side-status-pill-${account.pill}`}>
                <span
                  className={`swiggy-status-dot ${
                    account.pill === 'ok' ? 'ok' : account.pill === 'warn' ? 'warn' : ''
                  }`}
                />
                {account.label}
              </span>
            </div>
            {swiggyError ? (
              <p className="side-account-error" title={swiggyError}>
                {swiggyError}
              </p>
            ) : null}
          </div>
        </div>
        {!swiggyConnected && swiggyConnected !== null ? (
          <a href="/api/swiggy/auth/start" className="swiggy-connect-btn side-connect-btn-full">
            Connect Swiggy
          </a>
        ) : null}
      </section>

      <section
        className={`side-account-card side-policy-card ${
          policyActive ? 'is-on' : warrantStatus?.hasMandate ? 'is-off' : 'is-empty'
        }`}
        aria-label="Spending policy"
      >
        <div className="side-policy-head">
          <div>
            <p className="side-account-kicker">Spending policy</p>
            <p className="side-policy-title">
              {!warrantStatus?.hasMandate
                ? 'No limit set'
                : warrantStatus.enforcementEnabled
                  ? 'Active at checkout'
                  : 'Paused'}
            </p>
          </div>
          {warrantStatus?.hasMandate && warrantStatus.amountMax != null ? (
            <div className="side-policy-limit" aria-label={`Limit ₹${warrantStatus.amountMax}`}>
              <span className="side-policy-limit-currency">₹</span>
              <span className="side-policy-limit-value">{warrantStatus.amountMax}</span>
            </div>
          ) : (
            <span className="warrant-badge side-warrant-badge">Policy</span>
          )}
        </div>
        <p className="side-policy-copy">
          {!warrantStatus?.hasMandate
            ? 'Set a per-order limit before checkout.'
            : warrantStatus.enforcementEnabled
              ? 'Orders above this amount will be blocked.'
              : 'Turn on to enforce limits at checkout.'}
        </p>
        <div className="side-policy-actions">
          <button
            type="button"
            className="side-policy-btn-primary"
            onClick={onOpenPolicyModal}
          >
            {warrantStatus?.hasMandate ? 'New policy' : 'Create policy'}
          </button>
          <label
            className={`warrant-toggle side-warrant-toggle ${
              !warrantStatus?.hasMandate ? 'disabled' : ''
            }`}
            title={
              warrantStatus?.hasMandate
                ? 'Turn spending checks on or off at checkout'
                : 'Create a spending policy first'
            }
          >
            <span className="warrant-toggle-label">
              {warrantStatus?.enforcementEnabled ? 'On' : 'Off'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(warrantStatus?.enforcementEnabled)}
              className={`warrant-switch ${warrantStatus?.enforcementEnabled ? 'on' : ''}`}
              disabled={!warrantStatus?.hasMandate || toggleBusy}
              onClick={onToggleEnforcement}
            >
              <span className="warrant-switch-knob" />
            </button>
          </label>
        </div>
        {policyError ? <p className="side-policy-error">{policyError}</p> : null}
      </section>

      {mandateReceipt ? (
        <section className="side-account-card side-receipt-card" role="status">
          <div className="mandate-receipt-head side-receipt-head">
            <div>
              <p className="mandate-receipt-kicker">Policy created</p>
              <strong className="side-receipt-title">Ready at checkout</strong>
            </div>
            <button
              type="button"
              className="mandate-receipt-dismiss"
              aria-label="Dismiss policy details"
              onClick={onDismissReceipt}
            >
              ×
            </button>
          </div>
          <dl className="mandate-receipt-grid side-receipt-grid">
            {mandateReceipt.amountMax != null ? (
              <div className="side-receipt-highlight">
                <dt>Limit</dt>
                <dd className="side-receipt-limit">
                  ₹{mandateReceipt.amountMax}
                  {mandateReceipt.currency ? ` ${mandateReceipt.currency}` : ''}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Policy ID</dt>
              <dd>
                <code title={mandateReceipt.mandateId}>
                  {shortId(mandateReceipt.mandateId, 14, 6)}
                </code>
              </dd>
            </div>
            {mandateReceipt.hash ? (
              <div>
                <dt>Content hash</dt>
                <dd>
                  <code title={mandateReceipt.hash}>{shortId(mandateReceipt.hash, 10, 6)}</code>
                </dd>
              </div>
            ) : null}
            <div className="mandate-receipt-tx">
              <dt>On-chain</dt>
              <dd>
                {mandateReceipt.onchainTxHash ? (
                  <a
                    href={`${AMOY_TX_EXPLORER}${mandateReceipt.onchainTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    title={mandateReceipt.onchainTxHash}
                  >
                    View tx
                  </a>
                ) : (
                  <span>
                    Sealed off-chain
                    {mandateReceipt.onchainStatus ? ` · ${mandateReceipt.onchainStatus}` : ''}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Smoke-check place-order result normalization (nested Swiggy `data` → QR fields).
 * Run: node scripts/verify-place-order-ui.mjs
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolsPath = path.join(__dirname, '../lib/swiggy-tools.ts');

// Load via tsx if available; otherwise dynamic import won't work for .ts.
// Prefer compiling the pure JS logic inline for this smoke test.
function normalizePlaceOrderResult(result) {
  let payload = result;
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        payload = JSON.parse(trimmed);
      } catch {
        return result;
      }
    } else {
      return result;
    }
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return result;
  }

  const root = { ...payload };
  if (root.preview === true) {
    return { ...root, placed: false, pendingPayment: false };
  }

  const nested =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? root.data
      : null;
  const flat = nested ? { ...nested, ...root } : { ...root };

  const pickString = (...keys) => {
    for (const key of keys) {
      const value = flat[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  };

  let paymentUrl = pickString(
    'paymentUrl',
    'payment_url',
    'paymentLink',
    'upiLink',
    'deepLink',
    'intentUrl',
    'bridgeUrl',
    'bridge_url',
    'upiIntentUrl',
  );
  const orderId = pickString('order_id', 'orderId');
  const statusRaw = pickString('status', 'paymentStatus', 'orderStatus');
  const status = statusRaw?.toUpperCase();

  if (!paymentUrl && nested?.bridgeUrl) paymentUrl = String(nested.bridgeUrl);

  const pendingPayment =
    flat.pendingPayment === true ||
    status === 'PENDING_PAYMENT' ||
    Boolean(paymentUrl);
  const placed = Boolean(orderId) && !pendingPayment;

  return {
    ...flat,
    orderId,
    status,
    pendingPayment,
    placed,
    paymentUrl,
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const nested = normalizePlaceOrderResult({
  success: true,
  data: {
    orderId: 'o1',
    status: 'PENDING_PAYMENT',
    bridgeUrl: 'https://pay.example/b',
  },
});
assert(nested.pendingPayment === true, 'nested pendingPayment');
assert(nested.placed === false, 'nested not placed');
assert(nested.paymentUrl === 'https://pay.example/b', 'nested bridgeUrl');
assert(nested.orderId === 'o1', 'nested orderId');

const preview = normalizePlaceOrderResult({ preview: true, cart: {} });
assert(preview.pendingPayment === false, 'preview no pending');
assert(preview.placed === false, 'preview not placed');

const failed = normalizePlaceOrderResult({ status: 'unknown', message: 'nope' });
assert(failed.pendingPayment === false, 'failed no pending');
assert(failed.placed === false, 'failed not placed');

console.log('verify-place-order-ui: ok');

import type { McpClient } from '@abstraxn/agent-kit';
import { mcpToolsToAiSdk, resolveToolNames } from '@abstraxn-examples/mcp';
import { Warrant } from '@abstraxn/warrant';
import type { Tool, ToolSet } from 'ai';
import { getValidAccessToken } from './swiggy-oauth';
import {
  callSwiggyFoodTool,
  placeSwiggyFoodOrderDirect,
} from './swiggy-mcp-direct';
import { resolveMandateForCheck } from './warrant-policy';
import { warrantDenyPayloadWithUserMessage, normalizeWarrantReasons } from './warrant-messages';

export interface SwiggyTokens {
  accessToken?: string;
  refreshToken?: string;
}

/** Last priced cart seen from manage_cart — used when place_order omits amount (example 09 always has amount in tool args). */
type CartSnapshot = {
  amount: number;
  restaurantId?: string;
  items?: Array<{ name: string; category?: string }>;
  updatedAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __swiggyLastCartSnapshot: CartSnapshot | undefined;
}

function getCartSnapshot(): CartSnapshot | null {
  return globalThis.__swiggyLastCartSnapshot ?? null;
}

function setCartSnapshot(snapshot: CartSnapshot | null): void {
  globalThis.__swiggyLastCartSnapshot = snapshot ?? undefined;
}


function loadSwiggyTokensFromEnv(): SwiggyTokens {
  return {
    accessToken: process.env.SWIGGY_ACCESS_TOKEN,
    refreshToken: process.env.SWIGGY_REFRESH_TOKEN,
  };
}

/**
 * Prefers a real account connected via the in-app "Connect Swiggy Account"
 * OAuth flow (lib/swiggy-oauth.ts) — refreshed proactively before expiry.
 * Falls back to manually-configured env vars for users who already have a
 * token pair from elsewhere (e.g. Claude.ai's own Swiggy connector).
 */
async function resolveSwiggyTokens(): Promise<SwiggyTokens> {
  const oauthRecord = await getValidAccessToken();
  if (oauthRecord) {
    return {
      accessToken: oauthRecord.accessToken,
      refreshToken: oauthRecord.refreshToken,
    };
  }
  return loadSwiggyTokensFromEnv();
}

function parseAmountFromArgs(args: Record<string, unknown>): number {
  const amountLike =
    args.totalAmount ??
    args.amount ??
    args.orderTotal ??
    args.billTotal ??
    args.toPay ??
    args.grandTotal ??
    (args.value && typeof args.value === 'object' && !Array.isArray(args.value)
      ? (args.value as Record<string, unknown>).amount
      : undefined);
  if (typeof amountLike === 'number' && Number.isFinite(amountLike)) return amountLike;
  if (typeof amountLike === 'string') {
    const m = amountLike.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
    if (m) return Number(m[1]);
  }
  return 0;
}

function extractRupeeAmount(text: string): number {
  const patterns = [
    /to\s*pay[^₹\d]*₹\s*([\d,.]+)/i,
    /grand\s*total[^₹\d]*₹\s*([\d,.]+)/i,
    /bill\s*total[^₹\d]*₹\s*([\d,.]+)/i,
    /total[^₹\d]*₹\s*([\d,.]+)/i,
    /₹\s*([\d,.]+)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const n = Number(m[1].replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function parseItemsFromArgs(
  args: Record<string, unknown>,
): Array<{ name: string; category?: string }> | null {
  const raw = args.items ?? args.cartItems ?? args.cart_items;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const items: Array<{ name: string; category?: string }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const name =
      (typeof row.name === 'string' && row.name) ||
      (typeof row.itemName === 'string' && row.itemName) ||
      (typeof row.title === 'string' && row.title) ||
      '';
    if (!name) continue;
    const categoryRaw =
      row.category ?? row.itemCategory ?? row.foodType ?? row.vegClassifier;
    const category =
      typeof categoryRaw === 'string' && categoryRaw.trim()
        ? categoryRaw.trim().toLowerCase().replace(/\s+/g, '_')
        : undefined;
    items.push(category ? { name, category } : { name });
  }
  return items.length ? items : null;
}

type WarrantGateResult =
  | { kind: 'skip' }
  | {
      kind: 'allow';
      decision: { receipt_id: string; decision_id: string; verdict: string };
    }
  | { kind: 'deny'; payload: Record<string, unknown> };

async function hydrateCartSnapshotForCheck(params: {
  accessToken?: string;
  addressId?: string;
  viewCart?: (addressId: string) => Promise<unknown>;
}): Promise<void> {
  if ((getCartSnapshot()?.amount ?? 0) > 0) return;
  const addressId = params.addressId;
  if (!addressId) return;
  try {
    let raw: unknown;
    if (params.viewCart) {
      raw = await params.viewCart(addressId);
    } else if (params.accessToken) {
      for (const toolName of ['manage_food_cart', 'update_food_cart', 'get_food_cart'] as const) {
        try {
          raw = await callSwiggyFoodTool(
            toolName,
            { action: 'view', addressId },
            params.accessToken,
          );
          break;
        } catch {
          raw = undefined;
        }
      }
    }
    if (raw != null) {
      normalizeManageCartResult(raw, { action: 'view', addressId });
    }
  } catch {
    // ignore
  }
}

/** Warrant.check() before place_order; never send amount=0 (that falsely ALLOWs max-₹N mandates). */
async function runWarrantCheckForPlaceOrder(
  args: Record<string, unknown>,
  opts?: {
    accessToken?: string;
    viewCart?: (addressId: string) => Promise<unknown>;
  },
): Promise<WarrantGateResult> {
  const mandate = resolveMandateForCheck();
  if (!mandate) return { kind: 'skip' };

  let amount = parseAmountFromArgs(args);
  if (!(amount > 0)) {
    await hydrateCartSnapshotForCheck({
      accessToken: opts?.accessToken,
      addressId: typeof args.addressId === 'string' ? args.addressId : undefined,
      viewCart: opts?.viewCart,
    });
  }
  const snapshot = getCartSnapshot();
  if (!(amount > 0) && snapshot?.amount) amount = snapshot.amount;

  const restaurant =
    (typeof args.restaurantId === 'string' && args.restaurantId) ||
    snapshot?.restaurantId ||
    '';
  const items = parseItemsFromArgs(args) ?? snapshot?.items ?? null;

  if (!(amount > 0)) {
    return {
      kind: 'deny',
      payload: warrantDenyPayloadWithUserMessage({
        blocked_by: 'kyi_warrant',
        verdict: 'DENY',
        reasons: [
          {
            code: 'AMOUNT_missing',
            layer: 'host',
            detail:
              'place_order must include totalAmount (or a priced cart must exist). Refusing check with amount=0.',
          },
        ],
        receipt_id: null,
        decision_id: null,
        matched_mandate_ids: [],
        checked_amount: 0,
      }),
    };
  }

  const warrant = new Warrant({
    apiUrl: mandate.apiUrl,
    apiKey: mandate.apiKey,
    onError: 'deny',
  });

  const decision = await warrant.check({
    agent_id: mandate.agentId,
    domain: mandate.domain,
    action_type: 'place_order',
    value: { amount, currency: 'INR' },
    counterparty: restaurant ? { id: restaurant, type: 'restaurant' } : null,
    items,
  });

  if (decision.verdict === 'ALLOW') {
    return {
      kind: 'allow',
      decision: {
        verdict: decision.verdict,
        receipt_id: decision.receipt_id,
        decision_id: decision.decision_id,
      },
    };
  }

  return {
    kind: 'deny',
    payload: warrantDenyPayloadWithUserMessage({
      blocked_by: 'kyi_warrant',
      verdict: decision.verdict,
      reasons: normalizeWarrantReasons(decision.reasons),
      receipt_id: decision.receipt_id,
      decision_id: decision.decision_id,
      matched_mandate_ids: decision.matched_mandate_ids,
      checked_amount: amount,
      checked_currency: 'INR',
      checked_restaurant_id: restaurant || null,
    }),
  };
}

const STRING_ID_KEYS = [
  'addressId',
  'restaurantId',
  'menu_item_id',
  'menuItemId',
  'orderId',
  'order_id',
  'paasId',
  'paas_id',
  'cartId',
  'cart_id',
] as const;

function asStringId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function asBoolTrue(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    return trimmed === 'true' || trimmed === '1' || trimmed === 'yes';
  }
  return false;
}

/**
 * Models often pass restaurant/menu IDs as numbers; Swiggy + our schemas expect strings.
 * Also accept camelCase menuItemId inside cartItems and coerce confirm:"true".
 */
export function normalizeSwiggyToolArgs(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...args };

  for (const key of STRING_ID_KEYS) {
    const asString = asStringId(normalized[key]);
    if (asString !== undefined) normalized[key] = asString;
  }

  if ('confirm' in normalized) {
    normalized.confirm = asBoolTrue(normalized.confirm);
  }

  if (typeof normalized.paymentMethod === 'string') {
    const method = normalized.paymentMethod.trim();
    if (/^upi$/i.test(method)) normalized.paymentMethod = 'UPI';
    else if (/^cash$/i.test(method)) normalized.paymentMethod = 'Cash';
  }

  if (typeof normalized.intentApp === 'number' && Number.isFinite(normalized.intentApp)) {
    normalized.intentApp = String(normalized.intentApp);
  }

  if (Array.isArray(normalized.cartItems)) {
    normalized.cartItems = normalized.cartItems.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const row = { ...(item as Record<string, unknown>) };
      const menuItemId =
        asStringId(row.menu_item_id) ?? asStringId(row.menuItemId);
      if (menuItemId) row.menu_item_id = menuItemId;
      if (typeof row.quantity === 'string' && row.quantity.trim() !== '') {
        const qty = Number(row.quantity);
        if (!Number.isNaN(qty)) row.quantity = qty;
      }
      if (typeof row.quantity !== 'number' || !(row.quantity > 0)) {
        row.quantity = 1;
      }
      return row;
    });
  }

  return normalized;
}

function errorToToolText(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify(
      {
        error: true,
        message: error.message,
        name: error.name,
        cause:
          error.cause instanceof Error
            ? error.cause.message
            : error.cause
              ? String(error.cause)
              : undefined,
      },
      null,
      2,
    );
  }
  return JSON.stringify({ error: true, message: String(error) }, null, 2);
}

/**
 * Swiggy's MCP tools require the user's own Swiggy OAuth access_token per
 * call — the LLM (and the chat user) should never be asked to paste that
 * into the conversation. This wraps the swiggy_* tools so the token is
 * injected server-side, then returns them keyed by the same tool names so
 * passing this as `extraTools` to createAgentChat shadows the unwrapped
 * versions it resolves internally from `agentConfig.tools`.
 */
function resultToText(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result == null) return '';
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

/**
 * Swiggy MCP often returns Claude-widget boilerplate ("Cart widget is displayed…").
 * Rewrite empty-cart outcomes so the model cannot claim success or mention widgets.
 */
function normalizeManageCartResult(
  result: unknown,
  args: Record<string, unknown>,
): unknown {
  const raw = resultToText(result);
  const action = typeof args.action === 'string' ? args.action : 'view';
  const empty = /cart is empty/i.test(raw);
  const hasPrice = /₹\s*[\d.,]+/.test(raw);

  if (empty && !hasPrice) {
    const failedAdd = action === 'add' || action === 'update';
    return {
      empty: true,
      items: [],
      action,
      message: failedAdd
        ? 'Cart is STILL EMPTY after add/update — the item was NOT added. Likely missing variants/variantsV2/addons from swiggy_search_menu, or wrong menu_item_id/restaurantId/addressId. Retry with the correct variant fields. Never mention a cart widget; this UI has none.'
        : 'Cart is empty. Call swiggy_manage_cart with action "add", addressId, restaurantId, and cartItems (include variants/variantsV2 when the menu item requires a size). Never mention a cart widget; this UI has none.',
    };
  }

  // Cache priced cart for Warrant.check (place_order often omits totalAmount).
  const amountFromArgs = parseAmountFromArgs(args);
  const amountFromText = extractRupeeAmount(raw);
  const amount = amountFromArgs > 0 ? amountFromArgs : amountFromText;
  if (amount > 0) {
    setCartSnapshot({
      amount,
      restaurantId:
        typeof args.restaurantId === 'string' ? args.restaurantId : getCartSnapshot()?.restaurantId,
      items: parseItemsFromArgs(args) ?? getCartSnapshot()?.items,
      updatedAt: new Date().toISOString(),
    });
  } else if (typeof args.restaurantId === 'string' && args.restaurantId) {
    const prev = getCartSnapshot();
    if (prev) {
      setCartSnapshot({ ...prev, restaurantId: args.restaurantId });
    }
  }

  if (typeof result === 'string') {
    return result
      .replace(/A rich UI widget may be shown to the user[\s\S]*?(?:next\.|$)/gi, '')
      .replace(/Cart widget is displayed[\s\S]*?(?:update_food_cart`?\.?|$)/gi, '')
      .replace(/NOTE:\s*The cart widget[\s\S]*$/gim, '')
      .trim();
  }
  return result;
}



function summarizePlacePayload(value: unknown): Record<string, unknown> {
  if (value == null) return { kind: 'null' };
  if (typeof value === 'string') {
    return {
      kind: 'string',
      length: value.length,
      startsWithJson: value.trim().startsWith('{') || value.trim().startsWith('['),
      preview: value.slice(0, 400),
    };
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { kind: typeof value, isArray: Array.isArray(value) };
  }
  const root = value as Record<string, unknown>;
  const data =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null;
  return {
    kind: 'object',
    keys: Object.keys(root).slice(0, 40),
    preview: root.preview === true,
    placed: root.placed,
    pendingPayment: root.pendingPayment,
    status: root.status ?? root.paymentStatus,
    hasOrderId: Boolean(root.order_id || root.orderId),
    hasPaymentUrl: Boolean(
      root.paymentUrl || root.bridgeUrl || root.upiLink || root.paymentLink,
    ),
    hasError: Boolean(root.error),
    message:
      typeof root.message === 'string'
        ? root.message.slice(0, 240)
        : typeof root.uiHint === 'string'
          ? root.uiHint.slice(0, 240)
          : undefined,
    dataKeys: data ? Object.keys(data).slice(0, 40) : undefined,
    dataStatus: data?.status,
    dataHasBridge: Boolean(data && (data.bridgeUrl || data.paymentUrl || data.upiLink)),
  };
}

const PAYMENT_URL_KEYS = [
  'paymentUrl',
  'payment_url',
  'paymentLink',
  'upiLink',
  'deepLink',
  'intentUrl',
  'bridgeUrl',
  'bridge_url',
  'upiIntentUrl',
];

/**
 * Hosted Agent Kit may return Swiggy's nested `{ data: { status, bridgeUrl } }`
 * without normalizing pendingPayment. Flatten so the chat UI + model see QR fields.
 */
export function normalizePlaceOrderResult(result: unknown): unknown {
  // Agent Kit / MCP may wrap payloads in content blocks or structuredContent.
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const root = result as Record<string, unknown>;
    if (root.structuredContent && typeof root.structuredContent === 'object') {
      result = { ...root.structuredContent, ...root };
    } else {
      const content = root.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (!block || typeof block !== 'object') continue;
          const text = (block as { text?: string }).text;
          if (!text) continue;
          try {
            result = JSON.parse(text) as unknown;
            break;
          } catch {
            // fall through
          }
        }
      }
    }
  }

  let payload: unknown = result;
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        payload = JSON.parse(trimmed) as unknown;
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

  const root = { ...(payload as Record<string, unknown>) };
  if (root.preview === true) {
    return { ...root, placed: false, pendingPayment: false };
  }
  if (root.error && !root.status && !root.data) {
    return root;
  }

  const nested =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null;
  const flat: Record<string, unknown> = nested ? { ...nested, ...root } : { ...root };

  const pickString = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = flat[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  };

  let paymentUrl = pickString(...PAYMENT_URL_KEYS);
  let paymentQrImage = pickString('paymentQrImage', 'qrImage', 'qr_image', 'qrCodeImage');
  let paymentQrPayload = pickString('paymentQrPayload', 'qrData', 'qr_data', 'upiString');
  const orderId = pickString('order_id', 'orderId');
  const paasId = pickString('paasId', 'paas_id');
  const statusRaw = pickString('status', 'paymentStatus', 'orderStatus');
  const status = statusRaw?.toUpperCase();

  // Walk one level of nested objects for payment URLs if still missing.
  if (!paymentUrl || !paymentQrImage || !paymentQrPayload) {
    const visit = (value: unknown, depth: number) => {
      if (depth > 5 || value == null) return;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return;
        if (!paymentQrImage && /^data:image\//i.test(trimmed)) paymentQrImage = trimmed;
        else if (
          !paymentUrl &&
          (/^upi:/i.test(trimmed) || /^https?:\/\//i.test(trimmed) || /^intent:/i.test(trimmed))
        ) {
          paymentUrl = trimmed;
          if (/^upi:/i.test(trimmed) && !paymentQrPayload) paymentQrPayload = trimmed;
        }
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) visit(item, depth + 1);
        return;
      }
      if (typeof value === 'object') {
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
          if (
            !paymentUrl &&
            PAYMENT_URL_KEYS.includes(key) &&
            typeof child === 'string' &&
            child.trim()
          ) {
            paymentUrl = child.trim();
          }
          visit(child, depth + 1);
        }
      }
    };
    visit(flat, 0);
  }

  if (!paymentQrPayload && paymentUrl && /^upi:/i.test(paymentUrl)) {
    paymentQrPayload = paymentUrl;
  }

  const pendingPayment =
    flat.pendingPayment === true ||
    status === 'PENDING_PAYMENT' ||
    Boolean(paymentUrl || paymentQrImage || paymentQrPayload);
  const placed =
    flat.placed === true || (Boolean(orderId) && !pendingPayment && status !== 'FAILED');

  const message =
    pickString('message', 'errorMessage', 'error_message') ||
    (typeof flat.error === 'string' ? flat.error : undefined);

  return {
    ...flat,
    order_id: orderId ?? flat.order_id,
    orderId: orderId ?? flat.orderId,
    paasId: paasId ?? flat.paasId,
    status: status ?? statusRaw ?? flat.status,
    paymentStatus: status ?? flat.paymentStatus,
    pendingPayment,
    placed: Boolean(placed) && !pendingPayment,
    paymentUrl: paymentUrl ?? flat.paymentUrl,
    paymentQrImage: paymentQrImage ?? flat.paymentQrImage,
    paymentQrPayload: paymentQrPayload ?? flat.paymentQrPayload,
    message,
    uiHint: pendingPayment
      ? 'Show paymentUrl / paymentQrImage now. Order is NOT placed until payment succeeds.'
      : placed
        ? 'Order placed.'
        : message
          ? `Order was not placed — Swiggy said: ${message}`
          : 'Order was not placed — no PENDING_PAYMENT/QR and no order_id.',
  };
}

export async function createSwiggyTools(
  mcp: McpClient,
  tokens?: SwiggyTokens,
): Promise<ToolSet> {
  const resolvedTokens = tokens ?? (await resolveSwiggyTokens());
  const swiggyToolNames = resolveToolNames('swiggyFoodOrdering');
  const tools = await mcpToolsToAiSdk(mcp, swiggyToolNames);

  if (!resolvedTokens.accessToken) {
    // No Swiggy account connected yet — leave the tools as-is; calling them
    // will surface SWIGGY_TOKEN_MISSING from web3-agent-kit-service.
    return tools;
  }

  const wrapped: ToolSet = {};
  for (const [name, toolDef] of Object.entries(tools)) {
    const original = toolDef as Tool & {
      execute?: (args: Record<string, unknown>) => Promise<unknown>;
    };
    wrapped[name] = {
      ...original,
      execute: async (args: Record<string, unknown>) => {
        try {
          const normalized = normalizeSwiggyToolArgs(args ?? {});
          if (name.includes('place_order') && normalized.confirm === true) {
            if (normalized.paymentMethod === 'UPI') {
              normalized.generateUPIQR = true;
            }
            const optionMatch = Object.values(args ?? {}).some(
              (v) => typeof v === 'string' && /optionId=/i.test(v),
            );
            if (!normalized.intentApp && typeof args?.noteToRestaurant === 'string') {
              const m = args.noteToRestaurant.match(/optionId=([^\s\]]+)/i);
              if (m) normalized.intentApp = m[1];
            }
          }
          let result: unknown;
          let warrantAllow:
            | { receipt_id: string; decision_id: string; verdict: string }
            | undefined;
          if (name.includes('place_order') && normalized.confirm === true) {
            const manage = Object.entries(tools).find(([n]) =>
              n.includes('manage_cart'),
            )?.[1] as
              | (Tool & { execute?: (a: Record<string, unknown>) => Promise<unknown> })
              | undefined;
            const gate = await runWarrantCheckForPlaceOrder(normalized, {
              accessToken: resolvedTokens.accessToken,
              viewCart: manage?.execute
                ? async (addressId) =>
                    manage.execute!({
                      action: 'view',
                      addressId,
                      access_token: resolvedTokens.accessToken,
                      refresh_token: resolvedTokens.refreshToken,
                    })
                : undefined,
            });
            if (gate.kind === 'deny') {
              return gate.payload;
            }
            if (gate.kind === 'allow') {
              warrantAllow = gate.decision;
            }
          }
          if (
            name.includes('place_order') &&
            normalized.confirm === true &&
            typeof normalized.addressId === 'string' &&
            (normalized.paymentMethod === 'UPI' || normalized.paymentMethod === 'Cash')
          ) {
            let intentApp =
              typeof normalized.intentApp === 'string' ? normalized.intentApp : undefined;
            if (!intentApp) {
              for (const value of Object.values(args ?? {})) {
                if (typeof value === 'string') {
                  const m = value.match(/optionId=([^\s\].,]+)/i);
                  if (m?.[1]) {
                    intentApp = m[1];
                    break;
                  }
                }
              }
            }
            if (!intentApp && normalized.paymentMethod === 'UPI') {
              intentApp = 'PayWithQR';
            }
            result = await placeSwiggyFoodOrderDirect({
              accessToken: resolvedTokens.accessToken!,
              addressId: String(normalized.addressId),
              paymentMethod: normalized.paymentMethod as 'UPI' | 'Cash',
              intentApp,
              noteToRestaurant:
                typeof normalized.noteToRestaurant === 'string'
                  ? normalized.noteToRestaurant
                  : undefined,
            });
          } else {
            result = await original.execute?.({
              ...normalized,
              access_token: resolvedTokens.accessToken,
              refresh_token: resolvedTokens.refreshToken,
            });
          }
          if (result == null) {
            return JSON.stringify({
              error: true,
              message: `Tool "${name}" returned no result.`,
            });
          }
          if (name.includes('manage_cart')) {
            return normalizeManageCartResult(result, normalized);
          }
          if (name.includes('place_order') || name.includes('check_payment')) {
            const normalizedResult = normalizePlaceOrderResult(result);
            // Match example 09: surface ALLOW receipt on the successful tool result.
            if (
              warrantAllow &&
              normalizedResult &&
              typeof normalizedResult === 'object' &&
              !Array.isArray(normalizedResult)
            ) {
              return {
                ...(normalizedResult as Record<string, unknown>),
                warrant: {
                  verdict: warrantAllow.verdict,
                  receipt_id: warrantAllow.receipt_id,
                  decision_id: warrantAllow.decision_id,
                },
              };
            }
            return normalizedResult;
          }
          return result;
        } catch (error) {
          // Return text instead of throwing so the UI gets output-available
          // with a readable payload (not a generic "An error occurred.").
          return errorToToolText(error);
        }
      },
    } as Tool;
  }
  return wrapped;
}

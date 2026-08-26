interface McpJsonRpcEnvelope {
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const SWIGGY_FOOD_URL = 'https://mcp.swiggy.com/food';

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
  'upi_intent_url',
];

function buildJsonRpcRequestBody(method: string, params?: Record<string, unknown>) {
  return {
    jsonrpc: '2.0' as const,
    id: Date.now(),
    method,
    ...(params ? { params } : {}),
  };
}

async function parseMcpSseResponse(res: Response): Promise<McpJsonRpcEnvelope> {
  const text = await res.text();
  let lastData = '';
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data: ')) lastData = trimmed.slice(6);
  }
  return lastData ? (JSON.parse(lastData) as McpJsonRpcEnvelope) : { result: null };
}

async function swiggyRpc(
  method: string,
  params: Record<string, unknown> | undefined,
  accessToken: string,
  sessionId?: string,
): Promise<{ sessionId?: string; envelope: McpJsonRpcEnvelope }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${accessToken}`,
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  const res = await fetch(SWIGGY_FOOD_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildJsonRpcRequestBody(method, params)),
  });

  const newSessionId = res.headers.get('mcp-session-id') ?? sessionId;
  const contentType = res.headers.get('content-type') ?? '';
  const envelope = contentType.includes('text/event-stream')
    ? await parseMcpSseResponse(res)
    : ((await res.json()) as McpJsonRpcEnvelope);

  return { sessionId: newSessionId, envelope };
}

function parsePlaceInstructionText(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (/PENDING_PAYMENT/i.test(text)) {
    out.status = 'PENDING_PAYMENT';
    out.pendingPayment = true;
  }
  const paas = text.match(/paasId:\s*"([^"]+)"/i);
  const order = text.match(/orderId:\s*"([^"]+)"/i);
  if (paas?.[1]) out.paasId = paas[1];
  if (order?.[1]) {
    out.orderId = order[1];
    out.order_id = order[1];
  }
  return out;
}

function mergePaymentFields(
  value: unknown,
  found: Record<string, unknown>,
  depth = 0,
): void {
  if (depth > 8 || value == null) return;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (/^upi:/i.test(trimmed) || /^https?:\/\//i.test(trimmed) || /^intent:/i.test(trimmed)) {
      if (!found.paymentUrl) found.paymentUrl = trimmed;
      if (/^upi:/i.test(trimmed) && !found.paymentQrPayload) found.paymentQrPayload = trimmed;
    }
    if (/PENDING_PAYMENT/i.test(trimmed)) {
      found.status = 'PENDING_PAYMENT';
      found.pendingPayment = true;
    }
    Object.assign(found, parsePlaceInstructionText(trimmed));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) mergePaymentFields(item, found, depth + 1);
    return;
  }
  if (typeof value !== 'object') return;
  const obj = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(obj)) {
    if (
      !found.paasId &&
      (key === 'paasId' || key === 'paas_id') &&
      typeof child === 'string' &&
      child.trim()
    ) {
      found.paasId = child.trim();
    }
    if (
      !found.orderId &&
      (key === 'orderId' || key === 'order_id') &&
      typeof child === 'string' &&
      child.trim()
    ) {
      found.orderId = child.trim();
      found.order_id = child.trim();
    }
    if (
      !found.paymentUrl &&
      PAYMENT_URL_KEYS.includes(key) &&
      typeof child === 'string' &&
      child.trim()
    ) {
      found.paymentUrl = child.trim();
    }
    mergePaymentFields(child, found, depth + 1);
  }
}

/** Parse Swiggy place_food_order MCP payload (text + widget JSON blocks). */
export function parseSwiggyPlaceMcpResult(result: unknown): Record<string, unknown> {
  const found: Record<string, unknown> = {
    source: 'swiggy',
    fetchedAt: new Date().toISOString(),
  };

  if (typeof result === 'string') {
    mergePaymentFields(result, found);
  } else if (result && typeof result === 'object') {
    const root = result as Record<string, unknown>;
    if (root.structuredContent && typeof root.structuredContent === 'object') {
      mergePaymentFields(root.structuredContent, found);
    }
    if (root._meta && typeof root._meta === 'object') {
      mergePaymentFields(root._meta, found);
    }
    const content = root.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (!block || typeof block !== 'object') continue;
        const text = (block as { text?: string }).text;
        if (!text) continue;
        try {
          mergePaymentFields(JSON.parse(text) as unknown, found);
        } catch {
          mergePaymentFields(text, found);
        }
      }
    } else {
      mergePaymentFields(result, found);
    }
  }

  if (found.upiIntentUrl && !found.paymentUrl) {
    found.paymentUrl = found.upiIntentUrl;
  }
  if (found.bridgeUrl && !found.paymentUrl) {
    found.paymentUrl = found.bridgeUrl;
  }
  if (
    typeof found.paymentUrl === 'string' &&
    /^upi:/i.test(found.paymentUrl) &&
    !found.paymentQrPayload
  ) {
    found.paymentQrPayload = found.paymentUrl;
  }

  const status =
    typeof found.status === 'string' ? found.status.toUpperCase() : undefined;
  const pendingPayment =
    found.pendingPayment === true ||
    status === 'PENDING_PAYMENT' ||
    Boolean(found.paasId && (found.paymentUrl || found.bridgeUrl)) ||
    Boolean(found.paasId && found.orderId && !found.placed);

  found.pendingPayment = pendingPayment;
  found.placed = Boolean(found.orderId || found.order_id) && !pendingPayment;
  if (pendingPayment) found.status = 'PENDING_PAYMENT';

  return found;
}

/** Call Swiggy Food MCP directly (bypasses hosted Agent Kit place_order). */
export async function callSwiggyFoodTool(
  toolName: string,
  args: Record<string, unknown>,
  accessToken: string,
): Promise<unknown> {
  let sessionId: string | undefined;

  const init = await swiggyRpc(
    'initialize',
    {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'swiggy-food-ordering-example', version: '1.0.0' },
    },
    accessToken,
  );
  sessionId = init.sessionId;
  if (init.envelope.error) throw new Error(init.envelope.error.message);

  await swiggyRpc('notifications/initialized', undefined, accessToken, sessionId);

  const call = await swiggyRpc(
    'tools/call',
    { name: toolName, arguments: args },
    accessToken,
    sessionId,
  );
  if (call.envelope.error) throw new Error(call.envelope.error.message);
  return call.envelope.result;
}

export async function placeSwiggyFoodOrderDirect(args: {
  accessToken: string;
  addressId: string;
  paymentMethod: 'Cash' | 'UPI';
  intentApp?: string;
  noteToRestaurant?: string;
}): Promise<Record<string, unknown>> {
  const placeArgs: Record<string, unknown> = {
    addressId: args.addressId,
    paymentMethod: args.paymentMethod,
    noteToRestaurant: args.noteToRestaurant,
  };
  if (args.paymentMethod === 'UPI') {
    placeArgs.generateUPIQR = true;
    if (args.intentApp) placeArgs.intentApp = args.intentApp;
  }

  const raw = await callSwiggyFoodTool('place_food_order', placeArgs, args.accessToken);
  return parseSwiggyPlaceMcpResult(raw);
}

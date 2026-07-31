import type { PaymentRequired } from '@x402/core/types';
import { agentConfig } from '@/lib/agent';
import { createMcpFromBootstrap, getOrCreateSession } from '@/lib/session';
import { retryPaidTool } from '@/lib/paid-tools';
import { checkUsdcBalance, signOpenWebNinjaPayment } from '@/lib/x402-signing';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Lets the UI show the demo agent's wallet address (for funding) without a new route. */
export async function GET() {
  const session = await getOrCreateSession({
    name: agentConfig.name,
    description: agentConfig.system.slice(0, 120),
  });
  return Response.json({ evmAddress: session.evmAddress ?? null });
}

interface PayRequestBody {
  toolName: string;
  args: Record<string, unknown>;
  paymentRequired: PaymentRequired;
}

/**
 * Stateless confirm-and-pay endpoint. The browser sends back everything it already has
 * (toolName/args/paymentRequired came straight from the chat tool-call result) — no
 * server-side pending-payment storage needed. Only reachable by an explicit user click,
 * never called automatically by the chat loop.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as PayRequestBody;

  if (!body?.toolName || !body.paymentRequired) {
    return Response.json({ ok: false, error: { message: 'toolName and paymentRequired are required.' } }, { status: 400 });
  }

  const session = await getOrCreateSession({
    name: agentConfig.name,
    description: agentConfig.system.slice(0, 120),
  });

  const accepts = body.paymentRequired.accepts;
  if (!Array.isArray(accepts) || accepts.length === 0) {
    return Response.json({ ok: false, error: { message: 'paymentRequired has no accepts[].' } }, { status: 400 });
  }

  console.log('[api/pay] paymentRequired.accepts[0]:\n' + JSON.stringify(accepts[0], null, 2));

  const balanceError = await checkUsdcBalance(session, accepts[0]!);
  if (balanceError) {
    return Response.json({ ok: false, error: balanceError }, { status: 402 });
  }

  try {
    const paymentPayload = await signOpenWebNinjaPayment(session, body.paymentRequired);
    console.log('[api/pay] signed paymentPayload:\n' + JSON.stringify(paymentPayload, null, 2));

    const mcp = createMcpFromBootstrap(session);
    console.log(
      '[api/pay] calling tool via MCP:\n' +
        JSON.stringify({ toolName: body.toolName, agentKitApiUrl: session.env.ABSTRAXN_AGENT_KIT_API_URL }, null, 2),
    );

    const outcome = await retryPaidTool(mcp, body.toolName, body.args ?? {}, paymentPayload);
    console.log('[api/pay] retryPaidTool outcome:\n' + JSON.stringify(outcome, null, 2));

    if (!outcome.ok) {
      return Response.json({ ok: false, error: outcome.error }, { status: 502 });
    }
    return Response.json({ ok: true, result: outcome.result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/pay] threw before/around retryPaidTool:', err);
    return Response.json({ ok: false, error: { message } }, { status: 500 });
  }
}

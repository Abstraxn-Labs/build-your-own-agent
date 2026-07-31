/**
 * Standalone repro of the /api/pay flow, run outside Next.js so every step's raw
 * response is visible on stdout — including the full JSON-RPC error `data` blob that
 * the UI/route normally trims away.
 *
 * Run from this example's directory:
 *   node --experimental-strip-types scripts/debug-pay-flow.ts [toolName] [queryArg]
 *
 * Defaults to `openweb_ninja_social_links_search` with query "Elon Musk" (matches the
 * tool shown in the screenshot). Loads env the same way next.config.ts does
 * (monorepo-root .env), so it exercises whatever ABSTRAXN_AGENT_KIT_API_URL /
 * CDP_API_KEY_ID / CDP_API_KEY_SECRET are actually configured server-side.
 */
import fs from 'node:fs';
import path from 'node:path';

function loadRootEnv() {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('pnpm-workspace.yaml not found — run this from the example directory');
    dir = parent;
  }
  const envPath = path.join(dir, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadRootEnv();

const { bootstrapAgent, createMcpFromBootstrap } = await import('@abstraxn-examples/core');
const { callPaidTool, retryPaidTool } = await import('../lib/paid-tools.js');
const { signOpenWebNinjaPayment, checkUsdcBalance } = await import('../lib/x402-signing.js');

function section(title: string) {
  console.log(`\n${'='.repeat(10)} ${title} ${'='.repeat(10)}`);
}

function pretty(label: string, value: unknown) {
  console.log(`${label}:\n${JSON.stringify(value, null, 2)}`);
}

async function main() {
  const toolName = process.argv[2] ?? 'openweb_ninja_social_links_search';
  const query = process.argv[3] ?? 'Elon Musk';
  const args = { query };

  section('1. Bootstrap agent session');
  const session = await bootstrapAgent({
    name: 'debug-pay-flow',
    description: 'Standalone /api/pay repro script',
    createIfMissing: true,
  });
  pretty('session', {
    evmAddress: session.evmAddress,
    organizationId: session.organizationId,
    agentKitApiUrl: session.env.ABSTRAXN_AGENT_KIT_API_URL,
  });

  section('2. Probe tool (expect 402 payment_required)');
  const mcp = createMcpFromBootstrap(session);
  const probe = await callPaidTool(mcp, toolName, args);

  if (typeof probe === 'string') {
    console.log('Tool did not return a payment challenge — raw result:');
    console.log(probe);
    return;
  }
  pretty('paymentRequired', probe.paymentRequired);

  const accepts = probe.paymentRequired.accepts;
  if (!Array.isArray(accepts) || accepts.length === 0) {
    console.error('paymentRequired has no accepts[] — cannot continue.');
    return;
  }
  pretty('accepts[0] (scheme/network/asset/amount)', accepts[0]);

  section('3. Check USDC balance against accepts[0]');
  const balanceError = await checkUsdcBalance(session, accepts[0]!);
  if (balanceError) {
    console.error('Balance check failed:', balanceError.message);
    return;
  }
  console.log('Balance OK.');

  section('4. Sign payment payload');
  const paymentPayload = await signOpenWebNinjaPayment(session, probe.paymentRequired);
  pretty('paymentPayload', paymentPayload);

  section('5. Retry tool call with signed payment (verify + settle happen server-side here)');
  const outcome = await retryPaidTool(mcp, toolName, args, paymentPayload);
  pretty('outcome', outcome);

  if (!outcome.ok) {
    console.error('\n--- ROOT CAUSE ---');
    console.error(`code: ${outcome.error.code}`);
    console.error(`message: ${outcome.error.message}`);
  } else {
    console.log('\nPayment + tool call succeeded.');
  }
}

main().catch((err) => {
  console.error('\n--- UNCAUGHT ERROR ---');
  console.error(err);
  process.exitCode = 1;
});

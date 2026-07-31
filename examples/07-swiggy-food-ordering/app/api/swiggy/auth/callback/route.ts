import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  SwiggyOAuthError,
  discoverMetadata,
  exchangeCodeForTokens,
  getOrRegisterClient,
  storeTokens,
} from '@/lib/swiggy-oauth';

export const runtime = 'nodejs';

const STATE_COOKIE = 'swiggy_oauth_state';

interface StoredState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const raw = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  const fail = (reason: string) =>
    NextResponse.redirect(
      new URL(`/?swiggy=error&reason=${encodeURIComponent(reason)}`, url.origin),
    );

  const errorParam = url.searchParams.get('error');
  if (errorParam) {
    return fail(url.searchParams.get('error_description') ?? errorParam);
  }

  if (!raw) return fail('missing_state_cookie');

  let stored: StoredState;
  try {
    stored = JSON.parse(raw) as StoredState;
  } catch {
    return fail('corrupt_state_cookie');
  }

  const returnedState = url.searchParams.get('state');
  if (!returnedState || returnedState !== stored.state) {
    return fail('state_mismatch');
  }

  const code = url.searchParams.get('code');
  if (!code) return fail('missing_code');

  try {
    const metadata = await discoverMetadata();
    const { clientId } = await getOrRegisterClient(metadata, stored.redirectUri);
    const tokens = await exchangeCodeForTokens({
      metadata,
      clientId,
      code,
      redirectUri: stored.redirectUri,
      codeVerifier: stored.codeVerifier,
    });
    storeTokens(tokens);
  } catch (err) {
    const reason = err instanceof SwiggyOAuthError ? err.code : 'TOKEN_EXCHANGE_FAILED';
    return fail(reason);
  }

  return NextResponse.redirect(new URL('/?swiggy=connected', url.origin));
}

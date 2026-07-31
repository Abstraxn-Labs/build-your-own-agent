import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  SwiggyOAuthError,
  buildAuthorizationUrl,
  discoverMetadata,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  getOrRegisterClient,
} from '@/lib/swiggy-oauth';

export const runtime = 'nodejs';

const STATE_COOKIE = 'swiggy_oauth_state';

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const redirectUri = new URL('/api/swiggy/auth/callback', origin).toString();

  try {
    const metadata = await discoverMetadata();
    const { clientId } = await getOrRegisterClient(metadata, redirectUri);
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    const authorizationUrl = buildAuthorizationUrl({
      metadata,
      clientId,
      redirectUri,
      state,
      codeChallenge,
    });

    const jar = await cookies();
    jar.set(
      STATE_COOKIE,
      JSON.stringify({ state, codeVerifier, redirectUri }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/swiggy/auth',
        maxAge: 600,
      },
    );

    return NextResponse.redirect(authorizationUrl);
  } catch (err) {
    const reason =
      err instanceof SwiggyOAuthError
        ? err.code
        : err instanceof Error
          ? err.message
          : 'UNKNOWN_ERROR';
    return NextResponse.redirect(
      new URL(`/?swiggy=error&reason=${encodeURIComponent(reason)}`, origin),
    );
  }
}

import { createHash, randomBytes, randomUUID } from 'node:crypto';

declare global {
  // eslint-disable-next-line no-var
  var __swiggyOAuthClient: { clientId: string } | undefined;
  // eslint-disable-next-line no-var
  var __swiggyOAuthTokens: SwiggyOAuthTokenRecord | undefined;
}

export interface SwiggyOAuthTokenRecord {
  accessToken: string;
  refreshToken?: string;
  /** epoch ms, with a safety margin already subtracted */
  expiresAt: number;
}

export interface SwiggyOAuthMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  scopes_supported?: string[];
  code_challenge_methods_supported?: string[];
}

export class SwiggyOAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'SwiggyOAuthError';
  }
}

const SWIGGY_MCP_ORIGIN = 'https://mcp.swiggy.com';
const SWIGGY_METADATA_URL = `${SWIGGY_MCP_ORIGIN}/.well-known/oauth-authorization-server`;
export const SWIGGY_SCOPE = 'mcp:tools mcp:resources mcp:prompts';

/** Confirmed live via Swiggy's discovery doc — used only if discoverMetadata() itself fails. */
const FALLBACK_METADATA: SwiggyOAuthMetadata = {
  issuer: `${SWIGGY_MCP_ORIGIN}/auth`,
  authorization_endpoint: `${SWIGGY_MCP_ORIGIN}/auth/authorize`,
  token_endpoint: `${SWIGGY_MCP_ORIGIN}/auth/token`,
  registration_endpoint: `${SWIGGY_MCP_ORIGIN}/auth/register`,
  scopes_supported: SWIGGY_SCOPE.split(' '),
  code_challenge_methods_supported: ['S256'],
};

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** RFC 7636 §4.1: 43-128 chars from the unreserved charset. base64url easily satisfies this. */
export function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(96));
}

/** RFC 7636 §4.2, S256 only — Swiggy's discovery doc doesn't list "plain" as supported. */
export function generateCodeChallenge(verifier: string): string {
  return base64UrlEncode(createHash('sha256').update(verifier).digest());
}

export function generateState(): string {
  return randomUUID();
}

/**
 * Fetches Swiggy's real OAuth metadata. Falls back to hardcoded (but
 * previously-confirmed-live) endpoints if the discovery request itself
 * fails, rather than blocking the whole Connect flow on it.
 */
export async function discoverMetadata(): Promise<SwiggyOAuthMetadata> {
  try {
    const res = await fetch(SWIGGY_METADATA_URL, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new SwiggyOAuthError(
        'DISCOVERY_FAILED',
        `Swiggy OAuth discovery returned ${res.status}`,
        res.status,
      );
    }
    const json = (await res.json()) as Partial<SwiggyOAuthMetadata>;
    if (
      !json.authorization_endpoint ||
      !json.token_endpoint ||
      !json.registration_endpoint
    ) {
      throw new SwiggyOAuthError(
        'DISCOVERY_FAILED',
        'Swiggy OAuth discovery response is missing required endpoints',
      );
    }
    return json as SwiggyOAuthMetadata;
  } catch (err) {
    console.warn(
      '[swiggy-oauth] discovery failed, using fallback endpoints:',
      err instanceof Error ? err.message : err,
    );
    return FALLBACK_METADATA;
  }
}

/**
 * Dynamic Client Registration (RFC 7591) — registers this app as a public
 * (PKCE-only, no secret) OAuth client. Cached for the life of the process so
 * repeated "Connect" clicks don't re-register every time.
 */
export async function getOrRegisterClient(
  metadata: SwiggyOAuthMetadata,
  redirectUri: string,
): Promise<{ clientId: string }> {
  if (globalThis.__swiggyOAuthClient) {
    return globalThis.__swiggyOAuthClient;
  }

  const res = await fetch(metadata.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Abstraxn Swiggy Food Ordering Example',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: SWIGGY_SCOPE,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => undefined);
    throw new SwiggyOAuthError(
      'DCR_FAILED',
      `Swiggy client registration failed (${res.status})`,
      res.status,
      detail,
    );
  }

  const json = (await res.json()) as { client_id?: string };
  if (!json.client_id) {
    throw new SwiggyOAuthError(
      'DCR_FAILED',
      'Swiggy client registration response is missing client_id',
    );
  }

  const client = { clientId: json.client_id };
  globalThis.__swiggyOAuthClient = client;
  return client;
}

export function buildAuthorizationUrl(input: {
  metadata: SwiggyOAuthMetadata;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(input.metadata.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
    scope: SWIGGY_SCOPE,
  }).toString();
  return url.toString();
}

function tokenRecordFromResponse(json: {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}, previousRefreshToken?: string): SwiggyOAuthTokenRecord {
  if (!json.access_token) {
    throw new SwiggyOAuthError(
      'TOKEN_RESPONSE_INVALID',
      'Swiggy token response is missing access_token',
    );
  }
  const expiresInMs = (json.expires_in ?? 3600) * 1000;
  return {
    accessToken: json.access_token,
    // RFC 6749 §6: an omitted refresh_token in a refresh response means "unchanged".
    refreshToken: json.refresh_token ?? previousRefreshToken,
    expiresAt: Date.now() + expiresInMs - 30_000,
  };
}

export async function exchangeCodeForTokens(input: {
  metadata: SwiggyOAuthMetadata;
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<SwiggyOAuthTokenRecord> {
  const res = await fetch(input.metadata.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: input.clientId,
      code_verifier: input.codeVerifier,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => undefined);
    throw new SwiggyOAuthError(
      'TOKEN_EXCHANGE_FAILED',
      `Swiggy token exchange failed (${res.status})`,
      res.status,
      detail,
    );
  }

  return tokenRecordFromResponse(await res.json());
}

export async function refreshTokens(input: {
  metadata: SwiggyOAuthMetadata;
  clientId: string;
  refreshToken: string;
}): Promise<SwiggyOAuthTokenRecord> {
  const res = await fetch(input.metadata.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: input.refreshToken,
      client_id: input.clientId,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => undefined);
    throw new SwiggyOAuthError(
      'TOKEN_REFRESH_FAILED',
      `Swiggy token refresh failed (${res.status})`,
      res.status,
      detail,
    );
  }

  return tokenRecordFromResponse(await res.json(), input.refreshToken);
}

/**
 * The one function callers outside this module need: returns a currently
 * valid access token (refreshing proactively if needed), or undefined if
 * there's no connection / the connection is unrecoverably dead (in which
 * case the store is cleared so the UI can prompt reconnect). Never throws.
 */
export async function getValidAccessToken(): Promise<
  SwiggyOAuthTokenRecord | undefined
> {
  const record = globalThis.__swiggyOAuthTokens;
  if (!record) return undefined;
  if (Date.now() < record.expiresAt) return record;

  if (!record.refreshToken) {
    globalThis.__swiggyOAuthTokens = undefined;
    return undefined;
  }

  // The client should already be registered from the initial Connect flow —
  // refreshing never needs to re-register, only the authorize/callback leg does.
  const client = globalThis.__swiggyOAuthClient;
  if (!client) {
    globalThis.__swiggyOAuthTokens = undefined;
    return undefined;
  }

  try {
    const metadata = await discoverMetadata();
    const refreshed = await refreshTokens({
      metadata,
      clientId: client.clientId,
      refreshToken: record.refreshToken,
    });
    globalThis.__swiggyOAuthTokens = refreshed;
    return refreshed;
  } catch (err) {
    console.warn(
      '[swiggy-oauth] proactive refresh failed, clearing connection:',
      err instanceof Error ? err.message : err,
    );
    globalThis.__swiggyOAuthTokens = undefined;
    return undefined;
  }
}

export function isConnected(): boolean {
  return !!globalThis.__swiggyOAuthTokens;
}

export function storeTokens(record: SwiggyOAuthTokenRecord): void {
  globalThis.__swiggyOAuthTokens = record;
}

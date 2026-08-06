import crypto from "node:crypto";
import jwt from "jsonwebtoken";

export interface MintCoinbaseBearerTokenInput {
  /** CDP key name, e.g. organizations/{org_id}/apiKeys/{key_id}. */
  keyName: string;
  /** The matching CDP private key — EC (PEM) or Ed25519 (base64), auto-detected. */
  keySecret: string;
  method: "GET" | "POST";
  /** Request path only, e.g. /api/v3/brokerage/orders — no host. */
  path: string;
}

// CDP keys come in two shapes: EC keys are PEM ("-----BEGIN EC PRIVATE KEY-----"), signed
// with ES256. Ed25519 keys are a base64 string that decodes to 64 bytes (32-byte seed +
// 32-byte public key, libsodium-style), signed with EdDSA — jsonwebtoken/jwa has no EdDSA
// support, so that path is signed by hand with Node's native crypto via a JWK import of the
// raw seed/public key.
function isEd25519Secret(secret: string): boolean {
  if (secret.includes("-----BEGIN")) {
    return false;
  }
  try {
    return Buffer.from(secret, "base64").length === 64;
  } catch {
    return false;
  }
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

function mintEdDsaToken(
  keyName: string,
  keySecret: string,
  claims: Record<string, unknown>,
): string {
  const decoded = Buffer.from(keySecret, "base64");
  const seed = decoded.subarray(0, 32);
  const publicKey = decoded.subarray(32);
  const keyObject = crypto.createPrivateKey({
    key: {
      kty: "OKP",
      crv: "Ed25519",
      d: seed.toString("base64url"),
      x: publicKey.toString("base64url"),
    },
    format: "jwk",
  });

  const header = {
    alg: "EdDSA",
    kid: keyName,
    typ: "JWT",
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  const signingInput = `${base64url(Buffer.from(JSON.stringify(header)))}.${base64url(Buffer.from(JSON.stringify(claims)))}`;
  const signature = crypto.sign(null, Buffer.from(signingInput), keyObject);
  return `${signingInput}.${base64url(signature)}`;
}

/**
 * BYOK: mints a short-lived (~120s), single-request-scoped Coinbase CDP bearer token
 * locally, using a key held only in this backend's own environment. The token — not
 * the key — is what gets sent to Abstraxn's MCP tools (X-Coinbase-Bearer-Token header),
 * so the real secret never leaves wherever this function runs.
 */
export function mintCoinbaseBearerToken(
  input: MintCoinbaseBearerTokenInput,
): string {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: "cdp",
    sub: input.keyName,
    nbf: now,
    exp: now + 120,
    uri: `${input.method} api.coinbase.com${input.path}`,
  };

  if (isEd25519Secret(input.keySecret)) {
    return mintEdDsaToken(input.keyName, input.keySecret, claims);
  }

  const privateKey = input.keySecret.replace(/\\n/g, "\n");
  return jwt.sign(claims, privateKey, {
    algorithm: "ES256",
    header: {
      alg: "ES256",
      kid: input.keyName,
      nonce: crypto.randomBytes(16).toString("hex"),
    } as jwt.JwtHeader,
  });
}

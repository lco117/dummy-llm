/**
 * Cloudflare Access.
 *
 * Access is an identity-aware proxy in front of the Worker: an unauthenticated visitor is 302'd to
 * the team's login page and only reaches the Worker with a short-lived RS256 JWT, which the edge
 * copies into the `Cf-Access-Jwt-Assertion` header.
 *
 * Two modes:
 *   access      trust the edge. Correct only when every request to the Worker really does pass
 *               through the Access application (bind the Admin route to the Access app), because a
 *               request that reaches the Worker by another route can forge the header.
 *   access-jwt  verify the signature against the team's JWKS. This is the one to use when the Worker
 *               is also reachable directly. It is the only outbound request the project ever makes,
 *               which is why it is opt-in and why the key set is cached for an hour.
 */

const JWKS_TTL_MS = 60 * 60_000;
const CLOCK_LEEWAY_SEC = 60;
const encoder = new TextEncoder();

export interface Jwk {
  kty?: string;
  kid?: string;
  n?: string;
  e?: string;
  use?: string;
}

interface JwksCacheEntry {
  keys: Jwk[];
  at: number;
}

/** Per-isolate cache. A key rotation is picked up within the hour, or immediately on an unknown kid. */
const jwksCache = new Map<string, JwksCacheEntry>();

export interface AccessOptions {
  teamDomain: string;
  aud: string;
  now?: () => number;
  /** Injected in tests so no test ever touches the network. */
  fetchJwks?: (url: string) => Promise<unknown>;
}

export type AccessResult = { ok: true; email: string | null } | { ok: false; reason: string };

export function accessJwtFrom(request: Request): string | null {
  return request.headers.get("cf-access-jwt-assertion");
}

export function accessLogoutUrl(teamDomain: string): string {
  return `${teamDomain}/cdn-cgi/access/logout`;
}

/** Test seam: forget what we know about a team's keys. */
export function resetAccessCache(): void {
  jwksCache.clear();
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeJsonSegment(segment: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment))) as Record<string, unknown>;
}

function extractKeys(body: unknown): Jwk[] {
  const raw = Array.isArray(body) ? body : (body as { keys?: unknown } | null)?.keys;
  if (!Array.isArray(raw)) return [];
  return raw.filter((key): key is Jwk => key !== null && typeof key === "object" && (key as Jwk).kty === "RSA");
}

async function loadKeys(options: AccessOptions, at: number): Promise<Jwk[]> {
  const cached = jwksCache.get(options.teamDomain);
  if (cached && at - cached.at < JWKS_TTL_MS) return cached.keys;
  const url = `${options.teamDomain}/cdn-cgi/access/certs`;
  const fetchJwks = options.fetchJwks ?? (async (target: string) => (await fetch(target)).json() as Promise<unknown>);
  try {
    const keys = extractKeys(await fetchJwks(url));
    if (keys.length === 0) throw new Error("the key set contained no RSA keys");
    jwksCache.set(options.teamDomain, { keys, at });
    return keys;
  } catch (error) {
    // A stale key set beats locking the operator out of their own deployment.
    if (cached) return cached.keys;
    throw error;
  }
}

export async function verifyAccessJwt(token: string, options: AccessOptions): Promise<AccessResult> {
  const now = options.now ?? (() => Date.now());
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed token" };
  const [headerSegment, payloadSegment, signatureSegment] = parts;

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodeJsonSegment(headerSegment);
    payload = decodeJsonSegment(payloadSegment);
  } catch {
    return { ok: false, reason: "the token is not valid base64url JSON" };
  }
  if (header.alg !== "RS256") return { ok: false, reason: `unsupported alg "${String(header.alg)}"` };

  const at = now();
  let keys: Jwk[];
  try {
    keys = await loadKeys(options, at);
  } catch (error) {
    return { ok: false, reason: `could not fetch the Access key set: ${error instanceof Error ? error.message : String(error)}` };
  }

  const kid = typeof header.kid === "string" ? header.kid : null;
  let candidates = kid ? keys.filter((key) => key.kid === kid) : keys;
  if (candidates.length === 0) {
    // The team may have rotated its keys; forget the cache and look once more.
    jwksCache.delete(options.teamDomain);
    try {
      keys = await loadKeys(options, at);
    } catch {
      return { ok: false, reason: `no key matches kid "${kid}"` };
    }
    candidates = kid ? keys.filter((key) => key.kid === kid) : keys;
    if (candidates.length === 0) return { ok: false, reason: `no key matches kid "${kid}"` };
  }

  const signature = base64UrlToBytes(signatureSegment);
  const signed = encoder.encode(`${headerSegment}.${payloadSegment}`);
  let verified = false;
  for (const jwk of candidates) {
    if (!jwk.n || !jwk.e) continue;
    try {
      const key = await crypto.subtle.importKey(
        "jwk",
        { kty: "RSA", n: jwk.n, e: jwk.e, ext: true },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
      if (await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed)) {
        verified = true;
        break;
      }
    } catch {
      // a malformed key in the set must not stop the others from being tried
    }
  }
  if (!verified) return { ok: false, reason: "the signature did not verify" };

  const nowSec = Math.floor(at / 1000);
  if (typeof payload.exp !== "number" || payload.exp + CLOCK_LEEWAY_SEC <= nowSec) {
    return { ok: false, reason: "the token has expired" };
  }
  if (typeof payload.nbf === "number" && payload.nbf - CLOCK_LEEWAY_SEC > nowSec) {
    return { ok: false, reason: "the token is not valid yet" };
  }
  const issuer = String(payload.iss ?? "").replace(/\/+$/, "");
  if (issuer !== options.teamDomain) return { ok: false, reason: `issuer mismatch: ${issuer}` };
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audience.includes(options.aud)) return { ok: false, reason: "audience mismatch (check CF_ACCESS_AUD)" };

  return { ok: true, email: typeof payload.email === "string" ? payload.email : null };
}

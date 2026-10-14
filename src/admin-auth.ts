/**
 * Admin authentication: a signed, HttpOnly session cookie, plus the CSRF and header rules that go
 * with it. Everything here is Web-standard (WebCrypto + Headers), so the same code runs on Node,
 * Workers, Deno and the edge runtimes.
 *
 * Design notes that matter, because "secure" is a claim that has to be justified:
 *
 * - The cookie carries an expiry and an HMAC. The admin key itself is never stored, never echoed,
 *   and never logged.
 * - Comparisons are constant-time. WebCrypto has no portable timingSafeEqual, so both sides are
 *   hashed first (which also removes the length leak) and then compared byte by byte. Workers'
 *   non-standard crypto.subtle.timingSafeEqual is used when it exists.
 * - SameSite=Strict plus an Origin / Sec-Fetch-Site check plus a JSON-or-form content-type rule
 *   covers CSRF. The checks are belt and braces, and they are written down rather than assumed.
 */

export const ADMIN_COOKIE = "dummy_admin";
export const ADMIN_SESSION_TTL_SEC = 7 * 24 * 60 * 60;
const SESSION_CONTEXT = "dummy-admin-v1";
const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

async function digest(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

async function hmacHex(adminKey: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(adminKey), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message))));
}

/** Constant-time equality for two strings of any length. */
export async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  const timingSafe = (crypto.subtle as unknown as { timingSafeEqual?: (x: Uint8Array, y: Uint8Array) => boolean })
    .timingSafeEqual;
  if (typeof timingSafe === "function") {
    try {
      return timingSafe.call(crypto.subtle, a, b);
    } catch {
      // not the Workers flavour; fall through to the portable loop
    }
  }
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

/* ------------------------------------------------------------------ sessions */

export async function signSession(adminKey: string, expiresAtSec: number): Promise<string> {
  return `${expiresAtSec}.${await hmacHex(adminKey, `${SESSION_CONTEXT}.${expiresAtSec}`)}`;
}

export async function verifySession(adminKey: string, value: string, nowSec: number): Promise<boolean> {
  const separator = value.indexOf(".");
  if (separator <= 0) return false;
  const expires = value.slice(0, separator);
  const mac = value.slice(separator + 1);
  if (!/^[0-9]{1,12}$/.test(expires) || !/^[0-9a-f]{64}$/.test(mac)) return false;
  if (Number(expires) <= nowSec) return false;
  return constantTimeEqual(mac, await hmacHex(adminKey, `${SESSION_CONTEXT}.${expires}`));
}

export function sessionCookie(value: string, maxAgeSec: number): string {
  return `${ADMIN_COOKIE}=${value}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSec}`;
}

export function clearedCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

/* ------------------------------------------------------------------ request hygiene */

/** Who is asking, for the login throttle. Cloudflare sets cf-connecting-ip and cannot be spoofed. */
export function clientIp(request: Request): string {
  const header =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0];
  return (header ?? "local").trim().slice(0, 64);
}

/**
 * CSRF. The session cookie is SameSite=Strict, so a cross-site request never carries it; these
 * checks are the second layer, and they also cover the unauthenticated login form.
 */
export function sameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("origin");
  // Compare against the host the browser actually addressed, not against new URL(request.url).origin:
  // anything sitting in front of the Worker (Cloudflare Access, a tunnel, a reverse proxy) can rewrite
  // the URL while Origin and Host stay truthful. Getting this the wrong way round locks an operator out
  // of their own deployment while looking like a CSRF control working.
  const target = request.headers.get("host") ?? url.host;
  if (origin && origin !== "null") {
    try {
      return new URL(origin).host === target;
    } catch {
      return false;
    }
  }
  // No usable Origin: fall back to fetch metadata, and stay permissive when neither is present (curl,
  // an older client), because the SameSite=Strict cookie is the control that actually holds.
  return request.headers.get("sec-fetch-site") !== "cross-site";
}

export function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "cache-control": "no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    "content-security-policy":
      "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    ...extra,
  };
}

/* ------------------------------------------------------------------ login throttling */

export interface ThrottleOptions {
  limit?: number;
  windowMs?: number;
  blockMs?: number;
}

interface Attempts {
  failures: number;
  first: number;
  blockedUntil: number;
}

/**
 * A best-effort speed bump: an in-memory failure counter per address. On Workers every isolate has
 * its own memory, so this is NOT an access control and the docs say so. It exists to make an
 * online guessing attempt slow and visible.
 */
export class LoginThrottle {
  private readonly attempts = new Map<string, Attempts>();
  readonly limit: number;
  readonly windowMs: number;
  readonly blockMs: number;

  constructor(options: ThrottleOptions = {}) {
    this.limit = options.limit ?? 8;
    this.windowMs = options.windowMs ?? 15 * 60_000;
    this.blockMs = options.blockMs ?? 15 * 60_000;
  }

  /** Seconds until this address may try again, or 0 when it may try now. */
  retryAfter(ip: string, now: number): number {
    const record = this.attempts.get(ip);
    if (!record) return 0;
    if (record.blockedUntil > now) return Math.ceil((record.blockedUntil - now) / 1000);
    if (now - record.first > this.windowMs) {
      this.attempts.delete(ip);
      return 0;
    }
    return 0;
  }

  recordFailure(ip: string, now: number): void {
    this.prune(now);
    const record = this.attempts.get(ip);
    if (!record || now - record.first > this.windowMs) {
      this.attempts.set(ip, { failures: 1, first: now, blockedUntil: 0 });
      return;
    }
    record.failures += 1;
    if (record.failures >= this.limit) record.blockedUntil = now + this.blockMs;
  }

  recordSuccess(ip: string): void {
    this.attempts.delete(ip);
  }

  private prune(now: number): void {
    if (this.attempts.size < 512) return;
    for (const [ip, record] of this.attempts) {
      if (record.blockedUntil < now && now - record.first > this.windowMs) this.attempts.delete(ip);
    }
  }
}

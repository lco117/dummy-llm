import { accessJwtFrom, accessLogoutUrl, verifyAccessJwt } from "./admin-access.ts";
import {
  LoginThrottle,
  adminHeaders,
  clearedCookie,
  clientIp,
  constantTimeEqual,
  readCookie,
  sameOrigin,
  sessionCookie,
  signSession,
  verifySession,
  ADMIN_COOKIE,
} from "./admin-auth.ts";
import { ADMIN_CSS, accessDeniedPage, adminPage, adminScript, loginPage } from "./admin-ui.ts";
import { HttpError } from "./errors.ts";
import { resolveLang } from "./i18n.ts";
import { BUILTIN_PERSONAS } from "./personas.ts";
import { PACK_INDEX, diffDoc, docToPack, mergeDoc, packToDoc, parsePack } from "./packs.ts";
import * as openaiChat from "./protocols/openai-chat.ts";
import { mulberry32 } from "./random.ts";
import { redactText, redactedJson } from "./redact.ts";
import { json } from "./sse.ts";
import { applyStore, sanitizeDefaults, sanitizePersona, validateDoc, type StoreLayer } from "./store.ts";
import type { AdminConfig, AdminAuthMode, Config, Persona, StoreDefaults, StoreDoc } from "./types.ts";
import { version } from "./version.ts";

/**
 * The admin surface. It is deliberately thin: every route either reads the effective configuration,
 * writes one document through the store layer, or hands a synthesised request to the real protocol
 * module so that a preview is byte-identical to what a client would receive.
 *
 * Rules this file exists to keep:
 *   - /admin* is 404 unless an operator opted in;
 *   - no secret is ever written to a response or a log line;
 *   - every write is same-origin, JSON, and goes through the store (never the environment);
 *   - the page is static HTML with zero server-side interpolation, so there is no XSS surface to
 *     get wrong in the first place.
 */

const DEFAULT_KEYS = ["reply", "thinking", "tps", "chunk", "delayMs", "ttftMs", "log", "playground", "maxReplyChars", "models"] as const;
const PREVIEW_INPUT_MAX = 4000;
const PREVIEW_REPLY_MAX = 100_000;
const PREVIEW_UNCAPPED = 100_000;

export interface AdminDeps {
  base: Config;
  store: StoreLayer;
  /** Fresh per-request randomness, exactly like the normal request path. */
  seed: () => number;
}

interface Grant {
  identity: string;
  mode: AdminAuthMode;
}

export function createAdmin(deps: AdminDeps): (request: Request) => Promise<Response> {
  const throttle = new LoginThrottle();
  const base = deps.base;
  const adminCfg = base.admin;
  const now = () => base.now();

  function audit(event: string, data: Record<string, unknown> = {}, always = false): void {
    if (!always && base.log === "off") return;
    console.log(redactedJson({ dummy: "admin", event, ...data }));
  }

  function readOnly(message: string, status = 409): Response {
    return json({ error: message }, status, adminHeaders());
  }

  /**
   * A refused origin is always logged, with the four headers that decide it. Without this line a
   * mismatch is invisible from the outside, and the operator sees a bare JSON error with nothing to
   * act on. It records no secrets: an origin, a host and two fetch-metadata values.
   */
  function originRefused(request: Request, url: URL, where: string): void {
    audit(
      "origin_refused",
      {
        where,
        method: request.method,
        path: url.pathname,
        origin: request.headers.get("origin"),
        host: request.headers.get("host"),
        urlOrigin: url.origin,
        site: request.headers.get("sec-fetch-site"),
      },
      true,
    );
  }

  async function loadDoc(): Promise<StoreDoc | null> {
    try {
      return await deps.store.read();
    } catch (error) {
      throw new HttpError(503, "the configured store could not be read: " + describe(error));
    }
  }

  async function authorize(request: Request, url: URL): Promise<Grant | null> {
    if (!adminCfg.enabled || !adminCfg.mode) return null;
    const nowSec = Math.floor(now() / 1000);
    if (adminCfg.mode === "key") {
      if (!adminCfg.key) return null;
      const cookie = readCookie(request.headers.get("cookie"), ADMIN_COOKIE);
      if (!cookie) return null;
      const valid = await verifySession(adminCfg.key, cookie, nowSec);
      if (!valid) {
        audit("session_rejected", { path: url.pathname, ip: clientIp(request) }, true);
        return null;
      }
      return { identity: "key", mode: "key" };
    }
    const token = accessJwtFrom(request);
    if (!token) {
      // Silence here would be ambiguous in the log: it can mean "Access is no longer in front of this
      // path" or "the request reached the Worker without passing through it". Both are exactly the
      // situation an operator needs to see, so say which one it is.
      audit(
        "access_rejected",
        { reason: "no Cf-Access-Jwt-Assertion header", path: url.pathname, ip: clientIp(request) },
        true,
      );
      return null;
    }
    if (adminCfg.mode === "access") return { identity: "access (edge trust)", mode: "access" };
    const result = await verifyAccessJwt(token, {
      teamDomain: adminCfg.accessTeamDomain as string,
      aud: adminCfg.accessAud as string,
      now,
    });
    if (!result.ok) {
      audit("access_rejected", { reason: result.reason, path: url.pathname, ip: clientIp(request) }, true);
      return null;
    }
    return { identity: result.email ?? "access", mode: "access-jwt" };
  }

  /* ---------------------------------------------------------------- pages */

  function page(html: string, status = 200): Response {
    return new Response(html, { status, headers: adminHeaders({ "content-type": "text/html; charset=utf-8" }) });
  }

  function asset(body: string, type: string): Response {
    return new Response(body, { status: 200, headers: adminHeaders({ "content-type": type }) });
  }

  async function handleLogin(request: Request, url: URL): Promise<Response> {
    if (adminCfg.mode !== "key" || !adminCfg.key) return notFound();
    if (!sameOrigin(request, url)) {
      originRefused(request, url, "login");
      return json({ error: "cross-origin request refused" }, 403, adminHeaders());
    }
    const ip = clientIp(request);
    const at = now();
    const retryAfter = throttle.retryAfter(ip, at);
    if (retryAfter > 0) {
      audit("login_blocked", { ip, retryAfter }, true);
      return json({ error: "too many failed attempts", retryAfter }, 429, adminHeaders({ "retry-after": String(retryAfter) }));
    }
    const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const limit = base.maxBodyBytes;
    let key: string | null = null;
    if (type === "application/x-www-form-urlencoded") {
      key = new URLSearchParams(await readText(request, limit)).get("key");
    } else if (type === "application/json") {
      const body = await readJsonBody(request, limit);
      key = typeof body.key === "string" ? body.key : null;
    } else {
      return json({ error: "send application/json or application/x-www-form-urlencoded" }, 415, adminHeaders());
    }

    const accepted = typeof key === "string" && key.length > 0 && (await constantTimeEqual(key, adminCfg.key));
    if (!accepted) {
      throttle.recordFailure(ip, at);
      audit("login_failed", { ip, path: url.pathname }, true);
      if (type === "application/json") return json({ error: "the key is not correct" }, 401, adminHeaders());
      return new Response(null, { status: 303, headers: adminHeaders({ location: "/admin?e=bad-key" }) });
    }

    throttle.recordSuccess(ip);
    const expiresAt = Math.floor(at / 1000) + adminCfg.sessionTtlSec;
    const cookie = sessionCookie(await signSession(adminCfg.key, expiresAt), adminCfg.sessionTtlSec);
    audit("login_ok", { ip }, true);
    if (type === "application/json") return json({ ok: true }, 200, adminHeaders({ "set-cookie": cookie }));
    return new Response(null, { status: 303, headers: adminHeaders({ location: "/admin", "set-cookie": cookie }) });
  }

  function handleLogout(request: Request, url: URL): Response {
    // Signing out always succeeds. It destroys nothing, it is idempotent, and a cross-site request
    // cannot carry the SameSite=Strict cookie anyway - so refusing here could only ever show the
    // operator a JSON error instead of logging them out. A mismatch is logged and otherwise ignored.
    if (!sameOrigin(request, url)) originRefused(request, url, "logout");
    audit("logout", { ip: clientIp(request) }, true);
    if (adminCfg.mode !== "key") {
      const target = adminCfg.accessTeamDomain ? accessLogoutUrl(adminCfg.accessTeamDomain) : "/admin";
      return new Response(null, { status: 303, headers: adminHeaders({ location: target }) });
    }
    return new Response(null, { status: 303, headers: adminHeaders({ location: "/admin", "set-cookie": clearedCookie() }) });
  }

  function notFound(): Response {
    return new Response("Not found", { status: 404, headers: adminHeaders({ "content-type": "text/plain; charset=utf-8" }) });
  }

  /* ---------------------------------------------------------------- state */

  async function buildState(doc: StoreDoc | null): Promise<Record<string, unknown>> {
    const effective = applyStore(base, doc);
    const stored: StoreDefaults = doc?.defaults ?? {};
    const entries: Record<string, unknown> = {};
    const field = (key: string, envValue: unknown, storedValue: unknown, effectiveValue: unknown) => {
      entries[key] = { env: envValue, stored: storedValue ?? null, effective: effectiveValue };
    };
    field("reply", base.reply, stored.reply, effective.reply);
    field("thinking", base.thinking, stored.thinking, effective.thinking);
    field("tps", base.tps, stored.tps, effective.tps);
    field("chunk", base.chunk, stored.chunk, effective.chunk);
    field("delayMs", base.delayMs, stored.delayMs, effective.delayMs);
    field("ttftMs", base.ttftMs, stored.ttftMs, effective.ttftMs);
    field("log", base.log, stored.log, effective.log);
    field("playground", base.playground, stored.playground, effective.playground);
    field("maxReplyChars", base.maxReplyChars, stored.maxReplyChars, effective.maxReplyChars);
    field("models", base.models, doc?.models ?? stored.models, effective.models);

    const ids = new Set<string>([...Object.keys(base.personas), ...Object.keys(doc?.personas ?? {})]);
    const personas = [...ids].sort().map((id) => {
      const docPersonas = doc?.personas ?? {};
      const inStore = Object.prototype.hasOwnProperty.call(docPersonas, id);
      const storedPersona = docPersonas[id] ?? null;
      const effectivePersona = effective.personas[id] ?? null;
      const source = inStore ? "store" : BUILTIN_PERSONAS[id] ? "builtin" : "env";
      return { id, source, stored: storedPersona, effective: effectivePersona };
    });

    return {
      version,
      auth: {
        mode: adminCfg.mode,
        store: deps.store.label,
        writable: deps.store.writable,
        sessionTtlSec: adminCfg.sessionTtlSec,
        accessTeamDomain: adminCfg.accessTeamDomain,
      },
      defaults: entries,
      personas,
      models: effective.models,
      packs: PACK_INDEX,
      updatedAt: doc?.updatedAt ?? null,
      updatedBy: doc?.updatedBy ?? null,
    };
  }

  /* ---------------------------------------------------------------- writes */

  async function writeDoc(doc: StoreDoc | null, identity: string): Promise<void> {
    if (!deps.store.writable) throw new HttpError(409, "this deployment has no store; set DUMMY_STORE to write");
    let next = doc;
    if (next) {
      next = { ...next, updatedAt: new Date(now()).toISOString(), updatedBy: identity };
      const problem = validateDoc(next);
      if (problem) throw new HttpError(400, problem);
    }
    await deps.store.write(next);
  }

  function requireWrite(request: Request, url: URL): void {
    if (!sameOrigin(request, url)) {
      originRefused(request, url, "write");
      throw new HttpError(403, "cross-origin request refused");
    }
    if (!deps.store.writable) throw new HttpError(409, "this deployment is read-only; set DUMMY_STORE=kv or file:<path> to edit");
  }

  async function savePersona(request: Request, url: URL, identity: string, id: string): Promise<Response> {
    requireWrite(request, url);
    const body = await readJsonBody(request, base.maxBodyBytes);
    const persona = sanitizePersona(body);
    if (persona === undefined) throw new HttpError(400, "the body must be a persona: { reply, thinking, description }");
    const doc = (await loadDoc()) ?? {};
    const personas = { ...(doc.personas ?? {}) };
    const previous = personas[id];
    personas[id] = persona;
    await writeDoc({ ...doc, personas }, identity);
    audit("persona_saved", { id, previous: previous ?? null, has: Object.keys(persona ?? {}) }, true);
    return json({ ok: true, id, persona }, 200, adminHeaders());
  }

  async function deletePersona(request: Request, url: URL, identity: string, id: string): Promise<Response> {
    requireWrite(request, url);
    const doc = (await loadDoc()) ?? {};
    const personas = { ...(doc.personas ?? {}), [id]: null };
    await writeDoc({ ...doc, personas }, identity);
    audit("persona_deleted", { id }, true);
    return json({ ok: true, id, deleted: true }, 200, adminHeaders());
  }

  async function saveDefaults(request: Request, url: URL, identity: string): Promise<Response> {
    requireWrite(request, url);
    const body = await readJsonBody(request, base.maxBodyBytes);
    const patch = sanitizeDefaults(body);
    if (!patch || Object.keys(patch).length === 0) throw new HttpError(400, "no recognised setting in the body");
    const doc = (await loadDoc()) ?? {};
    const defaults: StoreDefaults = { ...(doc.defaults ?? {}), ...patch };
    await writeDoc({ ...doc, defaults }, identity);
    audit("defaults_saved", { keys: Object.keys(patch) }, true);
    return json({ ok: true, defaults: patch }, 200, adminHeaders());
  }

  async function resetDefault(request: Request, url: URL, identity: string, key: string): Promise<Response> {
    requireWrite(request, url);
    if (!(DEFAULT_KEYS as readonly string[]).includes(key)) throw new HttpError(404, "unknown setting: " + key);
    const doc = (await loadDoc()) ?? {};
    const defaults: StoreDefaults = { ...(doc.defaults ?? {}) };
    delete (defaults as Record<string, unknown>)[key];
    await writeDoc({ ...doc, defaults }, identity);
    audit("default_reset", { key }, true);
    return json({ ok: true, key }, 200, adminHeaders());
  }

  /* ---------------------------------------------------------------- preview */

  async function preview(request: Request, url: URL, doc: StoreDoc | null): Promise<Response> {
    if (!sameOrigin(request, url)) {
      originRefused(request, url, "preview");
      throw new HttpError(403, "cross-origin request refused");
    }
    const body = await readJsonBody(request, base.maxBodyBytes);
    const input = typeof body.input === "string" ? body.input.slice(0, PREVIEW_INPUT_MAX) : "hello";
    const model = typeof body.model === "string" ? body.model.slice(0, 120) : "";
    const patch = sanitizePersona(body.patch);

    let cfg = applyStore(base, doc);
    if (patch && patch !== null) {
      if (model !== "") {
        cfg = { ...cfg, personas: { ...cfg.personas, [model]: { ...(cfg.personas[model] ?? {}), ...patch } } };
      } else {
        cfg = { ...cfg, reply: patch.reply ?? cfg.reply, thinking: patch.thinking ?? cfg.thinking };
      }
    }
    if (model !== "" && cfg.personas[model] === undefined && patch === null) {
      throw new HttpError(400, "no such persona: " + model);
    }
    cfg = {
      ...cfg,
      maxReplyChars: cfg.maxReplyChars > 0 ? Math.min(cfg.maxReplyChars, PREVIEW_REPLY_MAX) : PREVIEW_UNCAPPED,
      playground: false,
    };

    const wire = {
      model: model === "" ? "dummy-preview" : model,
      stream: true,
      // The preview prints the same token and tok/s figures the landing page does, so ask for usage.
      stream_options: { include_usage: true },
      messages: [{ role: "user", content: input }],
    };
    const response = openaiChat.chat(wire, { cfg, url, rand: mulberry32(deps.seed()) });
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(adminHeaders())) headers.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  /* ---------------------------------------------------------------- packs */

  async function importPack(request: Request, url: URL, identity: string): Promise<Response> {
    const body = await readJsonBody(request, base.maxBodyBytes);
    const { pack, errors } = parsePack(body.pack);
    if (errors.length > 0) return json({ ok: false, errors }, 400, adminHeaders());
    const doc = await loadDoc();
    const incoming = packToDoc(pack);
    const diff = diffDoc(doc, incoming);
    const apply = body.apply === true;
    if (!apply) return json({ ok: true, applied: false, diff }, 200, adminHeaders());
    requireWrite(request, url);
    const next = mergeDoc(doc, incoming);
    await writeDoc(next, identity);
    audit("pack_imported", { name: pack.name ?? null, personas: diff.personas }, true);
    return json({ ok: true, applied: true, diff }, 200, adminHeaders());
  }

  async function exportPack(request: Request, identity: string): Promise<Response> {
    void identity;
    const body = await readJsonBody(request, base.maxBodyBytes).catch(() => ({}) as Record<string, unknown>);
    if (body.source === "effective") {
      const effective = applyStore(base, await loadDoc());
      const doc: StoreDoc = {
        version: 1,
        personas: Object.fromEntries(Object.entries(effective.personas).map(([id, persona]) => [id, persona])),
        defaults: {
          reply: effective.reply,
          thinking: effective.thinking,
          tps: effective.tps,
          chunk: effective.chunk,
          ttftMs: effective.ttftMs,
          log: effective.log,
          playground: effective.playground,
          maxReplyChars: effective.maxReplyChars,
        },
      };
      return json({ ok: true, pack: docToPack(doc, "dummy-llm-effective") }, 200, adminHeaders());
    }
    const doc = (await loadDoc()) ?? { version: 1, personas: {}, defaults: {} };
    return json({ ok: true, pack: docToPack(doc) }, 200, adminHeaders());
  }

  /* ---------------------------------------------------------------- the router */

  return async function handleAdmin(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname.replace(/\/+$/, "") || "/admin";
    const lang = resolveLang(request, url);

    try {
      if (adminCfg.misconfigured) {
        return json({ error: "the admin surface is misconfigured: " + adminCfg.misconfigured }, 500, adminHeaders());
      }
      if (!adminCfg.enabled) return notFound();

      if (method === "GET" && path === "/admin/app.css") return asset(ADMIN_CSS, "text/css; charset=utf-8");
      if (method === "GET" && path === "/admin/app.js") return asset(adminScript(lang), "text/javascript; charset=utf-8");

      if (method === "GET" && path === "/admin") {
        const grant = await authorize(request, url);
        if (grant) return page(adminPage(lang));
        if (adminCfg.mode === "key") return page(loginPage(lang));
        return page(accessDeniedPage(lang), 403);
      }

      if (method === "POST" && path === "/admin/login") return await handleLogin(request, url);
      if (method === "POST" && path === "/admin/logout") return handleLogout(request, url);

      const grant = await authorize(request, url);
      if (!grant) {
        return json({ error: "sign in first" }, 401, adminHeaders());
      }

      if (method === "GET" && path === "/admin/api/state") {
        return json({ ok: true, state: await buildState(await loadDoc()) }, 200, adminHeaders());
      }
      if (method === "POST" && path === "/admin/api/preview") {
        return await preview(request, url, await loadDoc());
      }
      if (method === "GET" && path === "/admin/api/packs") {
        return json({ ok: true, packs: PACK_INDEX }, 200, adminHeaders());
      }
      if (method === "POST" && path === "/admin/api/import") {
        return await importPack(request, url, grant.identity);
      }
      if (method === "POST" && path === "/admin/api/export") {
        return await exportPack(request, grant.identity);
      }
      if (method === "POST" && path === "/admin/api/reset") {
        requireWrite(request, url);
        await writeDoc(null, grant.identity);
        audit("store_reset", { by: grant.identity }, true);
        return json({ ok: true }, 200, adminHeaders());
      }
      if (method === "PUT" && path === "/admin/api/defaults") {
        return await saveDefaults(request, url, grant.identity);
      }
      const defaultMatch = path.match(/^\/admin\/api\/defaults\/([A-Za-z]+)$/);
      if (method === "DELETE" && defaultMatch) {
        return await resetDefault(request, url, grant.identity, defaultMatch[1]);
      }
      const personaMatch = path.match(/^\/admin\/api\/personas\/([^/]+)$/);
      if (personaMatch) {
        const id = decodeURIComponent(personaMatch[1]).slice(0, 120);
        if (method === "PUT") return await savePersona(request, url, grant.identity, id);
        if (method === "DELETE") return await deletePersona(request, url, grant.identity, id);
      }

      return json({ error: "unknown admin route: " + method + " " + path }, 404, adminHeaders());
    } catch (error) {
      if (error instanceof HttpError) return json({ error: redactText(error.message) }, error.status, adminHeaders());
      const detail = error instanceof Error ? error.message : String(error);
      console.error(redactedJson({ dummy: "admin", event: "error", path, detail }));
      return json({ error: "the admin request failed", detail: redactText(detail) }, 500, adminHeaders());
    }
  };
}

function describe(error: unknown): string {
  return redactText(error instanceof Error ? error.message : String(error));
}

async function readText(request: Request, limit: number): Promise<string> {
  const text = await request.text();
  if (limit > 0 && text.length > limit) throw new HttpError(413, "the request body is larger than " + limit + " bytes");
  return text;
}

async function readJsonBody(request: Request, limit: number): Promise<Record<string, unknown>> {
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "" && type !== "application/json") throw new HttpError(415, "expected a JSON body");
  const text = await readText(request, limit);
  if (text.trim() === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "the body is not valid JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new HttpError(400, "the body must be a JSON object");
  return parsed as Record<string, unknown>;
}

import { ADMIN_SESSION_TTL_SEC } from "./admin-auth.ts";
import { BUILTIN_PERSONAS } from "./personas.ts";
import type { Persona } from "./types.ts";
import { HttpError, parseFaultSpec } from "./errors.ts";
import type { AdminConfig, ChunkMode, Config, LogLevel, Reply, StoreMode } from "./types.ts";

/**
 * Ten hardcoded "reasonings". In echo mode one is picked at random per request,
 * so the dummy does not look like a broken record. {input} is what the user said,
 * {reply} is what we are about to say back.
 */
export const DEFAULT_THINKING_POOL: string[] = [
  'We need answer to user. User just said "{input}". Need infer? Probably minimal. We need respond maybe "{reply}".',
  'User said "{input}". No tools required. The correct output is "{reply}".',
  'Let me work through it. The message is "{input}". There is nothing to compute, so I will say "{reply}".',
  'Step 1: read "{input}". Step 2: find the hidden question. Step 3: there is none. Step 4: output "{reply}".',
  'Analysing "{input}" … intent detected: none. Confidence: 100%. Responding with "{reply}".',
  'The user wrote "{input}". I hold no opinions and own no weights. I will return "{reply}".',
  'Parsing "{input}". No inference engine found. Falling back to a well-known technique: "{reply}".',
  'They said "{input}". A real model would think hard here. I am going to skip that part and say "{reply}".',
  'Input: "{input}". Token budget: irrelevant. Temperature: whatever. Conclusion: "{reply}".',
  'Considering "{input}". Is there a deeper meaning? No. Final answer: "{reply}".',
];

export interface Env {
  [key: string]: string | undefined;
}

/** Kept for readability in docs and tests: the first template of the pool. */
export const DEFAULT_THINKING = DEFAULT_THINKING_POOL[0];

export const DEFAULTS = {
  // Echo is not a mode: it is this template. That is the whole idea.
  reply: "{input}" as Reply,
  // ~4 characters is roughly one token for English text, so TPS means tokens/s.
  chunk: 4 as ChunkMode,
  tps: 100,
  log: "off" as LogLevel,
  maxBodyBytes: 1_000_000,
  playground: false,
  maxReplyChars: 0,
  ttftMs: 0,
  seed: 1,
  cors: "*",
  thinking: DEFAULT_THINKING_POOL as string[],
};

const OFF = new Set(["", "off", "none", "false", "no", "0", "disable", "disabled"]);

function hasValue(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== "";
}

function wholeNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function chunkMode(value: string | undefined): ChunkMode {
  if (!value) return DEFAULTS.chunk;
  if (value === "word" || value === "line" || value === "whole") return value;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULTS.chunk;
}

function list(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : fallback;
}

export function tpsToDelay(tps: number): number {
  // 0 means "as fast as the runtime can go"
  if (!Number.isFinite(tps) || tps <= 0) return 0;
  return Math.max(0, Math.round(1000 / tps));
}

function logLevel(value: string | undefined): LogLevel {
  if (value === undefined) return DEFAULTS.log;
  const normalised = value.trim().toLowerCase();
  if (["full", "verbose", "all", "body"].includes(normalised)) return "full";
  if (["summary", "1", "true", "yes", "on"].includes(normalised)) return "summary";
  return "off";
}

function boolean(value: string | undefined): boolean {
  if (value === undefined) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/** DUMMY_THINKING accepts one template, a |-separated pool, or "off". */
/** DUMMY_PERSONAS lets an operator add a persona without touching the source. */
function personaOverrides(value: string | undefined): Record<string, Persona> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, Persona>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * DUMMY_REPLY is parsed as JSON when it can be, and treated as a single template otherwise.
 * One rule, no ambiguity — a "|" is always a filter pipe, never a separator:
 *   "6"                     one template
 *   "{input|upper|box}"     still one template, filters compose
 *   '["6","7","maybe"]'     a pool, drawn at random
 *   '{"weather":"raining","*":"no idea"}'   keyword -> template, "*" is the fallback
 */
export function parseReply(value: string | undefined): Reply | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const trimmed = value.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) {
      const items = parsed.map((item) => String(item)).filter((item) => item !== "");
      if (items.length > 0) return items;
    } else if (parsed !== null && typeof parsed === "object") {
      const map: Record<string, string> = {};
      for (const [key, item] of Object.entries(parsed as Record<string, unknown>)) map[key] = String(item);
      if (Object.keys(map).length > 0) return map;
    }
  } catch {
    // not JSON — fall through to the pipe-separated form
  }
  return value;
}

/** The pre-0.4 DUMMY_MODE / _TEXT / _LINES / _CANNED quartet, kept working for one release. */
function legacyReply(env: Env): Reply | undefined {
  switch (env.DUMMY_MODE?.trim()) {
    case "echo":
      return "{input}";
    case "fixed":
      return env.DUMMY_TEXT ?? "";
    case "random": {
      const items = (env.DUMMY_LINES ?? "").split("|").map((item) => item.trim()).filter(Boolean);
      return items.length > 0 ? items : (env.DUMMY_TEXT ?? "");
    }
    case "canned": {
      try {
        const parsed = JSON.parse(env.DUMMY_CANNED ?? "{}") as Record<string, string>;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    default:
      return undefined;
  }
}

function thinkingPool(value: string | undefined): string[] {
  if (value === undefined) return DEFAULTS.thinking;
  if (OFF.has(value.trim().toLowerCase())) return [];
  const templates = value.split("|").map((item) => item.trim()).filter(Boolean);
  return templates.length > 0 ? templates : DEFAULTS.thinking;
}

/** The file store's default document name: `DUMMY_STORE=file:./data` names a directory. */
export const STORE_FILE_NAME = "store.json";

/** Plain string work, so this stays importable from every runtime (no node:path here). */
export function storeFilePath(spec: string): string {
  const raw = spec.startsWith("file:") ? spec.slice(5) : spec;
  const value = raw.trim() === "" ? "./data" : raw.trim();
  if (value.toLowerCase().endsWith(".json")) return value;
  return value.replace(/[/\\]+$/, "") + "/" + STORE_FILE_NAME;
}

export function storeMode(spec: string): StoreMode {
  const value = spec.trim().toLowerCase();
  if (value === "kv") return "kv";
  if (value === "file" || value.startsWith("file:")) return "file";
  return "off";
}

function normalizeTeamDomain(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * One knob, explicit precedence:
 *
 *   DUMMY_ADMIN_AUTH=off        404, even with a key set (panic switch)
 *   DUMMY_ADMIN_AUTH=access     trust the edge; Cloudflare Access must sit in front
 *   DUMMY_ADMIN_AUTH=access-jwt verify the Access JWT against the team's JWKS
 *   DUMMY_ADMIN_KEY set         signed-cookie login with that key
 *   nothing set                 404, the surface does not exist
 *
 * A value that is neither recognised nor "off" is refused loudly rather than silently downgraded
 * to the weaker mode.
 */
export function resolveAdminConfig(env: Env, apiKey: string | null): AdminConfig {
  const key = hasValue(env.DUMMY_ADMIN_KEY) ? (env.DUMMY_ADMIN_KEY as string).trim() : null;
  const setting = (env.DUMMY_ADMIN_AUTH ?? "").trim().toLowerCase();
  const teamDomain = hasValue(env.CF_ACCESS_TEAM_DOMAIN) ? normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN as string) : null;
  const accessAud = hasValue(env.CF_ACCESS_AUD) ? (env.CF_ACCESS_AUD as string).trim() : null;
  const base: AdminConfig = {
    enabled: false,
    mode: null,
    key,
    sessionTtlSec: Math.max(60, wholeNumber(env.DUMMY_ADMIN_TTL, ADMIN_SESSION_TTL_SEC)),
    accessTeamDomain: teamDomain,
    accessAud,
    misconfigured: null,
  };

  if (setting === "off") return base;

  if (setting === "access" || setting === "access-jwt") {
    if (setting === "access-jwt" && (!teamDomain || !accessAud)) {
      return {
        ...base,
        enabled: true,
        mode: setting,
        misconfigured: "DUMMY_ADMIN_AUTH=access-jwt needs both CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD",
      };
    }
    return { ...base, enabled: true, mode: setting };
  }

  if (setting !== "" && setting !== "key") {
    return { ...base, misconfigured: `unknown DUMMY_ADMIN_AUTH value "${setting}" (use key, access, access-jwt or off)` };
  }

  if (!key) return base;
  if (apiKey && key === apiKey) {
    return { ...base, enabled: true, mode: "key", misconfigured: "DUMMY_ADMIN_KEY is identical to DUMMY_API_KEY" };
  }
  return { ...base, enabled: true, mode: "key" };
}

/**
 * Turns environment variables into a Config. Every runtime feeds this:
 * Node passes `process.env`, a Worker passes the `env` binding.
 */
export function resolveConfig(env: Env = {}, overrides: Partial<Config> = {}): Config {
  const reply = parseReply(env.DUMMY_REPLY) ?? legacyReply(env) ?? DEFAULTS.reply;
  const tps = wholeNumber(env.DUMMY_TPS, DEFAULTS.tps);
  const personas = { ...BUILTIN_PERSONAS, ...personaOverrides(env.DUMMY_PERSONAS) };
  const seedProvided = hasValue(env.DUMMY_SEED);
  const deterministic = seedProvided || overrides.seed !== undefined || overrides.deterministic === true;
  const explicitDelay = env.DUMMY_DELAY_MS !== undefined && env.DUMMY_DELAY_MS.trim() !== "";
  const apiKey = env.DUMMY_API_KEY && env.DUMMY_API_KEY.trim() !== "" ? env.DUMMY_API_KEY.trim() : null;
  const storeSpec = (env.DUMMY_STORE ?? "").trim();
  const store = storeMode(storeSpec);
  const admin = resolveAdminConfig(env, apiKey);

  return {
    deterministic,
    reply,
    chunk: chunkMode(env.DUMMY_CHUNK),
    tps,
    delayMs: explicitDelay ? wholeNumber(env.DUMMY_DELAY_MS, tpsToDelay(tps)) : tpsToDelay(tps),
    ttftMs: wholeNumber(env.DUMMY_TTFT_MS, DEFAULTS.ttftMs),
    seed: wholeNumber(env.DUMMY_SEED, DEFAULTS.seed),
    fail: parseFaultSpec(env.DUMMY_FAIL),
    hangMs: wholeNumber(env.DUMMY_HANG_MS, 0),
    apiKey,
    cors: env.DUMMY_CORS ?? DEFAULTS.cors,
    models: list(env.DUMMY_MODELS, Object.keys(personas)),
    toolCall: env.DUMMY_TOOLCALL && env.DUMMY_TOOLCALL.trim() !== "" ? env.DUMMY_TOOLCALL : null,
    thinking: thinkingPool(env.DUMMY_THINKING),
    echoRaw: boolean(env.DUMMY_ECHO_RAW),
    log: logLevel(env.DUMMY_LOG),
    maxBodyBytes: wholeNumber(env.DUMMY_MAX_BODY, DEFAULTS.maxBodyBytes),
    playground: boolean(env.DUMMY_PLAYGROUND),
    maxReplyChars: wholeNumber(env.DUMMY_MAX_REPLY, DEFAULTS.maxReplyChars),
    strip: env.DUMMY_STRIP ? env.DUMMY_STRIP.split("|").map((item) => item.trim()).filter(Boolean) : [],
    personas,
    modelsExplicit: hasValue(env.DUMMY_MODELS),
    store,
    storePath: store === "file" ? storeFilePath(storeSpec) : null,
    admin,
    now: () => Date.now(),
    ...overrides,
  };
}

/** A visitor-supplied template is capped so a link cannot ask for an enormous render. */
export const PLAYGROUND_MAX_TEMPLATE = 2000;
export const PLAYGROUND_MAX_REPLY = 100_000;

/**
 * DUMMY_PLAYGROUND lets a caller pass ?t=<template> and have that template answer *that one request*.
 * Nothing is stored, and every other request is unaffected. When the variable is unset the parameter is
 * ignored entirely, so the surface does not exist.
 */
export function playgroundOverride(cfg: Config, url: URL): Config {
  if (!cfg.playground) return cfg;
  const raw = url.searchParams.get("t");
  if (raw === null) return cfg;
  if (raw.length > PLAYGROUND_MAX_TEMPLATE) {
    throw new HttpError(400, `the ?t= template is limited to ${PLAYGROUND_MAX_TEMPLATE} characters (got ${raw.length}).`);
  }
  return { ...cfg, reply: raw, maxReplyChars: PLAYGROUND_MAX_REPLY };
}

/** Node helper. Safe to call anywhere: workerd has no `process`. */
export function processEnv(): Env {
  if (typeof process === "undefined" || !process.env) return {};
  return process.env as Env;
}

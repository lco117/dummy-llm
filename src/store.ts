import { tpsToDelay } from "./config.ts";
import type { ChunkMode, Config, LogLevel, Persona, Reply, StoreDefaults, StoreDoc } from "./types.ts";

/**
 * The store is the only layer a running server can write, and it takes precedence over both the
 * environment and the built-in defaults:  store > environment > built-in.
 *
 * It holds one JSON document, not one key per persona, so every write is atomic and the whole
 * configuration can be read with a single round trip.
 */

export const STORE_VERSION = 1;
export const KV_KEY = "config";
export const FILE_NAME = "store.json";

/** Limits, so a mistake in the admin UI cannot turn the document into a database. */
export const MAX_DOC_CHARS = 512 * 1024;
export const MAX_PERSONAS = 200;
export const MAX_THINKING = 50;
export const MAX_REPLY_CHARS = 100_000;

/**
 * A raw key/value store. Cloudflare KV and a file on disk both satisfy this, which is why the
 * store layer itself never mentions either.
 */
export interface Store {
  readonly label: string;
  read(): Promise<string | null>;
  write(value: string | null): Promise<void>;
}

export interface StoreLayer {
  readonly label: string;
  readonly writable: boolean;
  read(): Promise<StoreDoc | null>;
  raw(): Promise<string | null>;
  write(doc: StoreDoc | null): Promise<void>;
}

export const EMPTY_DOC: StoreDoc = { version: STORE_VERSION, personas: {}, defaults: {} };


/* ------------------------------------------------------------------ sanitising */

function asReply(value: unknown): Reply | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const items = value.map((item) => (typeof item === "string" ? item : String(item))).filter((item) => item !== "");
    return items.length > 0 ? items : undefined;
  }
  if (value !== null && typeof value === "object") {
    const map: Record<string, string> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === null || item === undefined) continue;
      map[key] = typeof item === "string" ? item : String(item);
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }
  return undefined;
}

function asThinking(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item !== "")
    .slice(0, MAX_THINKING);
  return items;
}

/** `null` is a tombstone (delete this persona), `undefined` is junk. */
export function sanitizePersona(value: unknown): Persona | null | undefined {
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const persona: Persona = {};
  if ("reply" in raw) {
    const reply = asReply(raw.reply);
    if (reply === undefined) return undefined;
    persona.reply = reply;
  }
  if ("thinking" in raw) {
    const thinking = asThinking(raw.thinking);
    if (thinking === undefined) return undefined;
    persona.thinking = thinking;
  }
  if (typeof raw.description === "string") persona.description = raw.description.slice(0, 500);
  return Object.keys(persona).length > 0 ? persona : undefined;
}

function asNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : undefined;
}

function asChunk(value: unknown): ChunkMode | undefined {
  if (value === "word" || value === "line" || value === "whole") return value;
  return asNumber(value, 1, 100_000);
}

function asLog(value: unknown): LogLevel | undefined {
  return value === "off" || value === "summary" || value === "full" ? value : undefined;
}

export function sanitizeDefaults(value: unknown): StoreDefaults | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const defaults: StoreDefaults = {};
  if ("reply" in raw) {
    const reply = asReply(raw.reply);
    if (reply !== undefined) defaults.reply = reply;
  }
  if ("thinking" in raw) {
    const thinking = asThinking(raw.thinking);
    if (thinking !== undefined) defaults.thinking = thinking;
  }
  const tps = asNumber(raw.tps, 0, 100_000);
  if (tps !== undefined) defaults.tps = tps;
  const chunk = asChunk(raw.chunk);
  if (chunk !== undefined) defaults.chunk = chunk;
  const delayMs = asNumber(raw.delayMs, 0, 600_000);
  if (delayMs !== undefined) defaults.delayMs = delayMs;
  const ttftMs = asNumber(raw.ttftMs, 0, 600_000);
  if (ttftMs !== undefined) defaults.ttftMs = ttftMs;
  const log = asLog(raw.log);
  if (log !== undefined) defaults.log = log;
  if (typeof raw.playground === "boolean") defaults.playground = raw.playground;
  const maxReplyChars = asNumber(raw.maxReplyChars, 0, 10_000_000);
  if (maxReplyChars !== undefined) defaults.maxReplyChars = maxReplyChars;
  if (Array.isArray(raw.models)) {
    const models = raw.models.filter((item): item is string => typeof item === "string" && item.trim() !== "");
    if (models.length > 0) defaults.models = models.slice(0, MAX_PERSONAS);
  }
  return defaults;
}

/** Parses and sanitises a stored document. Returns null when the text is absent or unusable. */
export function parseStoreDoc(text: string | null): StoreDoc | null {
  if (text === null || text.trim() === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const raw = parsed as Record<string, unknown>;
  const doc: StoreDoc = { version: STORE_VERSION, personas: {}, defaults: {} };
  if (raw.personas !== null && typeof raw.personas === "object" && !Array.isArray(raw.personas)) {
    const personas: Record<string, Persona | null> = {};
    for (const [id, value] of Object.entries(raw.personas as Record<string, unknown>)) {
      const persona = sanitizePersona(value);
      if (persona !== undefined) personas[id.slice(0, 120)] = persona;
    }
    doc.personas = personas;
  }
  const defaults = sanitizeDefaults(raw.defaults);
  if (defaults) doc.defaults = defaults;
  if (Array.isArray(raw.models)) {
    const models = raw.models.filter((item): item is string => typeof item === "string" && item.trim() !== "");
    if (models.length > 0) doc.models = models.slice(0, MAX_PERSONAS);
  }
  if (typeof raw.updatedAt === "string") doc.updatedAt = raw.updatedAt;
  if (typeof raw.updatedBy === "string") doc.updatedBy = raw.updatedBy;
  return doc;
}

export function serializeDoc(doc: StoreDoc): string {
  return JSON.stringify({ ...doc, version: STORE_VERSION }, null, 2);
}

/** Cheap structural check applied before a write. Returns an error message, or null when fine. */
export function validateDoc(doc: StoreDoc): string | null {
  const personaCount = Object.keys(doc.personas ?? {}).length;
  if (personaCount > MAX_PERSONAS) return `too many personas: ${personaCount} (the limit is ${MAX_PERSONAS})`;
  for (const [id, persona] of Object.entries(doc.personas ?? {})) {
    if (persona === null) continue;
    if (typeof persona.reply === "string" && persona.reply.length > MAX_REPLY_CHARS) {
      return `persona "${id}": the reply template is longer than ${MAX_REPLY_CHARS} characters`;
    }
    if (Array.isArray(persona.reply) && persona.reply.some((item) => item.length > MAX_REPLY_CHARS)) {
      return `persona "${id}": a pooled reply is longer than ${MAX_REPLY_CHARS} characters`;
    }
  }
  const text = serializeDoc(doc);
  if (text.length > MAX_DOC_CHARS) return `the stored document is larger than ${MAX_DOC_CHARS} characters`;
  return null;
}

/* ------------------------------------------------------------------ layering */

/**
 * Overlays the store on top of the environment-resolved config. Every field follows
 * store > environment > built-in.
 */
export function applyStore(base: Config, doc: StoreDoc | null): Config {
  if (!doc) return base;
  const personas: Record<string, Persona> = { ...base.personas };
  for (const [id, persona] of Object.entries(doc.personas ?? {})) {
    if (persona === null) {
      delete personas[id];
      continue;
    }
    personas[id] = { ...(personas[id] ?? {}), ...persona };
  }

  const d = doc.defaults ?? {};
  const tps = d.tps ?? base.tps;
  const delayMs = d.delayMs ?? (d.tps !== undefined ? tpsToDelay(tps) : base.delayMs);

  const explicit = d.models ?? doc.models ?? null;
  let models: string[];
  if (explicit) models = dedupe(explicit.filter((id) => personas[id] !== undefined));
  else if (base.modelsExplicit) models = base.models.filter((id) => personas[id] !== undefined);
  else models = Object.keys(personas);

  return {
    ...base,
    personas,
    models,
    reply: d.reply ?? base.reply,
    thinking: d.thinking ?? base.thinking,
    tps,
    chunk: d.chunk ?? base.chunk,
    delayMs,
    ttftMs: d.ttftMs ?? base.ttftMs,
    log: d.log ?? base.log,
    playground: d.playground ?? base.playground,
    maxReplyChars: d.maxReplyChars ?? base.maxReplyChars,
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

/* ------------------------------------------------------------------ the cached layer */

export interface StoreLayerOptions {
  /** How long an isolate may serve a stale document before re-reading. */
  ttlMs?: number;
  now?: () => number;
}

/**
 * Wraps a raw Store with a short in-memory cache and a write-through invalidation.
 *
 * The cache exists because the inference path reads the document on every request when a store is
 * configured. It is not request-scoped data (which would be a bug); it is a deliberate, shared
 * snapshot of a config file, and a write from this isolate is visible immediately. Across isolates
 * the last writer wins, which is the honest limit of a stateless Worker - see docs/admin.md.
 */
export function createStoreLayer(store: Store | null, options: StoreLayerOptions = {}): StoreLayer {
  if (!store) {
    return {
      label: "off",
      writable: false,
      read: async () => null,
      raw: async () => null,
      write: async () => {
        throw new Error("no store is configured");
      },
    };
  }
  const target = store;
  const ttlMs = options.ttlMs ?? 5000;
  const now = options.now ?? (() => Date.now());
  let cached: { text: string | null; at: number } | null = null;

  async function raw(): Promise<string | null> {
    const at = now();
    if (cached && at - cached.at < ttlMs) return cached.text;
    const text = await target.read();
    cached = { text, at };
    return text;
  }

  return {
    label: target.label,
    writable: true,
    raw,
    read: async () => parseStoreDoc(await raw()),
    write: async (doc) => {
      const text = doc ? serializeDoc(doc) : null;
      await target.write(text);
      cached = { text, at: now() };
    },
  };
}

/**
 * A test/embedding helper: an in-process store. It also backs DUMMY_STORE=memory, which exists so
 * that every deployment target - including the ones with no filesystem and no KV - can run the
 * admin page in writable mode for a demo. Nothing survives a restart.
 */
export function memoryStore(initial: string | null = null): Store {
  let value = initial;
  return {
    label: "memory",
    read: async () => value,
    write: async (next) => {
      value = next;
    },
  };
}

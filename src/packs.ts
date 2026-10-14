import { MAX_PERSONAS, STORE_VERSION, sanitizeDefaults, sanitizePersona } from "./store.ts";
import type { Persona, StoreDefaults, StoreDoc } from "./types.ts";

/**
 * Packs: a small JSON document someone can publish, and the button that turns it into a diff.
 *
 * The server never fetches a pack. The browser fetches it (raw.githubusercontent.com and gist both
 * send access-control-allow-origin: *), shows the diff, and posts the JSON back - which keeps the
 * project's "no outbound requests" property true.
 */

/** One place to change if this repository moves. scripts/set-repo.mjs rewrites it. */
export const REPO = "lco117/dummy-llm";
export const PACK_BASE_URL = `https://raw.githubusercontent.com/${REPO}/main/packs`;

export interface PackIndexEntry {
  name: string;
  description: string;
  file: string;
  url: string;
}

export const PACK_INDEX: PackIndexEntry[] = [
  {
    name: "shout",
    description: "Screams your message back inside a box, using the upper and box filters.",
    file: "shout.json",
    url: `${PACK_BASE_URL}/shout.json`,
  },
  {
    name: "mirror",
    description: "Two personas: one reverses everything, one answers a keyword map.",
    file: "mirror.json",
    url: `${PACK_BASE_URL}/mirror.json`,
  },
  {
    name: "shrug",
    description: "A keyword -> reply map with a fallback, plus a quieter thinking pool.",
    file: "shrug.json",
    url: `${PACK_BASE_URL}/shrug.json`,
  },
];

export interface Pack {
  name?: string;
  description?: string;
  personas?: Record<string, Persona | null>;
  defaults?: StoreDefaults;
  models?: string[] | null;
}

/** Validates untrusted JSON into a pack. Unknown keys are ignored, junk is dropped. */
export function parsePack(raw: unknown): { pack: Pack; errors: string[] } {
  const errors: string[] = [];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { pack: {}, errors: ["a pack must be a JSON object"] };
  }
  const source = raw as Record<string, unknown>;
  const pack: Pack = {};
  if (typeof source.name === "string") pack.name = source.name.slice(0, 120);
  if (typeof source.description === "string") pack.description = source.description.slice(0, 500);
  if (source.personas !== undefined) {
    if (source.personas === null || typeof source.personas !== "object" || Array.isArray(source.personas)) {
      errors.push('"personas" must be an object');
    } else {
      const personas: Record<string, Persona | null> = {};
      for (const [id, value] of Object.entries(source.personas as Record<string, unknown>)) {
        const persona = sanitizePersona(value);
        if (persona === undefined) {
          errors.push(`persona "${id}" is not a valid persona object`);
          continue;
        }
        personas[id.slice(0, 120)] = persona;
      }
      pack.personas = personas;
    }
  }
  if (source.defaults !== undefined) {
    const defaults = sanitizeDefaults(source.defaults);
    if (!defaults) errors.push('"defaults" must be an object');
    else pack.defaults = defaults;
  }
  if (Array.isArray(source.models)) {
    const models = source.models.filter((item): item is string => typeof item === "string" && item.trim() !== "");
    if (models.length > 0) pack.models = models.slice(0, MAX_PERSONAS);
  }
  if (!pack.personas && !pack.defaults && !pack.models) errors.push("the pack has nothing to import");
  return { pack, errors };
}

/** A pack is stored as a document: same shape, minus the presentation fields. */
export function packToDoc(pack: Pack): StoreDoc {
  const doc: StoreDoc = { version: STORE_VERSION, personas: {}, defaults: {} };
  if (pack.personas) doc.personas = { ...pack.personas };
  if (pack.defaults) doc.defaults = { ...pack.defaults };
  if (pack.models) doc.models = [...pack.models];
  return doc;
}

export function docToPack(doc: StoreDoc, name = "dummy-llm-export"): Pack {
  return {
    name,
    description: "Exported from the dummy-llm admin page.",
    personas: { ...(doc.personas ?? {}) },
    defaults: { ...(doc.defaults ?? {}) },
    ...(doc.models ? { models: [...doc.models] } : {}),
  };
}

/** Merging is shallow per persona and per default, which is what "import" should mean. */
export function mergeDoc(current: StoreDoc | null, incoming: StoreDoc): StoreDoc {
  const base = current ?? { version: STORE_VERSION, personas: {}, defaults: {} };
  const personas: Record<string, Persona | null> = { ...(base.personas ?? {}) };
  for (const [id, persona] of Object.entries(incoming.personas ?? {})) {
    if (persona === null) {
      personas[id] = null;
      continue;
    }
    personas[id] = { ...(personas[id] ?? {}), ...persona };
  }
  return {
    version: STORE_VERSION,
    personas,
    defaults: { ...(base.defaults ?? {}), ...(incoming.defaults ?? {}) },
    models: incoming.models ?? base.models ?? null,
    updatedAt: incoming.updatedAt ?? base.updatedAt ?? null,
    updatedBy: incoming.updatedBy ?? base.updatedBy ?? null,
  };
}

export interface DocDiff {
  personas: { added: string[]; changed: string[]; removed: string[] };
  defaults: Array<{ key: string; from: unknown; to: unknown }>;
  models: { from: string[] | null; to: string[] | null } | null;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** What applying `incoming` would change about the stored document. */
export function diffDoc(current: StoreDoc | null, incoming: StoreDoc): DocDiff {
  const before = current?.personas ?? {};
  const after = incoming.personas ?? {};
  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];
  for (const [id, persona] of Object.entries(after)) {
    const previous = before[id];
    const isTombstone = persona === null;
    if (isTombstone) {
      if (previous !== undefined && previous !== null) removed.push(id);
      continue;
    }
    if (previous === undefined) added.push(id);
    else if (!same(previous, persona)) changed.push(id);
  }
  const defaults: Array<{ key: string; from: unknown; to: unknown }> = [];
  for (const [key, value] of Object.entries(incoming.defaults ?? {})) {
    defaults.push({ key, from: (current?.defaults ?? {})[key as keyof StoreDefaults] ?? null, to: value });
  }
  const models = same(current?.models ?? null, incoming.models ?? null)
    ? null
    : { from: current?.models ?? null, to: incoming.models ?? null };
  return { personas: { added, changed, removed }, defaults, models };
}

import { BUILTIN_PERSONAS } from "./personas.ts";
import type { Persona } from "./types.ts";
import { parseFaultSpec } from "./errors.ts";
import type { ChunkMode, Config, LogLevel, Mode } from "./types.ts";

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
  text: "6",
  mode: "echo" as Mode,
  // ~4 characters is roughly one token for English text, so TPS means tokens/s.
  chunk: 4 as ChunkMode,
  tps: 100,
  log: "off" as LogLevel,
  maxBodyBytes: 1_000_000,
  ttftMs: 0,
  seed: 1,
  cors: "*",
  thinking: DEFAULT_THINKING_POOL as string[],
};

const MODES: Mode[] = ["fixed", "echo", "random", "canned"];
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

function tpsToDelay(tps: number): number {
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

function thinkingPool(value: string | undefined): string[] {
  if (value === undefined) return DEFAULTS.thinking;
  if (OFF.has(value.trim().toLowerCase())) return [];
  const templates = value.split("|").map((item) => item.trim()).filter(Boolean);
  return templates.length > 0 ? templates : DEFAULTS.thinking;
}

/**
 * Turns environment variables into a Config. Every runtime feeds this:
 * Node passes `process.env`, a Worker passes the `env` binding.
 */
export function resolveConfig(env: Env = {}, overrides: Partial<Config> = {}): Config {
  const mode = (env.DUMMY_MODE as Mode | undefined) ?? DEFAULTS.mode;
  const text = env.DUMMY_TEXT ?? DEFAULTS.text;
  const lines = env.DUMMY_LINES
    ? env.DUMMY_LINES.split("|").map((line) => line.trim()).filter(Boolean)
    : [text];

  let canned: Record<string, string> = {};
  if (env.DUMMY_CANNED) {
    try {
      const parsed = JSON.parse(env.DUMMY_CANNED) as Record<string, string>;
      if (parsed && typeof parsed === "object") canned = parsed;
    } catch {
      canned = {};
    }
  }

  const tps = wholeNumber(env.DUMMY_TPS, DEFAULTS.tps);
  const personas = { ...BUILTIN_PERSONAS, ...personaOverrides(env.DUMMY_PERSONAS) };
  const seedProvided = hasValue(env.DUMMY_SEED);
  const deterministic = seedProvided || overrides.seed !== undefined || overrides.deterministic === true;
  const explicitDelay = env.DUMMY_DELAY_MS !== undefined && env.DUMMY_DELAY_MS.trim() !== "";

  return {
    deterministic,
    text,
    mode: MODES.includes(mode) ? mode : DEFAULTS.mode,
    lines: lines.length > 0 ? lines : [text],
    canned,
    chunk: chunkMode(env.DUMMY_CHUNK),
    tps,
    delayMs: explicitDelay ? wholeNumber(env.DUMMY_DELAY_MS, tpsToDelay(tps)) : tpsToDelay(tps),
    ttftMs: wholeNumber(env.DUMMY_TTFT_MS, DEFAULTS.ttftMs),
    seed: wholeNumber(env.DUMMY_SEED, DEFAULTS.seed),
    fail: parseFaultSpec(env.DUMMY_FAIL),
    hangMs: wholeNumber(env.DUMMY_HANG_MS, 0),
    apiKey: env.DUMMY_API_KEY && env.DUMMY_API_KEY.trim() !== "" ? env.DUMMY_API_KEY.trim() : null,
    cors: env.DUMMY_CORS ?? DEFAULTS.cors,
    models: list(env.DUMMY_MODELS, Object.keys(personas)),
    toolCall: env.DUMMY_TOOLCALL && env.DUMMY_TOOLCALL.trim() !== "" ? env.DUMMY_TOOLCALL : null,
    thinking: thinkingPool(env.DUMMY_THINKING),
    echoRaw: boolean(env.DUMMY_ECHO_RAW),
    log: logLevel(env.DUMMY_LOG),
    maxBodyBytes: wholeNumber(env.DUMMY_MAX_BODY, DEFAULTS.maxBodyBytes),
    strip: env.DUMMY_STRIP ? env.DUMMY_STRIP.split("|").map((item) => item.trim()).filter(Boolean) : [],
    personas,
    now: () => Date.now(),
    ...overrides,
  };
}

/** Node helper. Safe to call anywhere: workerd has no `process`. */
export function processEnv(): Env {
  if (typeof process === "undefined" || !process.env) return {};
  return process.env as Env;
}

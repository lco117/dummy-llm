import { DEFAULT_MODELS } from "./models.ts";
import { parseFaultSpec } from "./errors.ts";
import type { ChunkMode, Config, LogLevel, Mode } from "./types.ts";

export interface Env {
  [key: string]: string | undefined;
}

/** Hardcoded "reasoning". {input} is what the user said, {reply} is what we will say back. */
export const DEFAULT_THINKING =
  'We need answer to user. User just said "{input}". Need infer? Probably minimal. We need respond maybe "{reply}".';

export const DEFAULTS = {
  text: "6",
  mode: "echo" as Mode,
  chunk: 1 as ChunkMode,
  tps: 100,
  log: "off" as LogLevel,
  ttftMs: 0,
  seed: 1,
  cors: "*",
  thinking: DEFAULT_THINKING as string | null,
};

const MODES: Mode[] = ["fixed", "echo", "random", "canned"];
const OFF = new Set(["", "off", "none", "false", "no", "0", "disable", "disabled"]);

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

function thinkingTemplate(value: string | undefined): string | null {
  if (value === undefined) return DEFAULTS.thinking;
  return OFF.has(value.trim().toLowerCase()) ? null : value;
}

/**
 * Turns environment variables into a Config. Every runtime feeds this:
 * Node passes `process.env`, a Worker passes the `env` binding.
 */
export function resolveConfig(env: Env = {}, overrides: Partial<Config> = {}): Config {
  const mode = (env.PARROT_MODE as Mode | undefined) ?? DEFAULTS.mode;
  const text = env.PARROT_TEXT ?? DEFAULTS.text;
  const lines = env.PARROT_LINES
    ? env.PARROT_LINES.split("|").map((line) => line.trim()).filter(Boolean)
    : [text];

  let canned: Record<string, string> = {};
  if (env.PARROT_CANNED) {
    try {
      const parsed = JSON.parse(env.PARROT_CANNED) as Record<string, string>;
      if (parsed && typeof parsed === "object") canned = parsed;
    } catch {
      canned = {};
    }
  }

  const tps = wholeNumber(env.PARROT_TPS, DEFAULTS.tps);
  const explicitDelay = env.PARROT_DELAY_MS !== undefined && env.PARROT_DELAY_MS.trim() !== "";

  return {
    text,
    mode: MODES.includes(mode) ? mode : DEFAULTS.mode,
    lines: lines.length > 0 ? lines : [text],
    canned,
    chunk: chunkMode(env.PARROT_CHUNK),
    tps,
    delayMs: explicitDelay ? wholeNumber(env.PARROT_DELAY_MS, tpsToDelay(tps)) : tpsToDelay(tps),
    ttftMs: wholeNumber(env.PARROT_TTFT_MS, DEFAULTS.ttftMs),
    seed: wholeNumber(env.PARROT_SEED, DEFAULTS.seed),
    fail: parseFaultSpec(env.PARROT_FAIL),
    hangMs: wholeNumber(env.PARROT_HANG_MS, 0),
    apiKey: env.PARROT_API_KEY && env.PARROT_API_KEY.trim() !== "" ? env.PARROT_API_KEY.trim() : null,
    cors: env.PARROT_CORS ?? DEFAULTS.cors,
    models: list(env.PARROT_MODELS, DEFAULT_MODELS),
    toolCall: env.PARROT_TOOLCALL && env.PARROT_TOOLCALL.trim() !== "" ? env.PARROT_TOOLCALL : null,
    thinking: thinkingTemplate(env.PARROT_THINKING),
    echoRaw: boolean(env.PARROT_ECHO_RAW),
    log: logLevel(env.PARROT_LOG),
    now: () => Date.now(),
    ...overrides,
  };
}

/** Node helper. Safe to call anywhere: workerd has no `process`. */
export function processEnv(): Env {
  if (typeof process === "undefined" || !process.env) return {};
  return process.env as Env;
}

import { pick } from "./random.ts";
import { FaultError } from "./errors.ts";
import type { CanonRequest, Config, Piece } from "./types.ts";

export function sleep(ms: number): Promise<void> {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function lastUserMessage(canon: CanonRequest): string {
  const lastUser = [...canon.messages].reverse().find((message) => message.role === "user");
  return lastUser?.content ?? "";
}

const REMINDER_BLOCK = /<system-reminder>[\s\S]*?<\/system-reminder>/gi;
const REMINDER_UNCLOSED = /<system-reminder>[\s\S]*$/i;

/**
 * Harness metadata that arrives as plain *user* text, with no tags around it.
 * DSH, for example, appends this to every turn:
 *
 *   Time sampled while preparing turn 1, step 1: 2026-10-13T18:09:13+08:00[Asia/Shanghai]
 *   Browser time zone for this request: Asia/Shanghai. …
 *   Elapsed since the preceding model-visible message: unavailable.
 *
 * A human did not type that, so echoing it is technically correct and completely useless.
 */
const HARNESS_LINE =
  /^(Time sampled while preparing turn .*|Browser time zone for this request:.*|Elapsed since the preceding model-visible message:.*|Current runtime context\..*|Current DSH file policy:.*|Approval policy:.*)$/gim;

/**
 * Agent harnesses append their own noise to the conversation as *user* messages.
 * Drop the tagged blocks, the plain metadata lines, then any extra patterns the
 * operator configured through NPC_STRIP.
 */
export function stripReminders(text: string, extra: string[] = []): string {
  let out = text.replace(REMINDER_BLOCK, "").replace(REMINDER_UNCLOSED, "").replace(HARNESS_LINE, "");
  for (const pattern of extra) {
    if (pattern === "") continue;
    try {
      out = out.replace(new RegExp(pattern, "gim"), "");
    } catch {
      // an operator-supplied pattern that does not compile is simply ignored
    }
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * What the human actually said: the last user message that still has content
 * after stripping harness noise. If the newest one was nothing but a reminder,
 * we fall back to the one before it.
 */
export function userInput(canon: CanonRequest, cfg: Config): string {
  const users = canon.messages.filter((message) => message.role === "user");
  for (let i = users.length - 1; i >= 0; i--) {
    const text = cfg.echoRaw ? users[i].content : stripReminders(users[i].content, cfg.strip);
    if (text !== "") return text;
  }
  return "";
}

export interface TemplateVars {
  input: string;
  raw: string;
  model: string;
  reply?: string;
  text?: string;
}

/**
 * Substitutes placeholders. Used both for the answer template (`NPC_TEXT` in
 * fixed mode) and for the thinking template:
 *   {input} the cleaned-up user message   {raw} the untouched last user message
 *   {model} the requested model           {reply} the answer   {text} NPC_TEXT
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  let out = template.split("{input}").join(vars.input).split("{raw}").join(vars.raw).split("{model}").join(vars.model);
  if (vars.reply !== undefined) out = out.split("{reply}").join(vars.reply);
  if (vars.text !== undefined) out = out.split("{text}").join(vars.text);
  return out;
}

export function templateVars(canon: CanonRequest, cfg: Config, reply?: string): TemplateVars {
  return { input: userInput(canon, cfg), raw: lastUserMessage(canon), model: canon.model, reply, text: cfg.text };
}

/** The entire "intelligence" of this project. */
export function buildText(canon: CanonRequest, cfg: Config, rand: () => number): string {
  const vars = templateVars(canon, cfg);
  switch (cfg.mode) {
    case "echo":
      // It says whatever you said. That is the whole trick.
      return vars.input || cfg.text;
    case "random":
      return renderTemplate(pick(rand, cfg.lines.length > 0 ? cfg.lines : [cfg.text]), vars);
    case "canned": {
      const haystack = canon.messages.map((message) => message.content).join(" ").toLowerCase();
      for (const [keyword, reply] of Object.entries(cfg.canned)) {
        if (keyword !== "" && haystack.includes(keyword.toLowerCase())) return renderTemplate(reply, vars);
      }
      return renderTemplate(cfg.text, vars);
    }
    default:
      // fixed: the same template every time, with the user's words dropped in.
      return renderTemplate(cfg.text, vars);
  }
}

/** The "reasoning" is a template too. */
/** One template per request, picked from the pool — the NPC keeps changing its mind. */
export function renderThinking(canon: CanonRequest, cfg: Config, reply: string, rand: () => number): string | null {
  if (!cfg.thinking || cfg.thinking.length === 0) return null;
  const template = cfg.thinking.length === 1 ? cfg.thinking[0] : pick(rand, cfg.thinking);
  return renderTemplate(template, templateVars(canon, cfg, reply));
}

export interface Answer {
  reply: string;
  thinking: string | null;
}

export function plan(canon: CanonRequest, cfg: Config, rand: () => number): Answer {
  const reply = buildText(canon, cfg, rand);
  return { reply, thinking: renderThinking(canon, cfg, reply, rand) };
}

/** Splits by code point, never by UTF-16 unit, so emoji and CJK survive intact. */
export function chunkText(text: string, chunk: Config["chunk"]): string[] {
  if (text === "") return [];
  if (chunk === "whole") return [text];
  if (chunk === "word") return text.match(/\S+\s*/g) ?? [text];
  if (chunk === "line") return text.match(/[^\n]*\n|[^\n]+/g) ?? [text];
  const size = typeof chunk === "number" && chunk > 0 ? chunk : 1;
  const points = Array.from(text);
  const out: string[] = [];
  for (let i = 0; i < points.length; i += size) out.push(points.slice(i, i + size).join(""));
  return out;
}

export function estimateTokens(text: string): number {
  return text.length === 0 ? 0 : Math.max(1, Math.ceil(text.length / 4));
}

export function promptTokens(canon: CanonRequest): number {
  return estimateTokens(canon.messages.map((message) => message.content).join("\n"));
}

export function usageFor(canon: CanonRequest, completion: string): {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
} {
  const prompt = promptTokens(canon);
  const completionCount = estimateTokens(completion);
  return { prompt_tokens: prompt, completion_tokens: completionCount, total_tokens: prompt + completionCount };
}

export interface Phase {
  channel: "thinking" | "text";
  text: string;
  index: number;
}

/**
 * Produces the answer piece by piece — the thinking channel first, then the reply —
 * paying the simulated latency bill (`delayMs` per piece, derived from NPC_TPS).
 * Throws FaultError when a mid-stream fault is configured, which is exactly the case
 * every client's retry logic gets wrong. `NPC_FAIL=500:after=N` counts every
 * streamed piece, thinking included.
 */
export async function* phasesFor(
  answer: Answer,
  cfg: Config,
  rand: () => number,
  options: { thinking?: boolean } = {},
): AsyncGenerator<Phase> {
  const channels: Array<["thinking" | "text", string[]]> = [];
  if (options.thinking !== false && answer.thinking) channels.push(["thinking", chunkText(answer.thinking, cfg.chunk)]);
  channels.push(["text", chunkText(answer.reply, cfg.chunk)]);

  await sleep(cfg.hangMs);
  await sleep(cfg.ttftMs);

  // Absolute schedule rather than "sleep(delay) per piece": timers in Workers and
  // Node overshoot a little every time, and the error compounds until a 100 tps
  // stream is really running at 50. Targeting "piece i is due at start + i * interval"
  // makes the long-run rate equal NPC_TPS even when individual timers are late.
  const interval = cfg.delayMs;
  const started = Date.now();
  let emitted = 0;
  for (const [channel, parts] of channels) {
    let index = 0;
    for (const part of parts) {
      if (cfg.fail && cfg.fail.after !== undefined && emitted === cfg.fail.after) throw new FaultError(cfg.fail);
      if (emitted > 0 && interval > 0) {
        const wait = started + emitted * interval - Date.now();
        if (wait > 0) await sleep(wait);
      }
      yield { channel, text: part, index };
      index++;
      emitted++;
    }
  }

  if (cfg.fail && cfg.fail.after !== undefined && emitted === cfg.fail.after) throw new FaultError(cfg.fail);
}

export async function* phases(
  canon: CanonRequest,
  cfg: Config,
  rand: () => number,
  options: { thinking?: boolean } = {},
): AsyncGenerator<Phase> {
  yield* phasesFor(plan(canon, cfg, rand), cfg, rand, options);
}

/** Text-only view of the same stream, used by the legacy completions endpoint. */
export async function* contentPieces(canon: CanonRequest, cfg: Config, rand: () => number): AsyncGenerator<Piece> {
  for await (const phase of phases(canon, cfg, rand, { thinking: false })) {
    if (phase.channel === "text") yield { text: phase.text, index: phase.index };
  }
}

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

/** The entire "intelligence" of this project. */
export function buildText(canon: CanonRequest, cfg: Config, rand: () => number): string {
  switch (cfg.mode) {
    case "echo":
      // It says whatever you said. That is the whole trick.
      return lastUserMessage(canon) || cfg.text;
    case "random":
      return pick(rand, cfg.lines.length > 0 ? cfg.lines : [cfg.text]);
    case "canned": {
      const haystack = canon.messages.map((message) => message.content).join(" ").toLowerCase();
      for (const [keyword, reply] of Object.entries(cfg.canned)) {
        if (keyword !== "" && haystack.includes(keyword.toLowerCase())) return reply;
      }
      return cfg.text;
    }
    default:
      return cfg.text;
  }
}

/**
 * The "reasoning" is hardcoded too: a template with the user's words dropped in.
 * Placeholders: {input} {reply} {model} {text}
 */
export function renderThinking(canon: CanonRequest, cfg: Config, reply: string): string | null {
  if (!cfg.thinking) return null;
  return cfg.thinking
    .split("{input}").join(lastUserMessage(canon))
    .split("{reply}").join(reply)
    .split("{model}").join(canon.model)
    .split("{text}").join(cfg.text);
}

export interface Answer {
  reply: string;
  thinking: string | null;
}

export function plan(canon: CanonRequest, cfg: Config, rand: () => number): Answer {
  const reply = buildText(canon, cfg, rand);
  return { reply, thinking: renderThinking(canon, cfg, reply) };
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
 * paying the simulated latency bill. Throws FaultError when a mid-stream fault is
 * configured, which is exactly the case every client's retry logic gets wrong.
 * `PARROT_FAIL=500:after=N` counts every streamed piece, thinking included.
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

  let emitted = 0;
  for (const [channel, parts] of channels) {
    let index = 0;
    for (const part of parts) {
      if (cfg.fail && cfg.fail.after !== undefined && emitted === cfg.fail.after) throw new FaultError(cfg.fail);
      if (emitted > 0 && cfg.delayMs > 0) {
        const jitter = cfg.delayMs * 0.5;
        await sleep(Math.max(0, Math.round(cfg.delayMs + (rand() * 2 - 1) * jitter)));
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

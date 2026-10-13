import { pick } from "./random.ts";
import { FaultError } from "./errors.ts";
import type { CanonRequest, Config, Piece } from "./types.ts";

export function sleep(ms: number): Promise<void> {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The entire "intelligence" of this project. */
export function buildText(canon: CanonRequest, cfg: Config, rand: () => number): string {
  switch (cfg.mode) {
    case "echo": {
      const lastUser = [...canon.messages].reverse().find((message) => message.role === "user");
      return lastUser?.content ?? cfg.text;
    }
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

/**
 * Produces the answer piece by piece, paying the simulated latency bill.
 * Throws FaultError when a mid-stream fault is configured, which is exactly
 * the case every client's retry logic gets wrong.
 */
export async function* contentPieces(canon: CanonRequest, cfg: Config, rand: () => number): AsyncGenerator<Piece> {
  const text = buildText(canon, cfg, rand);
  const parts = chunkText(text, cfg.chunk);

  await sleep(cfg.hangMs);
  await sleep(cfg.ttftMs);

  let index = 0;
  for (const part of parts) {
    if (cfg.fail && cfg.fail.after !== undefined && index === cfg.fail.after) throw new FaultError(cfg.fail);
    if (index > 0 && cfg.delayMs > 0) {
      const jitter = cfg.delayMs * 0.5;
      await sleep(Math.max(0, Math.round(cfg.delayMs + (rand() * 2 - 1) * jitter)));
    }
    yield { text: part, index };
    index++;
  }

  if (cfg.fail && cfg.fail.after !== undefined && index === cfg.fail.after) throw new FaultError(cfg.fail);
}

export type ProtocolId = "openai-chat" | "openai-responses" | "anthropic" | "gemini" | "ollama";

export type Mode = "fixed" | "echo" | "random" | "canned";

export type ChunkMode = number | "word" | "line" | "whole";

export interface CanonMessage {
  role: string;
  content: string;
}

/** Every protocol is parsed down to this, so the engine never learns about wire formats. */
export interface CanonRequest {
  protocol: ProtocolId;
  model: string;
  messages: CanonMessage[];
  stream: boolean;
  includeUsage: boolean;
  tools?: unknown;
  raw: unknown;
}

export interface Fault {
  status: number;
  /** When set, the fault happens after this many content frames instead of before the stream. */
  after?: number;
  message?: string;
}

export interface Config {
  text: string;
  mode: Mode;
  lines: string[];
  canned: Record<string, string>;
  chunk: ChunkMode;
  delayMs: number;
  ttftMs: number;
  seed: number;
  fail: Fault | null;
  hangMs: number;
  apiKey: string | null;
  cors: string;
  models: string[];
  toolCall: string | null;
  thinking: string | null;
  /** Echo the user's message untouched, without stripping <system-reminder> blocks. */
  echoRaw: boolean;
  now: () => number;
}

export interface Ctx {
  cfg: Config;
  url: URL;
  rand: () => number;
}

export interface Piece {
  text: string;
  index: number;
}

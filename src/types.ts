export type ProtocolId = "openai-chat" | "openai-responses" | "anthropic" | "gemini" | "ollama";

export type Mode = "fixed" | "echo" | "random" | "canned";

export type LogLevel = "off" | "summary" | "full";

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
  /** Streamed pieces (tokens) per second. delayMs is derived from this unless set explicitly. */
  tps: number;
  /** True when PARROT_SEED was given (or a test pinned one): ids and picks stop being random. */
  deterministic: boolean;
  delayMs: number;
  ttftMs: number;
  seed: number;
  fail: Fault | null;
  hangMs: number;
  apiKey: string | null;
  cors: string;
  models: string[];
  toolCall: string | null;
  /** Thinking templates. Empty array = no thinking channel. */
  thinking: string[];
  /** Echo the user's message untouched, without stripping <system-reminder> blocks. */
  echoRaw: boolean;
  /** Log every received request (visible via "wrangler tail" on Cloudflare). */
  log: LogLevel;
  /** Reject request bodies larger than this. 0 disables the check. */
  maxBodyBytes: number;
  /** Extra regexes removed from user messages before echoing (on top of the built-in rules). */
  strip: string[];
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

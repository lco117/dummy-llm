export type ProtocolId = "openai-chat" | "openai-responses" | "anthropic" | "gemini" | "ollama";

export type LogLevel = "off" | "summary" | "full";

export type ChunkMode = number | "word" | "line" | "whole";

/**
 * What a persona answers with. The **shape carries the behaviour**, so there is no
 * separate "mode" to keep in sync with it:
 *
 *   "{input}"            one template  (echo is just the template "{input}")
 *   ["a", "b", "c"]      draw one at random
 *   { "*": "hi", ... }   keyword -> template; "*" is the fallback
 */
export type Reply = string | string[] | Record<string, string>;

/** A named answer profile, selected by the model id the client sends. */
export interface Persona {
  reply?: Reply;
  /** Thinking templates. An empty array silences the reasoning channel. */
  thinking?: string[];
  /** Shown on the landing page and in the docs. */
  description?: string;
}

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
  /** The default persona's answer. */
  reply: Reply;
  /** The default persona's thinking pool. */
  thinking: string[];
  /** Answer profiles keyed by model id. An unknown model falls through to the two fields above. */
  personas: Record<string, Persona>;
  chunk: ChunkMode;
  /** Streamed pieces (tokens) per second. delayMs is derived from this unless set explicitly. */
  tps: number;
  /** True when DUMMY_SEED was given (or a test pinned one): ids and picks stop being random. */
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
  /** Repeat the user's message untouched, without stripping harness noise. */
  echoRaw: boolean;
  /** Log every received request (visible via "wrangler tail" on Cloudflare). */
  log: LogLevel;
  /** Reject request bodies larger than this. 0 disables the check. */
  maxBodyBytes: number;
  /** Extra regexes removed from user messages before echoing (on top of the built-in rules). */
  strip: string[];
  /**
   * Let a caller supply the reply template for one request through ?t= (see playgroundOverride).
   * Off by default: a deployment only exposes this on purpose.
   */
  playground: boolean;
  /** Truncate a rendered reply at this many code points. 0 means no limit. */
  maxReplyChars: number;
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

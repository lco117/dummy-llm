import { createApp } from "../src/index.ts";
import { resolveConfig } from "../src/config.ts";
import type { Config } from "../src/types.ts";

export const FIXED_NOW = 1786000000000;

export interface Case {
  name: string;
  method: "GET" | "POST";
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  config?: Partial<Config>;
}

export function makeApp(overrides: Partial<Config> = {}) {
  const env = { PARROT_TEXT: "6", PARROT_DELAY_MS: "0", PARROT_TTFT_MS: "0" };
  return createApp(resolveConfig(env, { now: () => FIXED_NOW, ...overrides }));
}

/** Ids and durations are the only non-deterministic parts of a response. */
export function normalize(raw: string): string {
  return raw
    .replace(/(chatcmpl-|cmpl-|resp_|msg_|call_)[A-Za-z0-9]+/g, "$1ID")
    .replace(/"total_duration":\d+/g, "\"total_duration\":0")
    .replace(/"load_duration":\d+/g, "\"load_duration\":0")
    .replace(/"eval_duration":\d+/g, "\"eval_duration\":0")
    .replace(/"prompt_eval_duration":\d+/g, "\"prompt_eval_duration\":0");
}

export async function runCase(testCase: Case): Promise<string> {
  const app = makeApp(testCase.config);
  const request = new Request(`http://localhost${testCase.path}`, {
    method: testCase.method,
    headers: { "content-type": "application/json", ...(testCase.headers ?? {}) },
    body: testCase.body === undefined ? undefined : JSON.stringify(testCase.body),
  });
  const response = await app(request);
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  return `# status: ${response.status}\n# content-type: ${contentType}\n${normalize(text)}`;
}

const USER = { role: "user", content: "hi" };

export const CASES: Case[] = [
  { name: "openai-chat-stream", method: "POST", path: "/v1/chat/completions", body: { model: "gpt-4o", messages: [USER], stream: true } },
  { name: "openai-chat-sync", method: "POST", path: "/v1/chat/completions", body: { model: "gpt-4o", messages: [USER] } },
  {
    name: "openai-chat-usage",
    method: "POST",
    path: "/v1/chat/completions",
    body: { model: "gpt-4o", messages: [USER], stream: true, stream_options: { include_usage: true } },
  },
  {
    name: "openai-chat-echo",
    method: "POST",
    path: "/v1/chat/completions",
    body: { model: "gpt-4o", messages: [{ role: "user", content: "hello there" }], stream: true },
    config: { mode: "echo" },
  },
  { name: "openai-chat-toolcall", method: "POST", path: "/v1/chat/completions", body: { model: "gpt-4o", messages: [USER], stream: true, tools: [{ type: "function", function: { name: "get_weather" } }] }, config: { toolCall: "get_weather" } },
  { name: "openai-completions", method: "POST", path: "/v1/completions", body: { model: "gpt-3.5-turbo-instruct", prompt: "hi", stream: true } },
  { name: "openai-embeddings", method: "POST", path: "/v1/embeddings", body: { model: "text-embedding-3-small", input: ["hi"], dimensions: 4 } },
  { name: "openai-models", method: "GET", path: "/v1/models" },
  { name: "openai-responses-stream", method: "POST", path: "/v1/responses", body: { model: "gpt-4o", input: "hi", stream: true } },
  { name: "openai-responses-sync", method: "POST", path: "/v1/responses", body: { model: "gpt-4o", input: "hi" } },
  {
    name: "anthropic-messages-stream",
    method: "POST",
    path: "/v1/messages",
    headers: { "anthropic-version": "2023-06-01", "x-api-key": "sk-ant-test" },
    body: { model: "claude-sonnet-4-20250514", max_tokens: 16, messages: [USER], stream: true },
  },
  {
    name: "anthropic-messages-sync",
    method: "POST",
    path: "/v1/messages",
    headers: { "anthropic-version": "2023-06-01", "x-api-key": "sk-ant-test" },
    body: { model: "claude-sonnet-4-20250514", max_tokens: 16, messages: [USER] },
  },
  { name: "anthropic-count-tokens", method: "POST", path: "/v1/messages/count_tokens", headers: { "anthropic-version": "2023-06-01" }, body: { model: "claude-sonnet-4-20250514", messages: [USER] } },
  { name: "gemini-generate", method: "POST", path: "/v1beta/models/gemini-2.5-flash:generateContent", body: { contents: [{ role: "user", parts: [{ text: "hi" }] }] } },
  { name: "gemini-stream", method: "POST", path: "/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse", body: { contents: [{ role: "user", parts: [{ text: "hi" }] }] } },
  { name: "ollama-chat-stream", method: "POST", path: "/api/chat", body: { model: "llama3.2", messages: [USER] } },
  { name: "ollama-chat-sync", method: "POST", path: "/api/chat", body: { model: "llama3.2", messages: [USER], stream: false } },
  { name: "ollama-tags", method: "GET", path: "/api/tags" },
  { name: "healthz", method: "GET", path: "/healthz" },
  { name: "not-found", method: "GET", path: "/nope" },
  { name: "fault-429", method: "POST", path: "/v1/chat/completions", body: { model: "gpt-4o", messages: [USER], stream: true }, config: { fail: { status: 429 } } },
  { name: "fault-midstream", method: "POST", path: "/v1/chat/completions", body: { model: "gpt-4o", messages: [USER], stream: true }, config: { fail: { status: 429, after: 0 } } },
  { name: "auth-401", method: "POST", path: "/v1/chat/completions", body: { model: "gpt-4o", messages: [USER], stream: true }, config: { apiKey: "sk-parrot" } },
  {
    name: "anthropic-thinking",
    method: "POST",
    path: "/v1/messages",
    headers: { "anthropic-version": "2023-06-01", "x-api-key": "sk-ant-test" },
    body: { model: "claude-sonnet-4-20250514", max_tokens: 16, messages: [USER], stream: true },
    config: { thinking: "thinking about it" },
  },
];

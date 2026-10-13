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
  const env = { DUMMY_TEXT: "6", DUMMY_DELAY_MS: "0", DUMMY_TTFT_MS: "0" };
  // seed 1 makes the run deterministic: ids, random lines and the thinking template
  return createApp(resolveConfig(env, { seed: 1, now: () => FIXED_NOW, ...overrides }));
}

/** Ids and durations are the only non-deterministic parts of a response. */
export function normalize(raw: string): string {
  return raw
    .replace(/(chatcmpl-|cmpl-|resp_|rs_|msg_|call_)[A-Za-z0-9]+/g, "$1ID")
    .replace(/"total_duration":\d+/g, "\"total_duration\":0")
    .replace(/"load_duration":\d+/g, "\"load_duration\":0")
    .replace(/"eval_duration":\d+/g, "\"eval_duration\":0")
    .replace(/"prompt_eval_duration":\d+/g, "\"prompt_eval_duration\":0")
    // the reported version is the package version, which every release bumps
    .replace(/"version":"[^"]*"/g, "\"version\":\"VERSION\"");
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
const ABC = { role: "user", content: "abc" };
const ANTHROPIC_HEADERS = { "anthropic-version": "2023-06-01", "x-api-key": "sk-ant-test" };
const NO_THINKING: Partial<Config> = { thinking: [] };

export const CASES: Case[] = [
  // --- OpenAI Chat Completions ---
  { name: "openai-chat-stream", method: "POST", path: "/v1/chat/completions", body: { model: "gpt-4o", messages: [USER], stream: true } },
  { name: "openai-chat-sync", method: "POST", path: "/v1/chat/completions", body: { model: "gpt-4o", messages: [USER] } },
  { name: "openai-chat-abc", method: "POST", path: "/v1/chat/completions", body: { model: "gpt-4o", messages: [ABC] } },
  {
    name: "openai-chat-usage",
    method: "POST",
    path: "/v1/chat/completions",
    body: { model: "gpt-4o", messages: [USER], stream: true, stream_options: { include_usage: true } },
  },
  { name: "openai-chat-no-thinking", method: "POST", path: "/v1/chat/completions", body: { model: "gpt-4o", messages: [USER], stream: true }, config: NO_THINKING },
  { name: "openai-chat-fixed", method: "POST", path: "/v1/chat/completions", body: { model: "gpt-4o", messages: [USER], stream: true }, config: { mode: "fixed", thinking: [] } },
  {
    name: "openai-chat-custom-thinking",
    method: "POST",
    path: "/v1/chat/completions",
    body: { model: "gpt-4o", messages: [ABC], stream: true },
    config: { thinking: ['They said "{input}". I will say "{reply}". That is all I do.'] },
  },
  {
    name: "openai-chat-toolcall",
    method: "POST",
    path: "/v1/chat/completions",
    body: { model: "gpt-4o", messages: [USER], stream: true, tools: [{ type: "function", function: { name: "get_weather" } }] },
    config: { toolCall: "get_weather", thinking: [] },
  },
  { name: "openai-completions", method: "POST", path: "/v1/completions", body: { model: "gpt-3.5-turbo-instruct", prompt: "hi", stream: true } },
  { name: "openai-embeddings", method: "POST", path: "/v1/embeddings", body: { model: "text-embedding-3-small", input: ["hi"], dimensions: 4 } },
  { name: "openai-models", method: "GET", path: "/v1/models" },

  {
    name: "openai-chat-strips-reminder",
    method: "POST",
    path: "/v1/chat/completions",
    body: {
      model: "dummy-1",
      messages: [
        { role: "user", content: "hwfaeouheaw" },
        { role: "user", content: "<system-reminder>\nUpdated instructions from: AGENTS.md\n\nA wall of harness noise.\n</system-reminder>" },
      ],
    },
    config: { chunk: "whole" },
  },
  {
    name: "openai-chat-echo-raw",
    method: "POST",
    path: "/v1/chat/completions",
    body: { model: "dummy-1", messages: [{ role: "user", content: "hi <system-reminder>noise</system-reminder>" }] },
    config: { echoRaw: true, chunk: "whole" },
  },

  {
    name: "openai-chat-strips-harness-metadata",
    method: "POST",
    path: "/v1/chat/completions",
    body: {
      model: "dummy-1",
      messages: [
        { role: "user", content: "hi" },
        {
          role: "user",
          content:
            "Time sampled while preparing turn 1, step 1: 2026-10-13T18:09:13+08:00[Asia/Shanghai]\n" +
            "Browser time zone for this request: Asia/Shanghai. Interpret otherwise-unqualified dates and times in this zone.\n" +
            "Elapsed since the preceding model-visible message: unavailable.",
        },
      ],
    },
    config: { chunk: "whole" },
  },

  {
    name: "openai-chat-strips-model-changed",
    method: "POST",
    path: "/v1/chat/completions",
    body: {
      model: "dummy-1",
      messages: [
        { role: "user", content: "hi" },
        { role: "user", content: "[model changed: assistant turns above this point were generated by parrot-1; the session continues with dummy-1-mini]" },
      ],
    },
    config: { chunk: "whole" },
  },

  {
    name: "openai-chat-persona-not-a-model",
    method: "POST",
    path: "/v1/chat/completions",
    body: { model: "definitely-not-a-model", messages: [{ role: "user", content: "hi" }], stream: true },
    config: { chunk: "whole" },
  },
  {
    name: "openai-chat-filters",
    method: "POST",
    path: "/v1/chat/completions",
    body: { model: "gpt-4o", messages: [{ role: "user", content: "hello world" }] },
    config: { mode: "fixed", text: "say {input|upper} ({input|count} chars)", chunk: "whole", thinking: [] },
  },

  // --- OpenAI Responses ---
  { name: "openai-responses-stream", method: "POST", path: "/v1/responses", body: { model: "gpt-4o", input: "hi", stream: true } },
  { name: "openai-responses-sync", method: "POST", path: "/v1/responses", body: { model: "gpt-4o", input: "abc" } },
  { name: "openai-responses-no-thinking", method: "POST", path: "/v1/responses", body: { model: "gpt-4o", input: "hi", stream: true }, config: NO_THINKING },

  // --- Anthropic ---
  { name: "anthropic-messages-stream", method: "POST", path: "/v1/messages", headers: ANTHROPIC_HEADERS, body: { model: "claude-sonnet-4-20250514", max_tokens: 16, messages: [USER], stream: true } },
  { name: "anthropic-messages-sync", method: "POST", path: "/v1/messages", headers: ANTHROPIC_HEADERS, body: { model: "claude-sonnet-4-20250514", max_tokens: 16, messages: [ABC] } },
  { name: "anthropic-no-thinking", method: "POST", path: "/v1/messages", headers: ANTHROPIC_HEADERS, body: { model: "claude-sonnet-4-20250514", max_tokens: 16, messages: [USER], stream: true }, config: NO_THINKING },
  { name: "anthropic-count-tokens", method: "POST", path: "/v1/messages/count_tokens", headers: ANTHROPIC_HEADERS, body: { model: "claude-sonnet-4-20250514", messages: [USER] } },

  // --- Gemini ---
  { name: "gemini-generate", method: "POST", path: "/v1beta/models/gemini-2.5-flash:generateContent", body: { contents: [{ role: "user", parts: [{ text: "abc" }] }] } },
  { name: "gemini-stream", method: "POST", path: "/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse", body: { contents: [{ role: "user", parts: [{ text: "hi" }] }] } },

  // --- Ollama ---
  { name: "ollama-chat-stream", method: "POST", path: "/api/chat", body: { model: "llama3.2", messages: [USER] } },
  { name: "ollama-chat-sync", method: "POST", path: "/api/chat", body: { model: "llama3.2", messages: [ABC], stream: false } },
  { name: "ollama-generate-stream", method: "POST", path: "/api/generate", body: { model: "llama3.2", prompt: "abc" } },
  { name: "ollama-tags", method: "GET", path: "/api/tags" },

  // --- Server behaviour ---
  { name: "healthz", method: "GET", path: "/healthz" },
  { name: "not-found", method: "GET", path: "/nope" },
  { name: "fault-429", method: "POST", path: "/v1/chat/completions", body: { model: "gpt-4o", messages: [USER], stream: true }, config: { fail: { status: 429 } } },
  { name: "fault-midstream", method: "POST", path: "/v1/chat/completions", body: { model: "gpt-4o", messages: [USER], stream: true }, config: { fail: { status: 429, after: 0 } } },
  { name: "auth-401", method: "POST", path: "/v1/chat/completions", body: { model: "gpt-4o", messages: [USER], stream: true }, config: { apiKey: "sk-dummy" } },
];

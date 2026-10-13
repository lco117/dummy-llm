import { buildText, contentPieces, estimateTokens, phases, phasesFor, plan, promptTokens, usageFor } from "../engine.ts";
import { FaultError, HttpError, errorResponse, preflightFault, streamErrorFrame } from "../errors.ts";
import { randomId } from "../random.ts";
import { SSE_DONE, SSE_HEADERS, json, sse, streamResponse } from "../sse.ts";
import type { CanonMessage, CanonRequest, Ctx, ProtocolId } from "../types.ts";

export const PROTOCOL: ProtocolId = "openai-chat";
const CREATED = 1700000000;

export function normalizeContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) return String((part as { text?: unknown }).text ?? "");
        return "";
      })
      .join("");
  }
  if (content === null || content === undefined) return "";
  return JSON.stringify(content);
}

export function normalizeMessages(messages: unknown): CanonMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.map((entry) => {
    const message = (entry ?? {}) as Record<string, unknown>;
    return { role: String(message.role ?? "user"), content: normalizeContent(message.content) };
  });
}

export function canonical(body: unknown, ctx: Ctx, protocol: ProtocolId = PROTOCOL): CanonRequest {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, any>;
  return {
    protocol,
    model: typeof raw.model === "string" && raw.model !== "" ? raw.model : ctx.cfg.models[0],
    messages: normalizeMessages(raw.messages),
    stream: raw.stream === true,
    includeUsage: raw.stream_options?.include_usage === true,
    tools: raw.tools,
    raw,
  };
}

export function parseToolCall(raw: string): { name: string; arguments: string } {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && typeof parsed.name === "string") {
      const args = parsed.arguments;
      return { name: parsed.name, arguments: typeof args === "string" ? args : JSON.stringify(args ?? {}) };
    }
  } catch {
    // plain string: treat it as the function name
  }
  return { name: raw, arguments: "{}" };
}

export function models(ctx: Ctx): Response {
  return json({
    object: "list",
    data: ctx.cfg.models.map((id) => ({ id, object: "model", created: CREATED, owned_by: "parrot" })),
  });
}

export function modelIdFromPath(pathname: string): string {
  return decodeURIComponent(pathname.slice("/v1/models/".length));
}

export function model(id: string, ctx: Ctx): Response {
  if (!ctx.cfg.models.includes(id)) {
    return errorResponse(PROTOCOL, 404, `The model '${id}' does not exist or you do not have access to it.`);
  }
  return json({ id, object: "model", created: CREATED, owned_by: "parrot" });
}

export function chat(body: unknown, ctx: Ctx): Response {
  const canon = canonical(body, ctx);
  const fault = preflightFault(PROTOCOL, ctx);
  if (fault) return fault;
  return canon.stream ? streamChat(canon, ctx) : syncChat(canon, ctx);
}

function syncChat(canon: CanonRequest, ctx: Ctx): Response {
  const id = `chatcmpl-${randomId(ctx.rand, 24)}`;
  const answer = plan(canon, ctx.cfg, ctx.rand);
  const hasTool = Boolean(canon.tools && ctx.cfg.toolCall);
  const message: Record<string, unknown> = { role: "assistant", content: answer.reply === "" ? null : answer.reply };
  // The de-facto convention for chain-of-thought on OpenAI-compatible endpoints.
  if (answer.thinking) message.reasoning_content = answer.thinking;
  if (hasTool) {
    const tool = parseToolCall(ctx.cfg.toolCall as string);
    message.tool_calls = [
      { id: `call_${randomId(ctx.rand, 12)}`, type: "function", function: { name: tool.name, arguments: tool.arguments } },
    ];
  }
  return json({
    id,
    object: "chat.completion",
    created: Math.floor(ctx.cfg.now() / 1000),
    model: canon.model,
    system_fingerprint: "fp_parrot",
    choices: [{ index: 0, message, logprobs: null, finish_reason: hasTool ? "tool_calls" : "stop" }],
    usage: usageFor(canon, answer.reply),
  });
}

function streamChat(canon: CanonRequest, ctx: Ctx): Response {
  const frames = async function* (): AsyncGenerator<string> {
    const id = `chatcmpl-${randomId(ctx.rand, 24)}`;
    const base = {
      id,
      object: "chat.completion.chunk",
      created: Math.floor(ctx.cfg.now() / 1000),
      model: canon.model,
      system_fingerprint: "fp_parrot",
    };
    yield sse({ ...base, choices: [{ index: 0, delta: { role: "assistant", content: "" }, logprobs: null, finish_reason: null }] });

    const answer = plan(canon, ctx.cfg, ctx.rand);
    let text = "";
    try {
      for await (const phase of phasesFor(answer, ctx.cfg, ctx.rand)) {
        if (phase.channel === "thinking") {
          yield sse({ ...base, choices: [{ index: 0, delta: { reasoning_content: phase.text }, logprobs: null, finish_reason: null }] });
        } else {
          text += phase.text;
          yield sse({ ...base, choices: [{ index: 0, delta: { content: phase.text }, logprobs: null, finish_reason: null }] });
        }
      }
    } catch (error) {
      if (error instanceof FaultError) {
        yield streamErrorFrame(PROTOCOL, error.fault.status, error.message);
        return;
      }
      throw error;
    }

    const hasTool = Boolean(canon.tools && ctx.cfg.toolCall);
    if (hasTool) {
      const tool = parseToolCall(ctx.cfg.toolCall as string);
      yield sse({
        ...base,
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                { index: 0, id: `call_${randomId(ctx.rand, 12)}`, type: "function", function: { name: tool.name, arguments: tool.arguments } },
              ],
            },
            logprobs: null,
            finish_reason: null,
          },
        ],
      });
    }

    yield sse({ ...base, choices: [{ index: 0, delta: {}, logprobs: null, finish_reason: hasTool ? "tool_calls" : "stop" }] });
    if (canon.includeUsage) yield sse({ ...base, choices: [], usage: usageFor(canon, text) });
    yield SSE_DONE;
  };
  return streamResponse(frames(), SSE_HEADERS);
}

export function completions(body: unknown, ctx: Ctx): Response {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, any>;
  const prompt = typeof raw.prompt === "string" ? raw.prompt : Array.isArray(raw.prompt) ? raw.prompt.join("\n") : "";
  const canon: CanonRequest = {
    protocol: PROTOCOL,
    model: typeof raw.model === "string" && raw.model !== "" ? raw.model : ctx.cfg.models[0],
    messages: [{ role: "user", content: prompt }],
    stream: raw.stream === true,
    includeUsage: false,
    raw,
  };
  const fault = preflightFault(PROTOCOL, ctx);
  if (fault) return fault;

  if (!canon.stream) {
    const text = buildText(canon, ctx.cfg, ctx.rand);
    return json({
      id: `cmpl-${randomId(ctx.rand, 24)}`,
      object: "text_completion",
      created: Math.floor(ctx.cfg.now() / 1000),
      model: canon.model,
      choices: [{ text, index: 0, logprobs: null, finish_reason: "stop" }],
      usage: usageFor(canon, text),
    });
  }

  const frames = async function* (): AsyncGenerator<string> {
    const id = `cmpl-${randomId(ctx.rand, 24)}`;
    const base = { id, object: "text_completion", created: Math.floor(ctx.cfg.now() / 1000), model: canon.model };
    let text = "";
    try {
      for await (const piece of contentPieces(canon, ctx.cfg, ctx.rand)) {
        text += piece.text;
        yield sse({ ...base, choices: [{ text: piece.text, index: 0, logprobs: null, finish_reason: null }] });
      }
    } catch (error) {
      if (error instanceof FaultError) {
        yield streamErrorFrame(PROTOCOL, error.fault.status, error.message);
        return;
      }
      throw error;
    }
    yield sse({ ...base, choices: [{ text: "", index: 0, logprobs: null, finish_reason: "stop" }] });
    yield SSE_DONE;
  };
  return streamResponse(frames(), SSE_HEADERS);
}

function pseudoVector(text: string, dimensions: number): number[] {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < dimensions; i++) {
    hash = Math.imul(hash ^ (hash >>> 13), 0x5bd1e995);
    out.push(((hash >>> 0) / 4294967296) * 2 - 1);
  }
  return out;
}

export function embeddings(body: unknown, ctx: Ctx): Response {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, any>;
  const inputs: unknown[] = Array.isArray(raw.input) ? raw.input : [raw.input ?? ""];
  const dimensions = Number.isFinite(Number(raw.dimensions)) && Number(raw.dimensions) > 0 ? Number(raw.dimensions) : 8;
  const data = inputs.map((input: unknown, index: number) => ({
    object: "embedding",
    index,
    embedding: pseudoVector(String(input), dimensions),
  }));
  const tokens = inputs.reduce((sum: number, input: unknown) => sum + estimateTokens(String(input)), 0);
  return json({
    object: "list",
    data,
    model: typeof raw.model === "string" && raw.model !== "" ? raw.model : "parrot-embedding-1",
    usage: { prompt_tokens: tokens, total_tokens: tokens },
  });
}

export function estimateRequest(canon: CanonRequest): number {
  return promptTokens(canon);
}

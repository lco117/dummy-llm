import { contentPieces, estimateTokens, phasesFor, plan, promptTokens } from "../engine.ts";
import { FaultError, HttpError, errorResponse, preflightFault, streamErrorFrame } from "../errors.ts";
import { NDJSON_HEADERS, json, ndjson, streamResponse } from "../sse.ts";
import type { CanonMessage, CanonRequest, Ctx, ProtocolId } from "../types.ts";
import { normalizeContent } from "./openai-chat.ts";

export const PROTOCOL: ProtocolId = "ollama";

function normalizeMessages(messages: unknown): CanonMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.map((entry) => {
    const message = (entry ?? {}) as Record<string, unknown>;
    return { role: String(message.role ?? "user"), content: normalizeContent(message.content) };
  });
}

function timings(startedAt: number, ctx: Ctx, text: string): Record<string, unknown> {
  const total = Math.max(1, ctx.cfg.now() - startedAt) * 1_000_000;
  return {
    total_duration: total,
    load_duration: 1_000_000,
    prompt_eval_count: 0,
    prompt_eval_duration: 1_000_000,
    eval_count: estimateTokens(text),
    eval_duration: total,
  };
}

export function chat(body: unknown, ctx: Ctx): Response {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, any>;
  const canon: CanonRequest = {
    protocol: PROTOCOL,
    model: typeof raw.model === "string" && raw.model !== "" ? raw.model : ctx.cfg.models[0],
    messages: normalizeMessages(raw.messages),
    stream: raw.stream !== false,
    includeUsage: true,
    tools: raw.tools,
    raw,
  };
  const fault = preflightFault(PROTOCOL, ctx);
  if (fault) return fault;

  const startedAt = ctx.cfg.now();
  if (!canon.stream) {
    const answer = plan(canon, ctx.cfg, ctx.rand);
    const message: Record<string, unknown> = { role: "assistant", content: answer.reply };
    if (answer.thinking) message.thinking = answer.thinking;
    return json({
      model: canon.model,
      created_at: new Date(ctx.cfg.now()).toISOString(),
      message,
      done: true,
      done_reason: "stop",
      ...timings(startedAt, ctx, answer.reply),
      prompt_eval_count: promptTokens(canon),
    });
  }

  const frames = async function* (): AsyncGenerator<string> {
    const createdAt = new Date(ctx.cfg.now()).toISOString();
    const answer = plan(canon, ctx.cfg, ctx.rand);
    let text = "";
    try {
      for await (const phase of phasesFor(answer, ctx.cfg, ctx.rand)) {
        if (phase.channel === "thinking") {
          yield ndjson({ model: canon.model, created_at: createdAt, message: { role: "assistant", content: "", thinking: phase.text }, done: false });
        } else {
          text += phase.text;
          yield ndjson({ model: canon.model, created_at: createdAt, message: { role: "assistant", content: phase.text }, done: false });
        }
      }
    } catch (error) {
      if (error instanceof FaultError) {
        yield streamErrorFrame(PROTOCOL, error.fault.status, error.message);
        return;
      }
      throw error;
    }
    yield ndjson({
      model: canon.model,
      created_at: createdAt,
      message: { role: "assistant", content: "" },
      done: true,
      done_reason: "stop",
      ...timings(startedAt, ctx, text),
      prompt_eval_count: promptTokens(canon),
    });
  };
  return streamResponse(frames(), NDJSON_HEADERS);
}

export function generate(body: unknown, ctx: Ctx): Response {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, any>;
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  const canon: CanonRequest = {
    protocol: PROTOCOL,
    model: typeof raw.model === "string" && raw.model !== "" ? raw.model : ctx.cfg.models[0],
    messages: [{ role: "user", content: prompt }],
    stream: raw.stream !== false,
    includeUsage: true,
    raw,
  };
  const fault = preflightFault(PROTOCOL, ctx);
  if (fault) return fault;

  const startedAt = ctx.cfg.now();
  if (!canon.stream) {
    const answer = plan(canon, ctx.cfg, ctx.rand);
    const payload: Record<string, unknown> = {
      model: canon.model,
      created_at: new Date(ctx.cfg.now()).toISOString(),
      response: answer.reply,
      done: true,
      done_reason: "stop",
      context: [],
      ...timings(startedAt, ctx, answer.reply),
    };
    if (answer.thinking) payload.thinking = answer.thinking;
    return json(payload);
  }

  const frames = async function* (): AsyncGenerator<string> {
    const createdAt = new Date(ctx.cfg.now()).toISOString();
    const answer = plan(canon, ctx.cfg, ctx.rand);
    let text = "";
    try {
      for await (const phase of phasesFor(answer, ctx.cfg, ctx.rand)) {
        if (phase.channel === "thinking") {
          yield ndjson({ model: canon.model, created_at: createdAt, response: "", thinking: phase.text, done: false });
        } else {
          text += phase.text;
          yield ndjson({ model: canon.model, created_at: createdAt, response: phase.text, done: false });
        }
      }
    } catch (error) {
      if (error instanceof FaultError) {
        yield streamErrorFrame(PROTOCOL, error.fault.status, error.message);
        return;
      }
      throw error;
    }
    yield ndjson({ model: canon.model, created_at: createdAt, response: "", done: true, done_reason: "stop", context: [], ...timings(startedAt, ctx, text) });
  };
  return streamResponse(frames(), NDJSON_HEADERS);
}

function modelEntry(id: string, ctx: Ctx): Record<string, unknown> {
  return {
    name: id,
    model: id,
    modified_at: new Date(ctx.cfg.now()).toISOString(),
    size: 42,
    digest: "dummy0000000000000000000000000000000000000000000000000000000000",
    details: {
      parent_model: "",
      format: "dummy",
      family: "dummy",
      families: ["dummy"],
      parameter_size: "0B",
      quantization_level: "Q0_0",
    },
  };
}

export function tags(ctx: Ctx): Response {
  return json({ models: ctx.cfg.models.map((id) => modelEntry(id, ctx)) });
}

export function ps(ctx: Ctx): Response {
  return json({ models: ctx.cfg.models.slice(0, 1).map((id) => ({ ...modelEntry(id, ctx), size_vram: 0, expires_at: new Date(ctx.cfg.now() + 300000).toISOString() })) });
}

export function version(): Response {
  return json({ version: "0.0.1-dummy" });
}

export function embed(body: unknown, ctx: Ctx): Response {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, any>;
  const inputs: unknown[] = Array.isArray(raw.input) ? raw.input : [raw.input ?? ""];
  const embeddings = inputs.map((input: unknown) => {
    let hash = 2166136261;
    const value = String(input);
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Array.from({ length: 8 }, () => {
      hash = Math.imul(hash ^ (hash >>> 13), 0x5bd1e995);
      return ((hash >>> 0) / 4294967296) * 2 - 1;
    });
  });
  return json({ model: raw.model ?? ctx.cfg.models[0], embeddings, total_duration: 1000000, load_duration: 1000000, prompt_eval_count: inputs.length });
}

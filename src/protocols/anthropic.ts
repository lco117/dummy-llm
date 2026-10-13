import { buildText, contentPieces, estimateTokens, promptTokens } from "../engine.ts";
import { FaultError, HttpError, errorResponse, preflightFault, streamErrorFrame } from "../errors.ts";
import { randomId } from "../random.ts";
import { SSE_HEADERS, json, sse, streamResponse } from "../sse.ts";
import type { CanonMessage, CanonRequest, Ctx, ProtocolId } from "../types.ts";
import { normalizeContent } from "./openai-chat.ts";

export const PROTOCOL: ProtocolId = "anthropic";

function normalizeSystem(system: unknown): string {
  if (typeof system === "string") return system;
  if (Array.isArray(system)) return system.map((block) => normalizeContent(block)).join("");
  return "";
}

function normalizeMessages(messages: unknown): CanonMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.map((entry) => {
    const message = (entry ?? {}) as Record<string, unknown>;
    return { role: String(message.role ?? "user"), content: normalizeContent(message.content) };
  });
}

export function messages(body: unknown, ctx: Ctx): Response {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, any>;
  const canon: CanonRequest = {
    protocol: PROTOCOL,
    model: typeof raw.model === "string" && raw.model !== "" ? raw.model : ctx.cfg.models[0],
    messages: normalizeMessages(raw.messages),
    stream: raw.stream === true,
    includeUsage: true,
    tools: raw.tools,
    raw,
  };
  const system = normalizeSystem(raw.system);
  if (system !== "") canon.messages = [{ role: "system", content: system }, ...canon.messages];

  const fault = preflightFault(PROTOCOL, ctx);
  if (fault) return fault;
  return canon.stream ? streamMessages(canon, ctx) : syncMessages(canon, ctx);
}

function syncMessages(canon: CanonRequest, ctx: Ctx): Response {
  const text = buildText(canon, ctx.cfg, ctx.rand);
  const content: unknown[] = [];
  if (ctx.cfg.thinking) content.push({ type: "thinking", thinking: ctx.cfg.thinking, signature: `parrot-${randomId(ctx.rand, 16)}` });
  content.push({ type: "text", text });
  return json({
    id: `msg_${randomId(ctx.rand, 24)}`,
    type: "message",
    role: "assistant",
    model: canon.model,
    content,
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: promptTokens(canon), output_tokens: estimateTokens(text) },
  });
}

function streamMessages(canon: CanonRequest, ctx: Ctx): Response {
  const frames = async function* (): AsyncGenerator<string> {
    const id = `msg_${randomId(ctx.rand, 24)}`;
    const inputTokens = promptTokens(canon);
    let index = 0;

    yield sse(
      {
        type: "message_start",
        message: {
          id,
          type: "message",
          role: "assistant",
          model: canon.model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: inputTokens, output_tokens: 1 },
        },
      },
      "message_start",
    );
    yield sse({ type: "ping" }, "ping");

    if (ctx.cfg.thinking) {
      yield sse({ type: "content_block_start", index, content_block: { type: "thinking", thinking: "", signature: "" } }, "content_block_start");
      yield sse({ type: "content_block_delta", index, delta: { type: "thinking_delta", thinking: ctx.cfg.thinking } }, "content_block_delta");
      yield sse(
        { type: "content_block_delta", index, delta: { type: "signature_delta", signature: `parrot-${randomId(ctx.rand, 16)}` } },
        "content_block_delta",
      );
      yield sse({ type: "content_block_stop", index }, "content_block_stop");
      index++;
    }

    yield sse({ type: "content_block_start", index, content_block: { type: "text", text: "" } }, "content_block_start");

    let text = "";
    try {
      for await (const piece of contentPieces(canon, ctx.cfg, ctx.rand)) {
        text += piece.text;
        yield sse({ type: "content_block_delta", index, delta: { type: "text_delta", text: piece.text } }, "content_block_delta");
      }
    } catch (error) {
      if (error instanceof FaultError) {
        yield streamErrorFrame(PROTOCOL, error.fault.status, error.message);
        return;
      }
      throw error;
    }

    yield sse({ type: "content_block_stop", index }, "content_block_stop");
    yield sse(
      { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: estimateTokens(text) } },
      "message_delta",
    );
    yield sse({ type: "message_stop" }, "message_stop");
  };
  return streamResponse(frames(), SSE_HEADERS);
}

export function countTokens(body: unknown, ctx: Ctx): Response {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, any>;
  const canon: CanonRequest = {
    protocol: PROTOCOL,
    model: typeof raw.model === "string" && raw.model !== "" ? raw.model : ctx.cfg.models[0],
    messages: normalizeMessages(raw.messages),
    stream: false,
    includeUsage: true,
    raw,
  };
  const system = normalizeSystem(raw.system);
  if (system !== "") canon.messages = [{ role: "system", content: system }, ...canon.messages];
  return json({ input_tokens: promptTokens(canon) });
}

export function models(ctx: Ctx): Response {
  const now = new Date(ctx.cfg.now()).toISOString();
  return json({
    data: ctx.cfg.models.map((id) => ({
      id,
      type: "model",
      display_name: id,
      created_at: now,
    })),
    has_more: false,
    first_id: ctx.cfg.models[0] ?? null,
    last_id: ctx.cfg.models[ctx.cfg.models.length - 1] ?? null,
  });
}

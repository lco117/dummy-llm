import { estimateTokens, phasesFor, plan, promptTokens } from "../engine.ts";
import { FaultError, HttpError, errorResponse, preflightFault, streamErrorFrame } from "../errors.ts";
import { randomId } from "../random.ts";
import { SSE_HEADERS, json, sse, streamResponse } from "../sse.ts";
import type { Answer } from "../engine.ts";
import type { CanonMessage, CanonRequest, Ctx, ProtocolId } from "../types.ts";
import { normalizeContent } from "./openai-chat.ts";

export const PROTOCOL: ProtocolId = "openai-responses";

function normalizeInput(input: unknown): CanonMessage[] {
  if (typeof input === "string") return [{ role: "user", content: input }];
  if (Array.isArray(input)) {
    return input.map((entry) => {
      if (typeof entry === "string") return { role: "user", content: entry };
      const item = (entry ?? {}) as Record<string, unknown>;
      return { role: String(item.role ?? "user"), content: normalizeContent(item.content) };
    });
  }
  return [];
}

export function responses(body: unknown, ctx: Ctx): Response {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, any>;
  const canon: CanonRequest = {
    protocol: PROTOCOL,
    model: typeof raw.model === "string" && raw.model !== "" ? raw.model : ctx.cfg.models[0],
    messages: normalizeInput(raw.input ?? raw.messages),
    stream: raw.stream === true,
    includeUsage: true,
    tools: raw.tools,
    raw,
  };
  const fault = preflightFault(PROTOCOL, ctx);
  if (fault) return fault;
  return canon.stream ? streamed(canon, ctx) : complete(canon, ctx);
}

function outputMessage(id: string, text: string, status: string): Record<string, unknown> {
  return {
    id,
    type: "message",
    status,
    role: "assistant",
    content: [{ type: "output_text", text, annotations: [] }],
  };
}

function reasoningItem(id: string, text: string): Record<string, unknown> {
  return { id, type: "reasoning", summary: [{ type: "summary_text", text }] };
}

function shell(canon: CanonRequest, ctx: Ctx, id: string, status: string, output: unknown[]): Record<string, unknown> {
  return {
    id,
    object: "response",
    created_at: Math.floor(ctx.cfg.now() / 1000),
    status,
    background: false,
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    model: canon.model,
    output,
    parallel_tool_calls: true,
    previous_response_id: null,
    reasoning: { effort: null, summary: null },
    store: false,
    temperature: 1,
    text: { format: { type: "text" } },
    tool_choice: "auto",
    tools: [],
    top_p: 1,
    truncation: "disabled",
    usage: null,
    user: null,
    metadata: {},
  };
}

function usageOf(canon: CanonRequest, text: string): Record<string, unknown> {
  const input = promptTokens(canon);
  const output = estimateTokens(text);
  return {
    input_tokens: input,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens: output,
    output_tokens_details: { reasoning_tokens: 0 },
    total_tokens: input + output,
  };
}

function complete(canon: CanonRequest, ctx: Ctx): Response {
  const id = `resp_${randomId(ctx.rand, 24)}`;
  const reasoningId = `rs_${randomId(ctx.rand, 24)}`;
  const messageId = `msg_${randomId(ctx.rand, 24)}`;
  const answer = plan(canon, ctx.cfg, ctx.rand);
  const output: unknown[] = [];
  if (answer.thinking) output.push(reasoningItem(reasoningId, answer.thinking));
  output.push(outputMessage(messageId, answer.reply, "completed"));
  return json({ ...shell(canon, ctx, id, "completed", output), usage: usageOf(canon, answer.reply) });
}

function streamed(canon: CanonRequest, ctx: Ctx): Response {
  const frames = async function* (): AsyncGenerator<string> {
    const id = `resp_${randomId(ctx.rand, 24)}`;
    const reasoningId = `rs_${randomId(ctx.rand, 24)}`;
    const messageId = `msg_${randomId(ctx.rand, 24)}`;
    const answer: Answer = plan(canon, ctx.cfg, ctx.rand);
    const hasThinking = Boolean(answer.thinking);
    const messageIndex = hasThinking ? 1 : 0;
    let sequence = 0;
    const next = () => sequence++;

    yield sse({ type: "response.created", sequence_number: next(), response: shell(canon, ctx, id, "in_progress", []) }, "response.created");
    yield sse({ type: "response.in_progress", sequence_number: next(), response: shell(canon, ctx, id, "in_progress", []) }, "response.in_progress");

    if (hasThinking) {
      yield sse(
        { type: "response.output_item.added", sequence_number: next(), output_index: 0, item: { id: reasoningId, type: "reasoning", summary: [] } },
        "response.output_item.added",
      );
      yield sse(
        {
          type: "response.reasoning_summary_part.added",
          sequence_number: next(),
          item_id: reasoningId,
          output_index: 0,
          summary_index: 0,
          part: { type: "summary_text", text: "" },
        },
        "response.reasoning_summary_part.added",
      );
    }

    yield sse(
      {
        type: "response.output_item.added",
        sequence_number: next(),
        output_index: messageIndex,
        item: { id: messageId, type: "message", status: "in_progress", role: "assistant", content: [] },
      },
      "response.output_item.added",
    );
    yield sse(
      {
        type: "response.content_part.added",
        sequence_number: next(),
        item_id: messageId,
        output_index: messageIndex,
        content_index: 0,
        part: { type: "output_text", text: "", annotations: [] },
      },
      "response.content_part.added",
    );

    let text = "";
    try {
      for await (const phase of phasesFor(answer, ctx.cfg, ctx.rand)) {
        if (phase.channel === "thinking") {
          yield sse(
            {
              type: "response.reasoning_summary_text.delta",
              sequence_number: next(),
              item_id: reasoningId,
              output_index: 0,
              summary_index: 0,
              delta: phase.text,
            },
            "response.reasoning_summary_text.delta",
          );
        } else {
          text += phase.text;
          yield sse(
            {
              type: "response.output_text.delta",
              sequence_number: next(),
              item_id: messageId,
              output_index: messageIndex,
              content_index: 0,
              delta: phase.text,
              logprobs: [],
            },
            "response.output_text.delta",
          );
        }
      }
    } catch (error) {
      if (error instanceof FaultError) {
        yield streamErrorFrame(PROTOCOL, error.fault.status, error.message);
        return;
      }
      throw error;
    }

    if (hasThinking) {
      yield sse(
        { type: "response.reasoning_summary_text.done", sequence_number: next(), item_id: reasoningId, output_index: 0, summary_index: 0, text: answer.thinking },
        "response.reasoning_summary_text.done",
      );
      yield sse(
        {
          type: "response.reasoning_summary_part.done",
          sequence_number: next(),
          item_id: reasoningId,
          output_index: 0,
          summary_index: 0,
          part: { type: "summary_text", text: answer.thinking },
        },
        "response.reasoning_summary_part.done",
      );
      yield sse(
        { type: "response.output_item.done", sequence_number: next(), output_index: 0, item: reasoningItem(reasoningId, answer.thinking as string) },
        "response.output_item.done",
      );
    }

    yield sse(
      { type: "response.output_text.done", sequence_number: next(), item_id: messageId, output_index: messageIndex, content_index: 0, text, logprobs: [] },
      "response.output_text.done",
    );
    yield sse(
      {
        type: "response.content_part.done",
        sequence_number: next(),
        item_id: messageId,
        output_index: messageIndex,
        content_index: 0,
        part: { type: "output_text", text, annotations: [] },
      },
      "response.content_part.done",
    );
    yield sse(
      { type: "response.output_item.done", sequence_number: next(), output_index: messageIndex, item: outputMessage(messageId, text, "completed") },
      "response.output_item.done",
    );

    const output: unknown[] = [];
    if (hasThinking) output.push(reasoningItem(reasoningId, answer.thinking as string));
    output.push(outputMessage(messageId, text, "completed"));
    yield sse(
      { type: "response.completed", sequence_number: next(), response: { ...shell(canon, ctx, id, "completed", output), usage: usageOf(canon, text) } },
      "response.completed",
    );
  };
  return streamResponse(frames(), SSE_HEADERS);
}

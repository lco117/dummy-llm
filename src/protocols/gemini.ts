import { estimateTokens, phasesFor, plan, promptTokens } from "../engine.ts";
import { FaultError, HttpError, errorResponse, preflightFault, streamErrorFrame } from "../errors.ts";
import { NDJSON_HEADERS, SSE_HEADERS, json, sse, streamResponse } from "../sse.ts";
import type { Answer } from "../engine.ts";
import type { CanonMessage, CanonRequest, Ctx, ProtocolId } from "../types.ts";

export const PROTOCOL: ProtocolId = "gemini";

function partsToText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? String((part as { text: string }).text) : ""))
    .join("");
}

function normalizeContents(contents: unknown): CanonMessage[] {
  if (!Array.isArray(contents)) return [];
  return contents.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    return { role: item.role === "model" ? "assistant" : String(item.role ?? "user"), content: partsToText(item.parts) };
  });
}

function canonical(body: unknown, model: string, ctx: Ctx): CanonRequest {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, any>;
  const messages = normalizeContents(raw.contents);
  const system = partsToText(raw.systemInstruction?.parts);
  if (system !== "") messages.unshift({ role: "system", content: system });
  return {
    protocol: PROTOCOL,
    model: model !== "" ? model : ctx.cfg.models[0],
    messages,
    stream: false,
    includeUsage: true,
    tools: raw.tools,
    raw,
  };
}

/** Gemini marks a thinking part with thought: true. */
function answerParts(answer: Answer): unknown[] {
  const parts: unknown[] = [];
  if (answer.thinking) parts.push({ text: answer.thinking, thought: true });
  parts.push({ text: answer.reply });
  return parts;
}

function finishBody(canon: CanonRequest, answer: Answer): Record<string, unknown> {
  const input = promptTokens(canon);
  const output = estimateTokens(answer.reply);
  return {
    candidates: [{ content: { parts: answerParts(answer), role: "model" }, finishReason: "STOP", index: 0, safetyRatings: [] }],
    usageMetadata: { promptTokenCount: input, candidatesTokenCount: output, totalTokenCount: input + output },
    modelVersion: canon.model,
  };
}

export function generate(verb: string, model: string, body: unknown, ctx: Ctx): Response {
  const canon = canonical(body, model, ctx);
  const fault = preflightFault(PROTOCOL, ctx);
  if (fault) return fault;

  if (verb === "countTokens") {
    return json({ totalTokens: promptTokens(canon), cachedContentTokenCount: 0 });
  }

  if (verb === "streamGenerateContent") {
    canon.stream = true;
    return streamGenerate(canon, ctx);
  }

  return json(finishBody(canon, plan(canon, ctx.cfg, ctx.rand)));
}

function streamGenerate(canon: CanonRequest, ctx: Ctx): Response {
  const altSse = ctx.url.searchParams.get("alt") === "sse";
  const frames = async function* (): AsyncGenerator<string> {
    const emit = (payload: unknown) => (altSse ? sse(payload) : JSON.stringify(payload) + "\n");
    const answer = plan(canon, ctx.cfg, ctx.rand);
    let text = "";
    try {
      for await (const phase of phasesFor(answer, ctx.cfg, ctx.rand)) {
        if (phase.channel === "thinking") {
          yield emit({ candidates: [{ content: { parts: [{ text: phase.text, thought: true }], role: "model" }, index: 0, safetyRatings: [] }], modelVersion: canon.model });
        } else {
          text += phase.text;
          yield emit({ candidates: [{ content: { parts: [{ text: phase.text }], role: "model" }, index: 0, safetyRatings: [] }], modelVersion: canon.model });
        }
      }
    } catch (error) {
      if (error instanceof FaultError) {
        yield streamErrorFrame(PROTOCOL, error.fault.status, error.message);
        return;
      }
      throw error;
    }
    yield emit(finishBody(canon, { reply: text, thinking: answer.thinking }));
  };
  return streamResponse(frames(), altSse ? SSE_HEADERS : NDJSON_HEADERS);
}

export function models(ctx: Ctx): Response {
  return json({
    models: ctx.cfg.models.map((id) => ({
      name: `models/${id}`,
      baseModelId: id,
      version: "001",
      displayName: id,
      description: "An NPC. It says whatever you said.",
      inputTokenLimit: 128000,
      outputTokenLimit: 8192,
      supportedGenerationMethods: ["generateContent", "streamGenerateContent", "countTokens"],
    })),
  });
}

import { describeReply, stripReminders } from "./engine.ts";
import { errorResponse, HttpError } from "./errors.ts";
import { landingPage } from "./landing.ts";
import { LOGO_SVG } from "./logo.ts";
import { mulberry32 } from "./random.ts";
import { json } from "./sse.ts";
import * as anthropic from "./protocols/anthropic.ts";
import * as gemini from "./protocols/gemini.ts";
import * as ollama from "./protocols/ollama.ts";
import * as openaiChat from "./protocols/openai-chat.ts";
import * as openaiResponses from "./protocols/openai-responses.ts";
import type { Config, Ctx, ProtocolId } from "./types.ts";
import { version } from "./version.ts";

export type App = (request: Request) => Promise<Response>;

let requestCounter = 0;

/** Which error envelope should an unknown path use? */
export function protocolFor(pathname: string): ProtocolId {
  if (pathname.startsWith("/v1/messages")) return "anthropic";
  if (pathname.startsWith("/api/")) return "ollama";
  if (pathname.startsWith("/v1beta/")) return "gemini";
  if (pathname.startsWith("/v1/responses")) return "openai-responses";
  return "openai-chat";
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function isAnthropicRequest(request: Request): boolean {
  return request.headers.has("anthropic-version") || (request.headers.has("x-api-key") && !request.headers.has("authorization"));
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max) + "…";
}

/** Best-effort message extraction across all four request shapes. */
function collectMessages(body: Record<string, any>): Array<{ role: string; content: string }> {
  const source = body.messages ?? body.input ?? body.contents;
  const flat = (content: unknown): string => {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((part: any) => (typeof part === "string" ? part : part?.text ?? part?.content ?? ""))
        .join("");
    }
    return content === null || content === undefined ? "" : JSON.stringify(content);
  };
  if (typeof source === "string") return [{ role: "user", content: source }];
  if (Array.isArray(source)) {
    return source.map((entry: any) => {
      if (typeof entry === "string") return { role: "user", content: entry };
      return { role: String(entry?.role ?? "user"), content: flat(entry?.content ?? entry?.parts ?? "") };
    });
  }
  if (typeof body.prompt === "string") return [{ role: "user", content: body.prompt }];
  return [];
}

/**
 * DUMMY_LOG=summary prints one line per request — what the server actually received.
 * On Cloudflare that shows up in Workers Logs and in `npx wrangler tail dummy-llm`.
 */
function logRequest(ctx: Ctx, method: string, body: Record<string, any>): void {
  if (ctx.cfg.log === "off") return;
  const messages = collectMessages(body);
  const users = messages.filter((message) => message.role === "user");
  const lastUser = users.length > 0 ? stripReminders(users[users.length - 1].content, ctx.cfg.strip) : "";
  const line: Record<string, unknown> = {
    dummy: "request",
    method,
    path: ctx.url.pathname,
    model: body.model ?? null,
    stream: body.stream === true,
    messages: messages.length,
    lastUser: truncate(lastUser, 500),
  };
  if (ctx.cfg.log === "full") line.body = body;
  console.log(JSON.stringify(line));
}

async function readJson(request: Request, ctx: Ctx): Promise<Record<string, any>> {
  // Best-effort guard: check the declared size before buffering, and the real size after.
  const limit = ctx.cfg.maxBodyBytes;
  if (limit > 0) {
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > limit) {
      throw new HttpError(413, `Request body too large: the limit is ${limit} bytes (DUMMY_MAX_BODY).`);
    }
  }
  const text = await request.text();
  if (limit > 0 && text.length > limit) {
    throw new HttpError(413, `Request body too large: the limit is ${limit} bytes (DUMMY_MAX_BODY).`);
  }
  if (text.trim() === "") return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    const body = parsed !== null && typeof parsed === "object" ? (parsed as Record<string, any>) : { value: parsed };
    logRequest(ctx, request.method, body);
    return body;
  } catch {
    throw new HttpError(400, "We could not parse the JSON body of your request. (Please check the body is valid JSON.)");
  }
}

function checkAuth(request: Request, ctx: Ctx): Response | null {
  const expected = ctx.cfg.apiKey;
  if (!expected) return null;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const candidates = [
    bearer,
    request.headers.get("x-api-key"),
    request.headers.get("x-goog-api-key"),
    request.headers.get("api-key"),
    ctx.url.searchParams.get("key"),
  ];
  if (candidates.some((candidate) => candidate === expected)) return null;
  return errorResponse(
    protocolFor(ctx.url.pathname),
    401,
    "Incorrect API key provided. This dummy accepts any key when DUMMY_API_KEY is unset; it is currently set.",
  );
}

async function route(request: Request, ctx: Ctx): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = normalizePath(ctx.url.pathname);

  if (method === "OPTIONS") return new Response(null, { status: 204 });
  if (method === "GET" && (path === "/" || path === "/index.html")) return landingPage(ctx);
  if (method === "GET" && path === "/logo.svg") {
    return new Response(LOGO_SVG, {
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=86400" },
    });
  }
  if (method === "GET" && path === "/healthz") {
    return json({
      ok: true,
      status: "ok",
      reply: describeReply(ctx.cfg.reply),
      thinking: ctx.cfg.thinking.length,
      tps: ctx.cfg.tps,
      delayMs: ctx.cfg.delayMs,
      log: ctx.cfg.log,
      uptime: 0,
      version,
    });
  }

  const unauthorized = checkAuth(request, ctx);
  if (unauthorized) return unauthorized;

  if (method === "GET" && path === "/v1/models") return isAnthropicRequest(request) ? anthropic.models(ctx) : openaiChat.models(ctx);
  if (method === "GET" && path.startsWith("/v1/models/")) {
    const id = openaiChat.modelIdFromPath(path);
    return isAnthropicRequest(request) ? anthropic.models(ctx) : openaiChat.model(id, ctx);
  }

  if (method === "POST" && path === "/v1/chat/completions") return openaiChat.chat(await readJson(request, ctx), ctx);
  if (method === "POST" && path === "/v1/completions") return openaiChat.completions(await readJson(request, ctx), ctx);
  if (method === "POST" && path === "/v1/embeddings") return openaiChat.embeddings(await readJson(request, ctx), ctx);
  if (method === "POST" && path === "/v1/responses") return openaiResponses.responses(await readJson(request, ctx), ctx);
  if (method === "POST" && path === "/v1/messages") return anthropic.messages(await readJson(request, ctx), ctx);
  if (method === "POST" && path === "/v1/messages/count_tokens") return anthropic.countTokens(await readJson(request, ctx), ctx);

  if (method === "GET" && path === "/v1beta/models") return gemini.models(ctx);
  const geminiRoute = path.match(/^\/v1beta\/models\/(.+?):(generateContent|streamGenerateContent|countTokens)$/);
  if (geminiRoute && method === "POST") {
    return gemini.generate(geminiRoute[2], decodeURIComponent(geminiRoute[1]), await readJson(request, ctx), ctx);
  }

  if (method === "GET" && path === "/api/version") return ollama.version();
  if (method === "GET" && path === "/api/tags") return ollama.tags(ctx);
  if (method === "GET" && path === "/api/ps") return ollama.ps(ctx);
  if (method === "POST" && path === "/api/chat") return ollama.chat(await readJson(request, ctx), ctx);
  if (method === "POST" && path === "/api/generate") return ollama.generate(await readJson(request, ctx), ctx);
  if (method === "POST" && path === "/api/embed") return ollama.embed(await readJson(request, ctx), ctx);

  return errorResponse(
    protocolFor(path),
    404,
    `Unknown endpoint ${method} ${path}. Try GET / for the joke, or POST /v1/chat/completions for the API.`,
  );
}

function withCors(response: Response, request: Request, config: Config): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", config.cors);
  headers.set("access-control-allow-headers", request.headers.get("access-control-request-headers") ?? "*");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-expose-headers", "*");
  if (config.cors !== "*") headers.append("vary", "Origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/**
 * The whole server. It is a plain Web Fetch handler, which is why the same object
 * runs on Node, Cloudflare Workers, Vercel Edge and Deno Deploy.
 */
export function createApp(config: Config): App {
  return async function app(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // Locked seed (tests, DUMMY_SEED) keeps runs reproducible; otherwise every
    // request gets its own stream of randomness so the thinking template varies.
    const seed = config.deterministic ? config.seed : (Date.now() ^ (requestCounter++ * 0x9e3779b9)) >>> 0;
    const ctx: Ctx = { cfg: config, url, rand: mulberry32(seed) };
    const protocol = protocolFor(url.pathname);
    let response: Response;
    try {
      response = await route(request, ctx);
    } catch (error) {
      if (error instanceof HttpError) {
        response = errorResponse(protocol, error.status, error.message);
      } else {
        response = errorResponse(protocol, 500, error instanceof Error ? error.message : String(error));
      }
    }
    return withCors(response, request, config);
  };
}

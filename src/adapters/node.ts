import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { readFileSync } from "node:fs";
import { processEnv, resolveConfig } from "../config.ts";
import type { Env } from "../config.ts";
import { createApp, version } from "../index.ts";
import { describeReply } from "../engine.ts";
import { BUILTIN_PERSONAS } from "../personas.ts";

const HELP = `
dummy-llm ${version} - an LLM that always says the same thing.

Usage:
  dummy-llm [options]

Options:
  -p, --port <n>          Port to listen on                 (default 8080)
      --host <address>    Address to bind                   (default 0.0.0.0)
      --reply <value>     What it answers with. The shape IS the behaviour:
                            "{input}"                one template (default; this is "echo")
                            "6"                      always the same thing
                            '["6","7","maybe"]'      drawn at random
                            '{"weather":"raining"}'  keyword -> template, "*" is the fallback
      --reply-file <path> Read that value from a file (Node only) — best for long templates
      --persona <id>      Start from a built-in persona's reply
      --chunk <n|word|line|whole>                          (default 4, ~one token)
      --tps <n>           Streamed pieces per second      (default 100)
      --delay <ms>        Delay between pieces, overrides --tps
      --ttft <ms>         Time to first token               (default 0)
      --seed <n>          Seed for ids and jitter           (default 1)
      --api-key <key>     Require this key on API routes
      --cors <origin>     Access-Control-Allow-Origin       (default *)
      --models <a,b>      Model ids to advertise
      --fail <spec>       429 | 429:after=3 | rate_limit | off
      --hang <ms>         Delay before the first byte
      --tools <name>      Answer with a tool call when tools are offered
      --thinking <text>   Thinking template ({input} {reply}); default repeats your joke back
      --no-thinking       Do not emit a thinking block at all
      --playground        Let callers pass ?t=<template> to answer one request with it
      --echo-raw          Echo the message verbatim, without stripping harness noise
      --strip <regex|regex>  Extra patterns to strip from user messages, |-separated
      --log <level>       off | summary | full — log what was received (default off)
      --max-body <bytes>  Reject larger request bodies      (default 1000000, 0 = unlimited)
  -h, --help              Show this help
  -v, --version           Show the version

Examples:
  dummy-llm --text "6" --port 8080
  dummy-llm --mode echo --delay 0
  curl -N http://localhost:8080/v1/chat/completions \
    -H 'content-type: application/json' \
    -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}],"stream":true}'
`;

interface Flags {
  [key: string]: string | true | undefined;
}

function parseArgs(argv: string[]): Flags {
  const flags: Flags = {};
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("-")) continue;
    const name = arg.replace(/^--?/, "");
    const eq = name.indexOf("=");
    if (eq !== -1) {
      flags[name.slice(0, eq)] = name.slice(eq + 1);
      continue;
    }
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith("-")) {
      flags[name] = next;
      i++;
    } else {
      flags[name] = true;
    }
  }
  return flags;
}

const flags = parseArgs(process.argv);
if (flags.help || flags.h) {
  console.log(HELP);
  process.exit(0);
}
if (flags.version || flags.v) {
  console.log(version);
  process.exit(0);
}

const env: Env = { ...processEnv() };
const aliases: Record<string, string> = { p: "port", t: "text" };
function take(...names: string[]): string | undefined {
  for (const name of names) {
    const value = flags[name];
    if (typeof value === "string") return value;
  }
  return undefined;
}
function apply(target: string, ...names: string[]): void {
  const resolved = names.map((name) => aliases[name] ?? name);
  const value = take(...resolved);
  if (value !== undefined) env[target] = value;
}

apply("PORT", "port", "p");
apply("HOST", "host");
apply("DUMMY_REPLY", "reply", "text", "t");
// the pre-0.4 quartet still works for one release; config.ts maps it onto the reply
apply("DUMMY_MODE", "mode");
apply("DUMMY_LINES", "lines");
apply("DUMMY_CANNED", "canned");
apply("DUMMY_CHUNK", "chunk");
apply("DUMMY_TPS", "tps");
apply("DUMMY_DELAY_MS", "delay");
apply("DUMMY_LOG", "log");
apply("DUMMY_MAX_BODY", "max-body");
apply("DUMMY_PLAYGROUND", "playground");
apply("DUMMY_MAX_REPLY", "max-reply");
apply("DUMMY_STRIP", "strip");
apply("DUMMY_TTFT_MS", "ttft");
apply("DUMMY_SEED", "seed");
apply("DUMMY_API_KEY", "api-key");
apply("DUMMY_CORS", "cors");
apply("DUMMY_MODELS", "models");
apply("DUMMY_FAIL", "fail");
apply("DUMMY_HANG_MS", "hang");
apply("DUMMY_TOOLCALL", "tools");
apply("DUMMY_THINKING", "thinking");
if (flags["no-thinking"] === true) env.DUMMY_THINKING = "off";
if (flags["echo-raw"] === true) env.DUMMY_ECHO_RAW = "1";
if (flags.playground === true) env.DUMMY_PLAYGROUND = "1";

const replyFile = take("reply-file");
if (replyFile !== undefined) env.DUMMY_REPLY = readFileSync(replyFile, "utf8");
const personaStart = take("persona");
if (personaStart !== undefined) {
  const persona = BUILTIN_PERSONAS[personaStart];
  if (!persona) {
    console.error("unknown persona: " + personaStart + " (known: " + Object.keys(BUILTIN_PERSONAS).join(", ") + ")");
    process.exit(1);
  }
  env.DUMMY_REPLY = JSON.stringify(persona.reply ?? "{input}");
}

const config = resolveConfig(env);
const app = createApp(config);
const port = Number.parseInt(env.PORT ?? "8080", 10);
const host = env.HOST ?? "0.0.0.0";

function headersFrom(raw: IncomingMessage["headers"]): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || key.startsWith(":")) continue;
    if (Array.isArray(value)) for (const item of value) headers.append(key, item);
    else headers.set(key, value);
  }
  return headers;
}

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

const server = createServer(async (request, response) => {
  try {
    response.socket?.setNoDelay(true);
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
    const method = (request.method ?? "GET").toUpperCase();
    const body = method === "GET" || method === "HEAD" ? undefined : await readBody(request);
    const webRequest = new Request(url, {
      method,
      headers: headersFrom(request.headers),
      body: body && body.length > 0 ? new Uint8Array(body) : undefined,
    });
    const webResponse = await app(webRequest);
    response.statusCode = webResponse.status;
    response.statusMessage = webResponse.statusText;
    webResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === "connection" || key.toLowerCase() === "transfer-encoding") return;
      response.setHeader(key, value);
    });
    if (!webResponse.body) {
      response.end();
      return;
    }
    Readable.fromWeb(webResponse.body as Parameters<typeof Readable.fromWeb>[0]).pipe(response);
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: { message: error instanceof Error ? error.message : String(error), type: "api_error" } }));
  }
});

server.listen(port, host, () => {
  console.log(`\u{1F99C}  dummy-llm ${version}`);
  console.log(`    listening on http://localhost:${port}`);
  console.log(`    it will answer with: ${JSON.stringify(describeReply(config.reply))} (${config.chunk} chunk(s), ${config.delayMs}ms apart, ${config.tps} tps)`);
  console.log(`    point any SDK at http://localhost:${port} and use any API key`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  });
}

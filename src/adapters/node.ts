import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { processEnv, resolveConfig } from "../config.ts";
import type { Env } from "../config.ts";
import { createApp, version } from "../index.ts";

const HELP = `
parrot-llm ${version} - an LLM that always says the same thing.

Usage:
  parrot-llm [options]

Options:
  -p, --port <n>          Port to listen on                 (default 8080)
      --host <address>    Address to bind                   (default 0.0.0.0)
  -t, --text <string>     The one thing it always says      (default "6")
      --mode <mode>       fixed | echo | random | canned    (default fixed)
      --lines <a|b|c>     Replies for random mode
      --chunk <n|word|line|whole>                          (default 1)
      --delay <ms>        Delay between streamed chunks     (default 20)
      --ttft <ms>         Time to first token               (default 0)
      --seed <n>          Seed for ids and jitter           (default 1)
      --api-key <key>     Require this key on API routes
      --cors <origin>     Access-Control-Allow-Origin       (default *)
      --models <a,b>      Model ids to advertise
      --fail <spec>       429 | 429:after=3 | rate_limit | off
      --hang <ms>         Delay before the first byte
      --tools <name>      Answer with a tool call when tools are offered
      --thinking <text>   Emit an Anthropic thinking block first
  -h, --help              Show this help
  -v, --version           Show the version

Examples:
  parrot-llm --text "6" --port 8080
  parrot-llm --mode echo --delay 0
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
apply("PARROT_TEXT", "text", "t");
apply("PARROT_MODE", "mode");
apply("PARROT_LINES", "lines");
apply("PARROT_CHUNK", "chunk");
apply("PARROT_DELAY_MS", "delay");
apply("PARROT_TTFT_MS", "ttft");
apply("PARROT_SEED", "seed");
apply("PARROT_API_KEY", "api-key");
apply("PARROT_CORS", "cors");
apply("PARROT_MODELS", "models");
apply("PARROT_FAIL", "fail");
apply("PARROT_HANG_MS", "hang");
apply("PARROT_TOOLCALL", "tools");
apply("PARROT_THINKING", "thinking");

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
  console.log(`\u{1F99C}  parrot-llm ${version}`);
  console.log(`    listening on http://localhost:${port}`);
  console.log(`    it will always say: ${JSON.stringify(config.text)} (mode: ${config.mode}, ${config.chunk} chunk(s), ${config.delayMs}ms apart)`);
  console.log(`    point any SDK at http://localhost:${port} and use any API key`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  });
}

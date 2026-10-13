<div align="center">

# 🦜 parrot-llm

**An LLM that always says the same thing — and speaks fluent OpenAI, Anthropic, Gemini and Ollama.**

Zero runtime dependencies. Byte-exact streaming. Runs on a VPS, a Raspberry Pi, Cloudflare Workers or Vercel.

[![CI](https://github.com/lco117/parrot-llm/actions/workflows/ci.yml/badge.svg)](https://github.com/lco117/parrot-llm/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/parrot-llm.svg)](https://www.npmjs.com/package/parrot-llm)
[![License: MIT](https://img.shields.io/badge/license-MIT-6ee787.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020.svg)](https://workers.cloudflare.com/)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lco117/parrot-llm)

*Click the button, authorize Cloudflare, and you get your own LLM endpoint in about a minute — free plan, no cold start, no build step.*

</div>

---

## What is this?

Ask it anything. It answers `6`. Every time. Forever.

But here is the part that makes it more than a joke: it answers **in the exact wire format** a real provider uses. Same SSE frames, same `data: [DONE]` sentinel, same Anthropic event order, same Ollama NDJSON. An unmodified official SDK cannot tell the difference until it reads the words.

That makes parrot-llm two things at once:

| You want to… | parrot-llm gives you |
| --- | --- |
| Watch a frontier model get replaced by a parrot | Point any chat client at it, change one line of config |
| Test an LLM app in CI | A deterministic, offline, instant, free LLM double |
| Reproduce a provider bug | Byte-exact fixtures you can diff |
| Test retry and backoff logic | Correctly shaped 429s, 500s and **mid-stream** failures |

## Quickstart

```bash
# Option A — Docker, built straight from the repository (no clone needed)
docker build -t parrot-llm https://github.com/lco117/parrot-llm.git
docker run --rm -p 8080:8080 -e PARROT_TEXT=6 parrot-llm

# Option B — from source
git clone https://github.com/lco117/parrot-llm && cd parrot-llm
npm install
npm run dev              # Node 22.18+ runs the TypeScript directly
# or: npm run build && node dist/cli.js --port 8080

# Option C — npm, once the package is published (the name parrot-llm is free)
npx parrot-llm --port 8080 --text "6"
```

Now point any SDK at it and change nothing else:

```bash
# OpenAI SDK
export OPENAI_BASE_URL=http://localhost:8080/v1
export OPENAI_API_KEY=sk-parrot

# Anthropic SDK
export ANTHROPIC_BASE_URL=http://localhost:8080
export ANTHROPIC_API_KEY=sk-parrot

# Ollama clients
export OLLAMA_HOST=http://localhost:8080
```

```bash
curl -N http://localhost:8080/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"are you a real LLM?"}],"stream":true}'
```

```
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"6"},"finish_reason":null}]}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

## Endpoints

| Protocol | Method | Path |
| --- | --- | --- |
| OpenAI Chat Completions | POST | `/v1/chat/completions` |
| OpenAI legacy Completions | POST | `/v1/completions` |
| OpenAI Responses | POST | `/v1/responses` |
| OpenAI Embeddings | POST | `/v1/embeddings` |
| OpenAI Models | GET | `/v1/models`, `/v1/models/{id}` |
| Anthropic Messages | POST | `/v1/messages` |
| Anthropic token count | POST | `/v1/messages/count_tokens` |
| Anthropic Models | GET | `/v1/models` (send `anthropic-version`) |
| Gemini | POST | `/v1beta/models/{model}:generateContent` |
| Gemini streaming | POST | `/v1beta/models/{model}:streamGenerateContent?alt=sse` |
| Ollama chat | POST | `/api/chat` |
| Ollama generate | POST | `/api/generate` |
| Ollama tags / version / ps | GET | `/api/tags`, `/api/version`, `/api/ps` |
| Ollama embeddings | POST | `/api/embed` |
| Health | GET | `/healthz` |
| The joke itself | GET | `/` |

Unknown routes return a 404 **in the error shape of the protocol you were speaking**, so your error handling gets exercised too.

## Configuration

| Env | Default | Meaning |
| --- | --- | --- |
| `PARROT_TEXT` | `6` | The one thing it ever says |
| `PARROT_MODE` | `fixed` | `fixed` · `echo` (repeat the user) · `random` · `canned` |
| `PARROT_LINES` | — | `a\|b\|c` replies for `random` mode |
| `PARROT_CANNED` | — | JSON map of keyword → reply for `canned` mode |
| `PARROT_CHUNK` | `1` | `1`, `2` … code points per frame, or `word` / `line` / `whole` |
| `PARROT_DELAY_MS` | `20` | Delay between frames (simulated typing) |
| `PARROT_TTFT_MS` | `0` | Time to first token |
| `PARROT_HANG_MS` | `0` | Delay before the first byte |
| `PARROT_SEED` | `1` | Seeds ids and jitter, so runs are reproducible |
| `PARROT_FAIL` | — | `429` · `429:after=3` · `rate_limit` · `off` |
| `PARROT_API_KEY` | — | If set, API routes require this key |
| `PARROT_CORS` | `*` | `Access-Control-Allow-Origin` |
| `PARROT_MODELS` | a plausible list | Comma separated model ids to advertise |
| `PARROT_TOOLCALL` | — | Function name, or JSON `{"name":…,"arguments":…}` |
| `PARROT_THINKING` | — | Emit an Anthropic `thinking` block first |

Every one of them is also a CLI flag: `parrot-llm --help`.

## Modes

```bash
parrot-llm --text "6"                  # fixed  - one answer, forever  (default)
parrot-llm --mode echo                 # echo   - a genuine parrot
parrot-llm --mode random --lines "6|7|maybe"
parrot-llm --mode canned --text "I do not know"
# PARROT_CANNED='{"weather":"It is raining.","name":"I am a parrot."}'
```

## Fault injection

Real providers fail; your retry logic should be tested against something that fails on purpose.

```bash
parrot-llm --fail 429                  # shaped 429 rate_limit_error before the stream
parrot-llm --fail 500:after=3          # stream 3 frames, then break mid-stream
parrot-llm --hang 30000                # open the connection and say nothing
curl "localhost:8080/v1/chat/completions?fail=overloaded"   # per-request, no restart
```

Mid-stream failure is the interesting one: the client gets a valid stream that dies halfway, which is exactly the case that makes production code hang forever.

## Deployment

| Target | Free tier | Streaming | Notes |
| --- | --- | --- | --- |
| **Cloudflare Workers** | ✅ 100k requests/day | ✅ native | one click, no cold start — [use the button](#-parrot-llm) |
| **Your VPS** | you pay the VPS | ✅ unlimited | Docker + Caddy, the "real" deployment |
| **Vercel** | ✅ Hobby (non-commercial) | ✅ | bounded by function max duration |
| **Deno Deploy** | ✅ | ✅ | five lines, `Deno.serve` |
| **Google Cloud Run** | ✅ scale-to-zero | ✅ | containers, needs billing |
| Render / HF Spaces / Netlify | ✅ | ✅ | idle-sleep caveats |

Full copy-paste configs, reverse-proxy settings and the SSE gotcha checklist live in **[docs/deployment.md](docs/deployment.md)**.

### Cloudflare Workers without the button

```bash
npx wrangler deploy
# → https://parrot-llm.<your-subdomain>.workers.dev
```

Why Workers fits so well: the whole server is a Web `Request` → `Response` handler (`src/adapters/worker.ts` is 15 lines), so wrangler bundles the TypeScript directly. And the free plan's 10 ms CPU budget is not a problem — waiting between streamed chunks is wall-clock time, not CPU.

## Using it in your tests

```ts
import { spawn } from "node:child_process";

// pretend this is your CI setup step: npx parrot-llm --delay 0 --port 8080
const server = spawn("npx", ["parrot-llm", "--delay", "0", "--port", "8080"]);

const res = await fetch("http://localhost:8080/v1/chat/completions", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }], stream: true }),
});

// deterministic: no network, no cost, no flakes, same bytes every run
expect(await res.text()).toMatchSnapshot();
```

## Development

```bash
npm install
npm run dev          # run the server from TypeScript, no build
npm test             # golden fixtures + unit tests (node:test)
npm run golden       # regenerate test/golden/*.txt after an intentional change
npm run typecheck
npm run build        # bundle the CLI with esbuild
```

### Repository layout

```
src/
  engine.ts        the "intelligence": text, chunking, latency, faults
  sse.ts           SSE / NDJSON framing and stream plumbing
  config.ts        env → Config, for Node and Workers alike
  http.ts          routing, CORS, auth, error envelopes
  protocols/       one file per wire format, pure framing
  adapters/        node.ts (CLI) · worker.ts · vercel.ts · deno.ts
test/golden/       byte-exact expected streams, one file per case
docs/              design.md · deployment.md · roadmap.md
AGENTS.md          instructions for AI coding agents
```

The one architectural rule: **the engine knows nothing about protocols, and the protocol modules know nothing about timing.** Add a provider by adding one file.

## Contributing

Bug reports, new protocols and better jokes are all welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). If you are an AI agent, read [AGENTS.md](AGENTS.md) first.

## License

[MIT](LICENSE) © lco117 · 中文说明: [README.zh-CN.md](README.zh-CN.md)

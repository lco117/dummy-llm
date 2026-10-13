<div align="center">

<img src="assets/logo.svg" alt="dummy-llm" width="132" height="132">

# dummy-llm

**A fake LLM server that repeats back whatever you send, or answers with a template of your own.**

Point any OpenAI, Anthropic, Gemini or Ollama SDK at it. Repeating you is the default; `{input}`,
`{reply}` and `{model}` in a template of your own cover the rest — and every reply streams back in
that provider's exact wire format.

Zero runtime dependencies. Byte-exact streaming. Runs on a VPS, a Raspberry Pi, Cloudflare Workers or Vercel.

[![CI](https://github.com/lco117/dummy-llm/actions/workflows/ci.yml/badge.svg)](https://github.com/lco117/dummy-llm/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dummy-llm.svg)](https://www.npmjs.com/package/dummy-llm)
[![License: MIT](https://img.shields.io/badge/license-MIT-6ee787.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020.svg)](https://workers.cloudflare.com/)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lco117/dummy-llm)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/lco117/dummy-llm&project-name=dummy-llm&repository-name=dummy-llm)
[![Run on Google Cloud](https://deploy.cloud.run/button.svg)](https://deploy.cloud.run/?git_repo=https://github.com/lco117/dummy-llm)

*One click gets you a running instance. **Cloudflare Workers** is the free, no-cold-start one — it ships with `workers.dev` and preview URLs disabled, so bind a custom domain (or set `"workers_dev": true` in `wrangler.jsonc`) to reach it. **Vercel** deploys the edge function and its catch-all rewrite. **Google Cloud Run** builds the Dockerfile, but needs a GCP account with billing enabled.*

</div>

---

## What is this?

You send any text. It "thinks" for a moment, then answers. By default that answer is your own words
handed straight back; the other three modes are fixed text, a random line, and a keyword→reply map.

But here is the part that makes it more than a joke: it answers **in the exact wire format** a real provider uses. Same SSE frames, same `data: [DONE]` sentinel, same Anthropic event order, same Ollama NDJSON. An unmodified official SDK cannot tell the difference until it reads the words.

That makes dummy-llm two things at once:

| You want to… | dummy-llm gives you |
| --- | --- |
| Watch a frontier model get replaced by a dummy | Point any chat client at it, change one line of config |
| Test an LLM app in CI | A deterministic, offline, instant, free LLM double |
| Reproduce a provider bug | Byte-exact fixtures you can diff |
| Test retry and backoff logic | Correctly shaped 429s, 500s and **mid-stream** failures |

## Quickstart

```bash
# Option A — Docker, built straight from the repository (no clone needed)
docker build -t dummy-llm https://github.com/lco117/dummy-llm.git
docker run --rm -p 8080:8080 -e DUMMY_TEXT=6 dummy-llm

# Option B — from source
git clone https://github.com/lco117/dummy-llm && cd dummy-llm
npm install
npm run dev              # Node 22.18+ runs the TypeScript directly
# or: npm run build && node dist/cli.js --port 8080

# Option C — npm, once the package is published (the name dummy-llm is free)
npx dummy-llm --port 8080 --text "6"
```

Now point any SDK at it and change nothing else:

```bash
# OpenAI SDK
export OPENAI_BASE_URL=http://localhost:8080/v1
export OPENAI_API_KEY=sk-dummy

# Anthropic SDK
export ANTHROPIC_BASE_URL=http://localhost:8080
export ANTHROPIC_API_KEY=sk-dummy

# Ollama clients
export OLLAMA_HOST=http://localhost:8080
```

```bash
curl -N http://localhost:8080/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"dummy-1","messages":[{"role":"user","content":"are you a real LLM?"}],"stream":true}'
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
| `DUMMY_TEXT` | `6` | The `fixed` mode answer template — `{input}` and `{model}` are substituted — and the fallback when the user says nothing |
| `DUMMY_MODE` | `echo` | `echo` (repeat the user) · `fixed` · `random` · `canned` |
| `DUMMY_LINES` | — | `a\|b\|c` replies for `random` mode |
| `DUMMY_CANNED` | — | JSON map of keyword → reply for `canned` mode |
| `DUMMY_ECHO_RAW` | — | Repeat the message verbatim, without stripping any harness noise |
| `DUMMY_STRIP` | — | Extra regexes (`\|`-separated) removed from user messages before echoing |
| `DUMMY_CHUNK` | `4` | Code points per streamed piece — 4 is about one English token. Also accepts `word` / `line` / `whole` |
| `DUMMY_TPS` | `100` | Tokens per second. What a piece is depends on `DUMMY_CHUNK`; `0` means no artificial delay |
| `DUMMY_DELAY_MS` | derived from `DUMMY_TPS` | Set explicitly to override `DUMMY_TPS` |
| `DUMMY_TTFT_MS` | `0` | Time to first token |
| `DUMMY_HANG_MS` | `0` | Delay before the first byte |
| `DUMMY_SEED` | `1` | Seeds ids and jitter, so runs are reproducible |
| `DUMMY_FAIL` | — | `429` · `429:after=3` · `rate_limit` · `off` |
| `DUMMY_API_KEY` | — | If set, API routes require this key |
| `DUMMY_CORS` | `*` | `Access-Control-Allow-Origin` |
| `DUMMY_LOG` | `off` | `off` / `summary` / `full` — log every request that arrives |
| `DUMMY_MAX_BODY` | `1000000` | Reject request bodies larger than this (`0` = unlimited) |
| `DUMMY_MODELS` | every persona | Comma separated model ids to advertise |
| `DUMMY_PERSONAS` | — | JSON map of extra personas: `{"dummy-ascii-1":{"mode":"fixed","text":"{input\|ascii}","thinking":[]}}` |
| `DUMMY_TOOLCALL` | — | Function name, or JSON `{"name":…,"arguments":…}` |
| `DUMMY_THINKING` | a pool of 10 | The "reasoning". `\|`-separated templates, one picked at random per request; `{input}` and `{reply}` are substituted; `off` disables it |

Every one of them is also a CLI flag: `dummy-llm --help`.

## Personas: the model id picks the answer

`/v1/models` is not decoration. Every advertised id is a persona, and the model a client sends
selects how the answer is written:

| model id | what it does |
| --- | --- |
| `dummy-echo-1` | repeats you back (the default persona) |
| `definitely-not-a-model` | refuses to be a language model, ten ways, each with its own ten-way "reasoning" |

Any **other** model string falls through to the server's own `DUMMY_MODE` / `DUMMY_TEXT`, so a client
that hardcodes `gpt-4o` still gets sensible behaviour.

## Modes

```bash
dummy-llm                             # echo   - says whatever you said  (default)
dummy-llm --mode fixed --text "6"     # fixed  - one answer, forever
dummy-llm --mode random --lines "6|7|maybe"
dummy-llm --mode canned --text "I do not know"
dummy-llm --no-thinking               # skip the hardcoded reasoning
# DUMMY_CANNED='{"weather":"It is raining.","name":"I am a dummy."}'
```

In `echo` mode it repeats the last **human** message. Agent harnesses stuff their own noise
into the conversation as user messages, in two flavours:

- **tagged blocks** — `<system-reminder>Updated instructions from: AGENTS.md…</system-reminder>`
- **bare metadata lines** — `Time sampled while preparing turn 1, step 1: …`,
  `Browser time zone for this request: …`, `Elapsed since the preceding model-visible message: …`

Both are dropped before deciding what you actually said, and if the newest message was nothing but
noise it walks back to the previous real one. Add your own rules with `DUMMY_STRIP`
(`|`-separated regexes), or turn all of it off with `--echo-raw` to see the request body byte
for byte.

## Templates and filters

Templates live in `DUMMY_TEXT`, `DUMMY_LINES`, `DUMMY_CANNED` and `DUMMY_THINKING`. Placeholders:
`{input}` (the cleaned-up user message), `{raw}` (untouched), `{reply}` (the answer being built),
`{model}` and `{text}`.

Filters compose with `|`:

```bash
dummy-llm --text '{input|upper}'        # SHOUT BACK
dummy-llm --text '{input|ascii}'        # render the message as a 3x5 block banner
dummy-llm --text '{input|box}'          # put it in an ASCII box
dummy-llm --text '{input|upper|box}'    # filters compose
dummy-llm --text 'you said {input} ({input|count} chars)'
```

Available: `upper` `lower` `title` `reverse` `spongebob` `leet` `truncate:N` `repeat:N`
`wrap:N` `indent:N` `box` `ascii` `morse` `base64` `hex` `json` `count` `hash`.

An unknown placeholder is left alone; an unknown filter is ignored. Filters are synchronous and
side-effect free on purpose — the streaming scheduler renders a piece without awaiting anything.

## Thinking

It "reasons" before it answers — by drawing one of ten hardcoded templates at random, obviously:

```bash
curl -s http://localhost:8080/v1/chat/completions -H 'content-type: application/json' \
  -d '{"model":"dummy-1","messages":[{"role":"user","content":"abc"}]}'
```

```json
{
  "role": "assistant",
  "content": "abc",
  "reasoning_content": "We need answer to user. User just said \"abc\". Need infer? Probably minimal. We need respond maybe \"abc\"."
}
```

Each protocol carries it the way that protocol really does:

| Protocol | Where the thinking appears |
| --- | --- |
| OpenAI Chat Completions | `delta.reasoning_content` / `message.reasoning_content` (the DeepSeek / vLLM convention) |
| OpenAI Responses | a `reasoning` output item with a `summary_text` summary, streamed as `response.reasoning_summary_text.delta` |
| Anthropic | a real `thinking` content block: `thinking_delta` frames plus a `signature_delta` |
| Gemini | a `Part` with `thought: true` |
| Ollama | `message.thinking` |

Rewrite the words with `DUMMY_THINKING` (placeholders `{input}`, `{reply}`, `{model}`) or drop them with `--no-thinking`.

## Fault injection

Real providers fail; your retry logic should be tested against something that fails on purpose.

```bash
dummy-llm --fail 429                  # shaped 429 rate_limit_error before the stream
dummy-llm --fail 500:after=3          # stream 3 frames, then break mid-stream
dummy-llm --hang 30000                # open the connection and say nothing
curl "localhost:8080/v1/chat/completions?fail=overloaded"   # per-request, no restart
```

Mid-stream failure is the interesting one: the client gets a valid stream that dies halfway, which is exactly the case that makes production code hang forever.

## Logging

`DUMMY_LOG=summary` prints one JSON line per request — the path, the model, how many messages
arrived and the last user message after reminder stripping. `full` adds the whole body.

```bash
dummy-llm --log summary         # locally
npx wrangler tail dummy-llm     # live from the deployed Worker
```

This is the fastest way to answer "what is my client actually sending?":

```json
{"dummy":"request","path":"/v1/chat/completions","model":"dummy-1","stream":true,"messages":2,"lastUser":"hwfaeouheaw"}
```

It is off by default; `wrangler.jsonc` enables `summary` for the deployed Worker.

## Deployment

| Target | Free tier | Streaming | Notes |
| --- | --- | --- | --- |
| **Cloudflare Workers** | ✅ 100k requests/day | ✅ native | one click, no cold start — [use the button](#-dummy-llm) |
| **Your VPS** | you pay the VPS | ✅ unlimited | Docker + Caddy, the "real" deployment |
| **Vercel** | ✅ Hobby (non-commercial) | ✅ | bounded by function max duration |
| **Deno Deploy** | ✅ | ✅ | five lines, `Deno.serve` |
| **Google Cloud Run** | ✅ scale-to-zero | ✅ | containers, needs billing |
| Render / HF Spaces / Netlify | ✅ | ✅ | idle-sleep caveats |

Full copy-paste configs, reverse-proxy settings and the SSE gotcha checklist live in **[docs/deployment.md](docs/deployment.md)**.

### Cloudflare Workers without the button

```bash
npx wrangler deploy        # deploys with no public route (see wrangler.jsonc)
```

`wrangler.jsonc` sets `workers_dev: false` and `preview_urls: false`, so a fresh deployment
is unreachable until you bind a domain (Worker → Settings → Domains & Routes). Flip either flag
back to `true` if you would rather have the free `*.workers.dev` URL.

Why Workers fits so well: the whole server is a Web `Request` → `Response` handler (`src/adapters/worker.ts` is 15 lines), so wrangler bundles the TypeScript directly. And the free plan's 10 ms CPU budget is not a problem — waiting between streamed chunks is wall-clock time, not CPU.

## Using it in your tests

```ts
import { spawn } from "node:child_process";

// pretend this is your CI setup step: npx dummy-llm --delay 0 --port 8080
const server = spawn("npx", ["dummy-llm", "--delay", "0", "--port", "8080"]);

const res = await fetch("http://localhost:8080/v1/chat/completions", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ model: "dummy-1", messages: [{ role: "user", content: "hi" }], stream: true }),
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

## Security

Short version: no runtime dependencies, no install scripts, no outbound requests, no storage,
and no secrets in the repository. The full threat model — including what you must configure
yourself — is in **[docs/security.md](docs/security.md)**.

## Launch & publishing

- **[docs/launch.md](docs/launch.md)** — taglines, ready-to-paste posts and where to submit.
- **[docs/publishing.md](docs/publishing.md)** — how and why to publish to npm, plus the one-command release flow.

## License

[MIT](LICENSE) © lco117 · 中文说明: [README.zh-CN.md](README.zh-CN.md)

Not affiliated with, endorsed by, or connected to OpenAI, Anthropic or Google. Protocol names
and shapes are reproduced for interoperability and testing only.

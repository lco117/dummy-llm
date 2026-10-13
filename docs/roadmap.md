# Roadmap

Each milestone is a mergeable, shippable slice. "Done when" is the acceptance bar.

> **v0.1.0 status:** M0–M5 are implemented **plus the echo + hardcoded-thinking behaviour** (the
> default: it says whatever you said, after "thinking"). The Worker is live on Cloudflare, the
> golden suite covers 30 wire-format cases across five protocols, and Docker/Caddy/Nginx/Vercel/Deno
> configs ship in the repo. Remaining M6 work: npm publish and a docs site (the Chinese README exists).

## M0 — Design (current)

- [x] repository, license, README
- [x] protocol design ([docs/design.md](design.md))
- [x] deployment guide ([docs/deployment.md](deployment.md))

## M1 — MVP: OpenAI Chat Completions on Node

Deliverables: `src/{index,config,engine,http,context,sse}.ts`,
`src/protocols/openai-chat.ts`, `adapters/node.ts`, CLI bin.

- [ ] `POST /v1/chat/completions` with `stream: true` and `false`
- [ ] `GET /v1/models` returning plausible ids
- [ ] fixed text, code-point chunking, `NPC_DELAY_MS`, `NPC_TTFT_MS`
- [ ] `data: [DONE]` sentinel and `stream_options.include_usage` chunk
- [ ] `GET /healthz`, permissive CORS, 404 in OpenAI error shape
- [ ] Dockerfile + `docker run -p 8080:8080`

**Done when** the official `openai` Node SDK streams `6` with no parser warnings, and a
golden `.sse` fixture diff passes in CI.

## M2 — Anthropic Messages

- [ ] `POST /v1/messages` (stream + non-stream), `count_tokens`
- [ ] `message_start` / `content_block_*` / `message_delta` / `message_stop` order
- [ ] `event: error` shape for injected faults

**Done when** ```anthropic-ai/sdk` streams and the raw fixture matches.

## M3 — Responses API + Ollama

- [ ] `POST /v1/responses` with the named-event sequence, no `[DONE]`
- [ ] `/api/chat`, `/api/generate`, `/api/tags`, `/api/version` (NDJSON)
- [ ] `NPC_MODE=echo` (repeat the user) — the actual npc joke

**Done when** the `openai` SDK's `responses.stream()` and an Ollama client both work.

## M4 — Gemini, embeddings, fault injection, canned replies

- [ ] `:generateContent` and `:streamGenerateContent?alt=sse`
- [ ] deterministic pseudo-embeddings
- [ ] `NPC_FAIL` / `NPC_FAIL_AFTER` / `NPC_HANG_MS` / `?fail=` override
- [ ] `NPC_MODE=canned` with a keyword map
- [ ] optional fixed `tool_calls` response

**Done when** a test asserts that a mid-stream failure surfaces as a client error, not a hang.

## M5 — Edge adapters and the public demo

- [ ] `adapters/worker.ts` + `wrangler.jsonc`
- [ ] `adapters/vercel.ts` + `vercel.json`
- [ ] `adapters/deno.ts`
- [ ] GitHub Actions: test matrix, GHCR image, optional auto-deploy to Workers
- [ ] live demo URL in the README, plus a "point your client at it" section per protocol

**Done when** the same commit is live on the VPS and on `*.workers.dev`.

## M6 — Open-source polish

- [ ] publish to npm so `npx npc-llm` works
- [ ] `CONTRIBUTING.md`, issue templates, "good first issue" labels
- [ ] Chinese README (`README.zh-CN.md`)
- [ ] landing page at `/` that renders the fixed string in a big font
- [ ] docs site (or just the `docs/` folder)

## Good first issues

- Ollama `/api/ps` and `/api/show` stubs
- Cohere v2 `/v1/chat` adapter
- `openai`-compatible `/v1/audio/speech` returning a silent WAV
- a `NPC_LATENCY_PROFILE` flag: `instant` / `dialup` / `sleepy`
- `curl` examples per protocol in the README
- a Teapot easter egg on `/v1/brew`

## Explicitly out of scope for v1

- conversation memory, `store`/`previous_response_id`
- auth beyond a single static key, quotas, billing
- Realtime/WebSocket API, image and audio generation

## Next: make the template engine the product (proposed, not built)

`echo` is one mode out of four. The centre of the project is the template engine, and it is currently
under-exposed: it lives in environment variables, has no names, and cannot be shared. In order:

### 1. Named templates, selected through the model field

`/v1/models` already returns a list, and all five protocols carry a model name. Let each advertised id
resolve to a template:

```
model: "npc-ascii"     -> the ASCII banner template
model: "npc-rickroll"  -> the rickroll template
```

Zero new API surface — the model field already exists everywhere — and the model picker in every chat UI
becomes a template picker. `/v1/models` stops being decoration.

### 2. Pipes in placeholders

`{input|upper}`, `{input|box}`, `{input|ascii}`, `{input|qr}`, `{input|morse}`,
`{input|reverse}`, `{reply|repeat:3}`.

This is what makes "an LLM that only answers in ASCII art" a *template* instead of a new mode, and filters
compose: `{input|upper|box}`.

Rules: filters stay **synchronous and side-effect free** (an async filter would break the absolute
scheduling in `phasesFor()`), and every filter gets a golden case.

### 3. Shippable packs

```bash
npc-llm --pack ./packs/rickroll
```

A pack is a small JSON file (or a directory): templates, a default mode, an optional thinking pool. Ship a
handful in `packs/` — `ascii-banner`, `rickroll`, `pirate`, `haiku-only`, `adversarial` — and let
people share their own as an npm package or a URL. A remote `NPC_PACK=https://…` would be the first
outbound request this server ever makes, so it must be opt-in and documented as such.

### 4. A template editor on the landing page

The landing page already streams from the real API. Put a textarea above the demo: edit the template, watch
the answer change live, then copy an env var or a deploy link. Cheapest virality this project has.

### 5. Record and replay

```bash
npc-llm --record --upstream https://api.openai.com/v1   # proxy once, save the frames
npc-llm --replay ./cassettes                           # serve them forever
```

VCR for LLMs. A different product tier — it means outbound requests and stored fixtures — so it belongs
behind its own flag, never in the default path.

### What I would not do

- **A separate ASCII mode.** It is a filter, not a mode; four modes is already plenty.
- **A full web UI.** The charm is `curl` plus one environment variable.
- **Any runtime dependency.** ASCII banner font data is a few KB of source, not a package.

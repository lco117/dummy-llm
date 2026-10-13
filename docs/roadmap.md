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

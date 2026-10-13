# Roadmap

**Current release: v0.3.0.** Everything under "Shipped" is in the repository and covered by the test
suite. Nothing here is aspirational any more — when it lands, it moves up.

## Shipped

### M0 — Design
- [x] repository, MIT licence, README, [AGENTS.md](../AGENTS.md)
- [x] protocol design ([design.md](design.md)) and deployment guide ([deployment.md](deployment.md))

### M1 — OpenAI Chat Completions on Node
- [x] `POST /v1/chat/completions`, streaming and not, plus the legacy `/v1/completions`
- [x] `GET /v1/models` and `/v1/models/{id}`
- [x] code-point chunking, `DUMMY_TPS` pacing, `DUMMY_TTFT_MS`
- [x] the `data: [DONE]` sentinel and the `stream_options.include_usage` chunk
- [x] `GET /healthz`, permissive CORS, 404 in the protocol's own error shape
- [x] Dockerfile, docker compose, Caddyfile, Nginx snippet

### M2 — Anthropic Messages
- [x] `POST /v1/messages`, `/v1/messages/count_tokens`, `GET /v1/models`
- [x] `message_start` → `ping` → `content_block_*` → `message_delta` → `message_stop`
- [x] `thinking` blocks with a closing `signature_delta`
- [x] `event: error` for injected faults

### M3 — Responses API and Ollama
- [x] `POST /v1/responses` with the named-event sequence and **no** `[DONE]`
- [x] `reasoning` output items streamed as `response.reasoning_summary_text.delta`
- [x] `/api/chat`, `/api/generate`, `/api/tags`, `/api/ps`, `/api/version`, `/api/embed`
- [x] `message.thinking`, and a top-level `thinking` on `/api/generate`

### M4 — Gemini, embeddings, faults and modes
- [x] `:generateContent` and `:streamGenerateContent?alt=sse`
- [x] `thought: true` parts
- [x] deterministic pseudo-embeddings
- [x] `DUMMY_FAIL`, `DUMMY_FAIL=…:after=N`, `DUMMY_HANG_MS`, `?fail=`
- [x] the `echo` / `fixed` / `random` / `canned` modes

### M5 — Edge adapters, deployment and the public demo
- [x] worker / vercel / deno adapters over one Web-standard handler
- [x] CI: typecheck, 53 tests, Worker bundle check, live smoke test
- [x] tag-driven release: npm publish, GHCR image, generated GitHub Release
- [x] one-click **Deploy to Cloudflare** and **Deploy with Vercel** buttons
- [x] custom domain declared in `wrangler.jsonc`; `workers.dev` and preview URLs off by default

### M6 — Open-source polish
- [x] published to npm as `dummy-llm`
- [x] CONTRIBUTING.md, [launch kit](launch.md), [security notes](security.md), [publishing guide](publishing.md)
- [x] Chinese README
- [x] landing page that streams from the real API
- [ ] issue and PR templates
- [ ] a docs site — the `docs/` folder is probably enough

### Template engine
- [x] reply values whose **shape is the behaviour** — the separate `mode` concept is gone
- [x] placeholders `{input}` `{raw}` `{reply}` `{model}` `{text}`
- [x] 18 filters, composable with `|` (`{input|upper|box}`)
- [x] personas selected by the model id (`dummy-echo-1`, `definitely-not-a-model`)
- [x] `DUMMY_PERSONAS` adds one from the environment, no code change
- [x] harness-noise stripping, extensible with `DUMMY_STRIP`
- [x] a hardcoded thinking pool, one template drawn per request

## Next

### 3. Packs — personas as shareable files

A pack is a JSON file (or a `pack.json` in a directory) holding a partial config plus a map of
personas: `dummy-llm --pack ./packs/rickroll`, or `DUMMY_PACK` on a Worker. The repository would
ship `packs/ascii-banner`, `packs/rickroll`, `packs/pirate`, `packs/haiku-only` and
`packs/adversarial` (for testing agent guardrails). A remote `https://` pack would be the first
outbound request this server ever makes, so it stays opt-in and documented.

### 4. Playground editor on the landing page — **shipped** (collapsed editor, `?t=` links, `DUMMY_PLAYGROUND`)

The landing page already streams from the real API. Add a template textarea and a mode switch,
backed by a per-request override (`?template=…&mode=…`, enabled by `DUMMY_PLAYGROUND=1`), plus a
shareable `?t=<base64>` link that pre-fills the editor. That link is the growth loop: people share
a URL that demonstrates a template.

### 5. Record and replay

`dummy-llm --record --upstream https://api.openai.com/v1` proxies once and writes every response to
`cassettes/*.sse`; `dummy-llm --replay ./cassettes` serves those bytes back deterministically. VCR
for LLMs — a test suite gets real model output without the network, the cost or the flakes. It makes
outbound requests and stores data on disk, so it lives behind its own flag and never in the default
path.

## What I would not do

- A separate ASCII mode. It is a filter, not a mode.
- A full web UI. The charm is `curl` plus one environment variable.
- Any runtime dependency. The ASCII font is a kilobyte of source, not a package.

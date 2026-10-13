# parrot-llm 🦜

**The LLM that always says the same thing — but speaks fluent OpenAI, Anthropic, Gemini, and Ollama.**

parrot-llm is a tiny, deterministic, zero-runtime-dependency "LLM" server. Ask it anything
and it answers with one fixed string (default: `6`). It streams that string back
token-by-token over Server-Sent Events with byte-exact protocol framing, so a real SDK
cannot tell it apart from a provider until it reads the words.

It exists for two reasons:

1. **Comedy.** Point any chat client at it and watch a frontier model become a parrot.
2. **Testing.** A deterministic, offline, instant, free LLM double for CI — the thing every
   team hand-rolls badly and nobody wants to maintain. A fake that is *protocol-accurate*
   is a real product.

> **Status: design phase.** No code yet. The spec is in [docs/design.md](docs/design.md),
> deployment in [docs/deployment.md](docs/deployment.md), and the plan in
> [docs/roadmap.md](docs/roadmap.md).

## Why it is not just a joke

Most "fake LLM" scripts break in the same three ways: wrong SSE framing, no `[DONE]`
sentinel, and non-deterministic chunk boundaries. parrot-llm treats the wire format as the
product:

- byte-exact frames for every supported protocol, verified against the official SDKs;
- deterministic output (seeded jitter), so snapshots never flake;
- **fault injection** — `?fail=429` or `PARROT_FAIL=500` returns a correctly shaped
  provider error, so you can test retry/backoff paths without unplugging the network;
- one handler, many runtimes: Node, Docker, Cloudflare Workers, Vercel, Deno Deploy.

## Planned quickstart

```bash
# nothing to install, Node 20+
npx parrot-llm --port 8080 --text "6"

# or Docker
docker run --rm -p 8080:8080 -e PARROT_TEXT=6 ghcr.io/OWNER/parrot-llm
```

Then point any SDK at it and change nothing else:

```bash
# OpenAI SDK
export OPENAI_BASE_URL=http://localhost:8080/v1
export OPENAI_API_KEY=sk-parrot

# Anthropic SDK
export ANTHROPIC_BASE_URL=http://localhost:8080
export ANTHROPIC_API_KEY=sk-parrot

# Ollama-style clients
export OLLAMA_HOST=http://localhost:8080
```

## Planned protocol surface

| Protocol | Endpoints | Streaming |
| --- | --- | --- |
| OpenAI Chat Completions | `/v1/chat/completions`, `/v1/completions` | SSE, `data: [DONE]` |
| OpenAI Responses | `/v1/responses` | SSE, named events |
| OpenAI misc | `/v1/models`, `/v1/embeddings` | — |
| Anthropic Messages | `/v1/messages`, `/v1/messages/count_tokens` | SSE, named events |
| Google Gemini | `/v1beta/models/{model}:generateContent` | SSE with `?alt=sse` |
| Ollama | `/api/chat`, `/api/generate`, `/api/tags` | NDJSON |

## Planned configuration

| Env | Default | Meaning |
| --- | --- | --- |
| `PARROT_TEXT` | `6` | the one thing it ever says |
| `PARROT_MODE` | `fixed` | `fixed` \| `echo` (repeat the user) \| `random` |
| `PARROT_CHUNK` | `1` | characters per streamed chunk |
| `PARROT_DELAY_MS` | `20` | delay between chunks (simulated typing) |
| `PARROT_TTFT_MS` | `0` | time to first token |
| `PARROT_SEED` | — | makes jitter reproducible |
| `PARROT_FAIL` | `off` | inject `429` / `500` / `timeout` |
| `PARROT_API_KEY` | — | if set, require this key |

## Planned deployment targets

| Target | Free tier | Streaming | Best for |
| --- | --- | --- | --- |
| Your VPS (Docker + Caddy) | you pay the VPS | unlimited | the real deployment |
| Cloudflare Workers | yes (100k req/day) | yes | free public demo |
| Vercel Hobby | yes (non-commercial) | yes | free public demo |
| Deno Deploy | yes | yes | free public demo |
| Google Cloud Run | yes, scale-to-zero | yes | free-ish + containers |

Details, caveats and copy-paste configs: [docs/deployment.md](docs/deployment.md).

## License

MIT — see [LICENSE](LICENSE).

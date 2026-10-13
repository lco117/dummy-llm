# Design

## 1. Goals and non-goals

**One sentence:** a Web-standard HTTP handler that any LLM SDK can talk to, that always
answers the same string, and that streams it with byte-exact provider framing.

### In scope

| id | goal |
| --- | --- |
| G1 | **Protocol fidelity** — an unmodified official SDK must parse our stream without warnings or retries. |
| G2 | **Determinism** — same request in, same bytes out. Optional seeded jitter for "human" typing. |
| G3 | **Runtime portability** — one core, thin adapters: Node, Docker, Cloudflare Workers, Vercel, Deno Deploy. |
| G4 | **Fault injection** — return correctly shaped provider errors (and mid-stream breaks) on demand. |
| G5 | **Zero runtime dependencies** — pure Web `Request` / `Response` / `ReadableStream`. |

### Non-goals

- N1 No real model, no model download, no GPU.
- N2 Stateless: no conversation memory, no `store`, no `previous_response_id` semantics.
- N3 No auth provider, no quota, no billing (a single optional static key).
- N4 No Realtime/WebSocket API in v1.
- N5 Not a prompt-evaluation harness.

## 2. Architecture

```
                    adapters
  node.ts (node:http)   worker.ts (fetch)   vercel.ts   deno.ts
        |                     |                  |          |
        +---------------------+------------------+----------+
                              |  Request
                     +--------v---------+
                     |      http.ts     |  routing, CORS, auth,
                     |  (Web Fetch API) |  error envelopes, health
                     +--------+---------+
                              |  CanonicalRequest
                     +--------v---------+
                     |     engine.ts    |  text + timing + faults
                     +--------+---------+
                              |  AsyncIterable<Piece>
   +--------------------------+---------------------------+
   |            |                  |                      |
openai-chat  openai-responses  anthropic   gemini    ollama
   |            |                  |                      |
   +--------------------------+---------------------------+
                              |  Response (ReadableStream)
```

**The one rule:** `engine.ts` knows nothing about protocols; the renderers know nothing
about timing. Adding a protocol means adding one file that maps `Piece` to frames.

## 3. Engine

### 3.1 Canonical request

```ts
interface CanonMessage { role: "system" | "user" | "assistant" | "tool"; content: string }
interface CanonRequest {
  protocol: "openai-chat" | "openai-responses" | "anthropic" | "gemini" | "ollama";
  model: string;
  messages: CanonMessage[];
  stream: boolean;
  maxTokens?: number;
  hasTools?: boolean;
  raw: unknown;
}
interface Piece { text: string; index: number; delayMs: number }
```

Each protocol module has exactly two jobs: `parse(body, headers) -> CanonRequest` and
`render(pieces, ctx) -> Response`.

### 3.2 Answer modes

| mode | behaviour |
| --- | --- |
| `echo` (default) | repeat the last user message verbatim (an NPC) |
| `fixed` | always `NPC_TEXT` |
| `random` | pick one line from a list |
| `canned` | keyword -> canned reply map from a JSON file (turns the joke into a usable stub) |

### 3.3 Chunking

Chunk by **code point** (via `Array.from`, never `split("")`) so emoji and CJK never break.
`NPC_CHUNK` accepts:
```
1        one code point per frame   (looks most like a real token stream)
word     one word per frame
line     one line per frame
whole    a single frame, then finish
```

### 3.4 Timing

`NPC_TTFT_MS` (silence before the first frame) then `NPC_DELAY_MS` per chunk.
Jitter is drawn from a seeded PRNG (mulberry32) so `NPC_SEED` makes it reproducible.
Timers are wall-clock, not CPU — this matters for the Workers free tier (section 5 of
[deployment.md](deployment.md)).

### 3.5 Rate, templates and logging

`NPC_TPS` (default 100) is the primary rate knob: the interval between pieces is
`round(1000 / tps)`, and `NPC_DELAY_MS` overrides it when set explicitly. `NPC_CHUNK`
defaults to **4 code points** — roughly one English token — so `NPC_TPS` matches what a
client's "tokens/s" readout actually counts.

Pacing targets an **absolute schedule** (`piece i is due at start + i * interval`) rather than
sleeping a fixed delay per piece. Timers in workerd and Node overshoot by a millisecond or two
every time, and a fixed sleep compounds that error: a stream configured for 100 tps measured
48 tps on the Cloudflare edge. With a deadline, a late timer shortens the next wait instead.

`NPC_TEXT` is a template, not a literal, in `fixed` / `random` / `canned` mode: `{input}`
(the cleaned-up user message) and `{model}` are substituted. `NPC_THINKING` additionally
gets `{reply}` and `{text}`. It is a pool, not a string: templates are
`\|`-separated (ten ship by default) and `renderThinking()` draws one per request, so a chat
never gets the same fake reasoning twice. Pinning `NPC_SEED` makes the draw reproducible. Placeholders never appear in `echo` mode, where the answer is
the user's own words.

`NPC_LOG` = `off` | `summary` | `full`. Logging happens in `readJson()` in
`src/http.ts`, i.e. once per request that carries a body, using the same
`stripReminders()` the echo mode uses — so the log shows what the NPC actually heard.

### 3.5 Fault injection

| switch | effect |
| --- | --- |
| `NPC_FAIL=429` / `500` / `503` | fail before streaming, correctly shaped |
| `NPC_FAIL=500:after=3` | stream 3 pieces (thinking included), then error mid-stream |
| `NPC_HANG_MS=30000` | open the stream and send nothing |
| `?fail=rate_limit` | per-request override, no restart |

A **mid-stream** failure is the most valuable one: it is exactly what every client's
retry logic gets wrong, and no mock server does it.

### 3.6 Hardcoded thinking

Before the reply, the engine yields a second channel: the "reasoning". It is a template
(`NPC_THINKING`) with the user's own words interpolated — `{input}`, `{reply}`,
`{model}`, `{text}`. The default is:

```
We need answer to user. User just said "{input}". Need infer? Probably minimal. We need respond maybe "{reply}".
```

The `{input}` placeholder is fed by `userInput()`, which removes two families of harness
noise — tagged `<system-reminder>…</system-reminder>` blocks (plus a trailing unclosed opener) and
bare metadata lines (`Time sampled while preparing turn …`, `Browser time zone for this request: …`,
`Elapsed since the preceding model-visible message: …`, `Current runtime context.`, `Approval policy:`)
— then walks back to the previous user message when the newest one was nothing but noise.
`NPC_STRIP` adds operator-supplied regexes and `NPC_ECHO_RAW=1` disables everything, which is
how you inspect a request body byte for byte.

`phases()` / `phasesFor()` yield `{ channel: "thinking" | "text", text, index }`, and every renderer
maps those channels onto its own protocol's native carrier:

| protocol | carrier |
| --- | --- |
| openai-chat | `delta.reasoning_content` / `message.reasoning_content` (the DeepSeek / vLLM convention) |
| openai-responses | a `reasoning` output item, streamed as `response.reasoning_summary_text.delta` frames |
| anthropic | a `thinking` content block: `thinking_delta` frames plus a closing `signature_delta` |
| gemini | a `Part` with `thought: true` |
| ollama | `message.thinking`, and a top-level `thinking` field on `/api/generate` |

A renderer that needs the answer up front (for output indices) calls `plan()` once and hands the
result to `phasesFor()`; calling `plan()` twice would consume the seeded PRNG twice.
`NPC_FAIL=...:after=N` counts every streamed piece, thinking included.

### 3.7 The template language

A template is any string in `NPC_TEXT`, `NPC_LINES`, `NPC_CANNED` or `NPC_THINKING`. Placeholders
are ```{name|filter:arg|filter}```; unknown names are left untouched and unknown filters are ignored, so a
typo degrades to text instead of throwing mid-stream.

Filters are **synchronous and side-effect free by construction** — `phasesFor()` slices a rendered string
into timed pieces and cannot await a transform, so an async filter would break pacing. `ascii` embeds a
3×5 block font (~1 KB of source) rather than a package, keeping §"zero runtime dependencies" true.

### 3.8 Personas

`Config.personas` maps a model id to a partial override (`mode`, `text`, `lines`, `thinking`).
`plan()` resolves `withPersona(cfg, canon.model)` once per request, so every renderer keeps using the
global config for chunking and pacing while the *content* follows the persona. `/v1/models` is derived
from the same map, which is what turns a model picker into a persona picker.

## 4. Wire formats

These are the contracts the tests will assert byte-for-byte.

### 4.1 OpenAI Chat Completions — `POST /v1/chat/completions`

Response headers: `Content-Type: text/event-stream; charset=utf-8`,
`Cache-Control: no-cache, no-transform`, `Connection: keep-alive`,
`X-Accel-Buffering: no`.

```
data: {"id":"chatcmpl-8xKQ","object":"chat.completion.chunk","created":1786000000,"model":"gpt-4o","system_fingerprint":"fp_npc","choices":[{"index":0,"delta":{"role":"assistant","content":""},"logprobs":null,"finish_reason":null}]}

data: {"id":"chatcmpl-8xKQ","object":"chat.completion.chunk","created":1786000000,"model":"gpt-4o","system_fingerprint":"fp_npc","choices":[{"index":0,"delta":{"content":"6"},"logprobs":null,"finish_reason":null}]}

data: {"id":"chatcmpl-8xKQ","object":"chat.completion.chunk","created":1786000000,"model":"gpt-4o","system_fingerprint":"fp_npc","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]}

data: [DONE]

```

Notes that clients actually depend on:

- the first frame carries `delta.role`, the last carries an **empty** `delta` plus
  `finish_reason`, and only then the literal `[DONE]` sentinel;
- if the request sets `stream_options.include_usage: true`, emit an extra chunk with
  `choices: []` and a `usage` object immediately before `[DONE]`;
- if `tools` is present and `NPC_TOOLCALL` is on, finish with
  `finish_reason: "tool_calls"` and a delta of
  `tool_calls: [{"index":0,"id":"call_npc","type":"function","function":{"name":"...","arguments":"{}"}}]`
  streamed in pieces;
- `content` may also be an array of parts in newer clients — normalize on input.

Non-streaming body: `{"id":"chatcmpl-...","object":"chat.completion","created":...,"model":...,"system_fingerprint":"fp_npc","choices":[{"index":0,"message":{"role":"assistant","content":"6"},"finish_reason":"stop"}],"usage":{"prompt_tokens":9,"completion_tokens":1,"total_tokens":10}}`

### 4.2 OpenAI Responses — `POST /v1/responses`

Streaming uses **named** SSE events and has **no `[DONE]`**; the stream ends after
`response.completed`. Minimum viable sequence:

```
event: response.created
data: {"type":"response.created","response":{"id":"resp_npc","object":"response","status":"in_progress","model":"gpt-4o","output":[]}}

event: response.output_item.added
data: {"type":"response.output_item.added","output_index":0,"item":{"id":"msg_npc","type":"message","status":"in_progress","role":"assistant","content":[]}}

event: response.content_part.added
data: {"type":"response.content_part.added","item_id":"msg_npc","output_index":0,"content_index":0,"part":{"type":"output_text","text":"","annotations":[]}}

event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"msg_npc","output_index":0,"content_index":0,"delta":"6"}

event: response.output_text.done
data: {"type":"response.output_text.done","item_id":"msg_npc","output_index":0,"content_index":0,"text":"6"}

event: response.content_part.done
data: {"type":"response.content_part.done","item_id":"msg_npc","output_index":0,"content_index":0,"part":{"type":"output_text","text":"6","annotations":[]}}

event: response.output_item.done
data: {"type":"response.output_item.done","output_index":0,"item":{"id":"msg_npc","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"6","annotations":[]}]}}

event: response.completed
data: {"type":"response.completed","response":{"id":"resp_npc","object":"response","status":"completed","model":"gpt-4o","output":[{"id":"msg_npc","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"6","annotations":[]}]}],"usage":{"input_tokens":9,"output_tokens":1,"total_tokens":10}}}

```

The event `sequence_number` / `type` pairing is version-sensitive: pin our frames to the
`openai` SDK version used in CI and re-verify on upgrade.

### 4.3 Anthropic Messages — `POST /v1/messages`

Requires `x-api-key` and `anthropic-version`; we accept any key and echo the header back
only if configured. Event order:

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_npc","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":1}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: ping
data: {"type":"ping"}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"6"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":1}}

event: message_stop
data: {"type":"message_stop"}

```

Errors use the `event: error` frame with `{"type":"error","error":{"type":"rate_limit_error","message":"..."}}`.
`POST /v1/messages/count_tokens` returns `{"input_tokens":42}`.
Extended thinking can be faked with a `thinking` content block if `NPC_THINKING` is set.

### 4.4 Google Gemini — `POST /v1beta/models/{model}:generateContent`

`:streamGenerateContent?alt=sse` yields unnamed `data:` frames, no sentinel:

```
data: {"candidates":[{"content":{"parts":[{"text":"6"}],"role":"model"},"finishReason":"STOP","index":0}],"usageMetadata":{"promptTokenCount":9,"candidatesTokenCount":1,"totalTokenCount":10},"modelVersion":"gemini-2.5-flash"}

```

Non-SSE streaming returns concatenated JSON objects; we support `alt=sse` first because that
is what the JS/Python SDKs use. Key comes from `x-goog-api-key` or `?key=`.

### 4.5 Ollama — `POST /api/chat`, `/api/generate`, `GET /api/tags`

Newline-delimited JSON, one object per line, terminated by `done: true`:

```
{"model":"llama3.2","created_at":"2026-01-01T00:00:00Z","message":{"role":"assistant","content":"6"},"done":false}
{"model":"llama3.2","created_at":"2026-01-01T00:00:00Z","message":{"role":"assistant","content":""},"done":true,"done_reason":"stop","eval_count":1,"prompt_eval_count":9}

```

`GET /api/version` -> `{"version":"0.0.1-npc"}`, `GET /api/tags` -> a model list so
Ollama UIs show something.

### 4.6 Model catalogue and embeddings

`GET /v1/models` advertises exactly three ids: `npc-1`, `npc-1-mini` and
`definitely-not-a-model`. The default is deliberately honest about what this thing is.
Chat UIs such as LibreChat, Open WebUI, Cline and Continue populate their model picker from
this endpoint, so a real deployment can set `NPC_MODELS` to plausible provider ids
(`gpt-4o`, `claude-sonnet-4-20250514`, …) when a convincing picker matters.
Requests may name **any** model string; only this endpoint is filtered.

`POST /v1/embeddings` returns a deterministic pseudo-vector derived from a hash of the input
(same text -> same vector, so vector-search tests are stable), dimension from the request.

## 5. HTTP behaviour

| concern | decision |
| --- | --- |
| routing | table of `{method, path pattern, handler}`, matched before protocol dispatch |
| auth | `NPC_API_KEY` unset -> accept anything; set -> require it (`Authorization: Bearer`, `x-api-key`, or `?key=`) |
| CORS | permissive by default (browser demos are the point), `NPC_CORS` to restrict |
| `OPTIONS` | 204 with preflight headers |
| health | `GET /healthz` -> `{"ok":true,"mode":"fixed"}` |
| root | `GET /` -> tiny HTML page that prints the fixed string |
| unknown route | 404 shaped like the protocol the client is speaking, when inferable |
| logging | one line per request: method, path, model, stream, duration, bytes |

## 6. Repository layout (planned)

```
src/
  index.ts          public entry: createApp(config) -> (Request) => Promise<Response>
  config.ts         env / flags -> Config
  engine.ts         CanonRequest -> AsyncIterable<Piece>
  http.ts           routing, CORS, auth, errors
  context.ts        canonical request types
  protocols/
    openai-chat.ts
    openai-responses.ts
    anthropic.ts
    gemini.ts
    ollama.ts
  sse.ts            frame writers shared by every protocol
adapters/
  node.ts           node:http server  (VPS, Docker, bin)
  worker.ts         Cloudflare Workers fetch handler
  vercel.ts         Vercel function handler
  deno.ts           Deno.serve
test/
  unit/             frame builders, chunker, PRNG
  contract/         official SDKs against a live instance
  golden/           committed raw .sse files per protocol
deploy/
  Dockerfile  docker-compose.yml  Caddyfile  nginx.conf  wrangler.toml  vercel.json
```

## 7. Testing strategy

1. **Golden frames.** Every protocol keeps a committed `.sse` fixture; a test replays the
   request with a fixed seed and diffs the raw bytes. This is the regression net.
2. **SDK contracts.** CI installs `openai`, ```anthropic-ai/sdk` and `ollama` and drives
   the real client code against `localhost`. If the SDK can parse it, it is compatible.
3. **Breakage tests.** Assert that a mid-stream `NPC_FAIL_AFTER` produces a client-side
   error rather than a hang — the behaviour consumer apps must handle.
4. **Runtime matrix.** Node 20/22, `wrangler dev` (Workers), Deno. One GitHub Actions job each.

## 8. Naming

Working title `npc-llm`. Alternatives if npm/GitHub is taken: `mock-llm`,
`stub-llm`, `yesman-llm`, `gpt-npc`. Check `npm view <name>` before publishing.

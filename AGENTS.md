# AGENTS.md

Instructions for AI coding agents (and humans who like checklists) working on **dummy-llm**.

## TL;DR for an agent asked to "deploy this"

```bash
npm install
npm test                      # must be green before deploying
npx wrangler whoami           # is this machine already authenticated?
npx wrangler deploy           # publishes the Worker
```

- If `wrangler whoami` fails, **do not** try to log in on the user's behalf. Ask the human to run `npx wrangler login` (interactive) or to export `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`. Then retry `npx wrangler deploy`.
- `wrangler.jsonc` ships with `workers_dev: false` and `preview_urls: false`, so a fresh deploy has **no public URL**. Bind a domain in the Cloudflare dashboard (Worker → Settings → Domains & Routes), or flip `workers_dev` to `true` first. Then verify with `curl <url>/healthz` and one streaming request (see "Smoke test" below).
- The repo must be **public** for the README deploy buttons to work. There are three: Cloudflare (the primary), Vercel and Google Cloud Run.

## What this project is

A fake LLM server. It **says whatever the user said** (`DUMMY_MODE=echo`, the default) after emitting a **hardcoded "thinking"** template (`DUMMY_THINKING`, with `{input}` and `{reply}` placeholders), all in the exact wire format of OpenAI, Anthropic, Gemini or Ollama. It is used for (a) comedy and (b) deterministic LLM testing in CI.

## Golden rules

1. **Never hand-edit `test/golden/*.txt`.** They are generated. After any intentional protocol change run `npm run golden` and review the diff like a code review — that diff *is* the API contract.
2. **Never break SSE framing.** One event per write, blank line after `data:`, literal `data: [DONE]` only for OpenAI Chat Completions and legacy Completions. The Responses API terminates with `response.completed` and has **no** `[DONE]`.
3. **Zero runtime dependencies.** Only `devDependencies` may be added, and only with a strong reason. The core is Web-standard `Request` / `Response` so the same code runs on Node, Workers, Vercel Edge and Deno.
4. **Respect the boundary.** `src/engine.ts` and `src/config.ts` must never import a protocol; `src/protocols/*` must never implement timing or sleep. Protocol modules parse into a `CanonRequest` and render an `AsyncIterable<string>`.
5. **Do not add `Content-Length`** to streamed responses, and never buffer a whole stream before returning it.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the server from TypeScript (Node 22.18+ type stripping) |
| `npm test` | Golden fixtures + unit tests via `node:test` |
| `npm run golden` | Regenerate `test/golden/*.txt` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Bundle `dist/cli.js` and `dist/index.js` with esbuild |
| `npm run deploy` | `wrangler deploy` (the Cloudflare Worker) |

## Smoke test after deploying

```bash
curl -s https://<your-worker-url>/healthz
curl -sN https://<your-worker-url>/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"dummy-echo-1","messages":[{"role":"user","content":"hi"}],"stream":true}'
```

You want: a `200` with `text/event-stream`, several `delta` frames, and a final `data: [DONE]`.

## Changing the answer

- **What it says back.** Default `DUMMY_MODE=echo` repeats the last user message after `stripReminders()` removes harness noise — tagged `<system-reminder>…</system-reminder>` blocks **and** bare metadata lines such as `Time sampled while preparing turn 1, step 1: …`, `Browser time zone for this request: …`, `Elapsed since the preceding model-visible message: …`. If the newest user message was pure noise it walks back to the previous real one. `DUMMY_STRIP` adds operator regexes; `DUMMY_ECHO_RAW=1` disables all of it. New harness noise belongs in `HARNESS_LINE` in `src/engine.ts`, with a golden case in `test/cases.ts`. `fixed` answers `DUMMY_TEXT` forever, `random` picks from `DUMMY_LINES`, `canned` matches keywords via `DUMMY_CANNED`.
- **Personas.** The model id selects an answer profile (see `src/personas.ts`): `dummy-echo-1` repeats you, `definitely-not-a-model` refuses to be a model. An unknown model falls through to `DUMMY_MODE`/`DUMMY_TEXT`. Adding a persona means adding one entry there — `DEFAULT_MODELS` is derived from it.
- **Templates and filters.** `{input|upper|box}`. Filters live in `src/filters.ts` and **must stay synchronous and side-effect free**, because `phasesFor()` renders a piece without awaiting. Every new filter needs a unit case in `test/unit.test.ts` plus, if it changes a wire-visible default, a golden.
- **What it "thinks".** `DUMMY_THINKING` is a `\|`-separated pool (ten templates ship by default) rendered into every protocol's native reasoning channel; one is drawn per request unless the seed is pinned. `{input}` is the user's message, `{reply}` is the answer. `--no-thinking` (or `DUMMY_THINKING=off`) removes the channel entirely.
- **How fast.** `DUMMY_TPS` (default 100) sets tokens per second. A token is `DUMMY_CHUNK` code points (default 4, i.e. one English token); `DUMMY_DELAY_MS` overrides the pacing. Pacing targets an absolute schedule, so this is the long-run rate, not a per-frame sleep.
- **What it logs.** `DUMMY_LOG=summary` (enabled in `wrangler.jsonc`) prints one JSON line per request; read it with `npx wrangler tail dummy-llm`. `full` includes bodies, `off` is silent.
- Permanent on a deployed Worker: edit the `vars` block in `wrangler.jsonc` and redeploy, or set the variable in the Cloudflare dashboard.

## Adding a new protocol (recipe)

1. Create `src/protocols/<name>.ts` exporting a handler `(body: unknown, ctx: Ctx) => Response`.
2. Parse the request into a `CanonRequest`; reuse `normalizeContent` from `openai-chat.ts` for message shapes.
3. Render frames with `sse()` / `ndjson()` from `src/sse.ts` and return `streamResponse(frames(), HEADERS)`. Iterate `plan()` + `phasesFor()` (or `phases()`) so both the `thinking` and `text` channels are handled; call `plan()` once and pass the result to `phasesFor()` when your framing needs the answer up front, because calling `plan()` twice consumes the seeded PRNG twice.
4. Wrap the piece loop in `try/catch` and re-emit `FaultError` with `streamErrorFrame()` so mid-stream fault injection still works.
5. Wire it in `src/http.ts` and add a case to `test/cases.ts`.
6. `npm run golden`, then `npm test`, then `npm run typecheck`.
7. Update the endpoint table in `README.md` and `docs/design.md`.

## Environment variables

See the table in `README.md`. The same names work everywhere: `process.env` on Node, the `env` binding on Workers, dashboard variables when deployed.

## Repo URL placeholder

The buttons and clone commands use `lco117/dummy-llm`. If this repository lives somewhere else, run:

```bash
npm run set-repo -- owner/repo
```

That rewrites `README.md`, `AGENTS.md` and `package.json` in one shot.

## Publishing to npm

The package name `dummy-llm` is free on npm. Note that `npm unpublish` and `npm deprecate` ignore `publishConfig` and use the machine's registry (often a read-only mirror), so pass the registry explicitly: `npm unpublish dummy-llm@x.y.z --force --registry=https://registry.npmjs.org/`.

```bash
npm login --registry=https://registry.npmjs.org/   # interactive: the human must do this
npm test && npm run typecheck
npm publish --access public --registry=https://registry.npmjs.org/
```

`prepublishOnly` already runs the build, so `npx dummy-llm` works as soon as the publish lands.

## Commit conventions

Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`. Keep commits small and independently meaningful — the git history is part of the documentation.

## Things that will bite you

- **Reverse proxies buffer SSE.** Nginx needs `proxy_buffering off`; Caddy does not.
- **Compression buffers SSE.** Do not gzip `text/event-stream`.
- **Workers CPU time is not wall-clock time.** `setTimeout` between chunks does not consume the free plan's 10 ms CPU budget, but heavy synchronous work does.
- **`node --test` needs Node 22.18+** to run `.ts` test files directly.

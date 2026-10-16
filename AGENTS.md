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
- `wrangler.jsonc` ships with `workers_dev: true`, `preview_urls: false` and **no `routes` block**, so a fresh deploy is reachable at once on its free `*.workers.dev` URL. Never commit a hostname: to serve it on a domain of your own instead, pass `npx wrangler deploy --domain your.example.com` (or `npm run deploy:domain -- your.example.com`), add a route, or bind it in the dashboard (Worker → Settings → Domains & Routes) — and set `workers_dev: false` if you want the `*.workers.dev` URL gone. Then verify with `curl <url>/healthz` and one streaming request (see "Smoke test" below).
- The repo must be **public** for the README deploy buttons to work. There are three: Cloudflare (the primary), Vercel and Google Cloud Run.

## What this project is

A fake LLM server. `DUMMY_REPLY` decides what it says — the default `"{input}"` repeats you — after emitting a **hardcoded "thinking"** template (`DUMMY_THINKING`, with `{input}` and `{reply}` placeholders), all in the exact wire format of OpenAI, Anthropic, Gemini or Ollama. It is used for (a) comedy and (b) deterministic LLM testing in CI.

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

- **What it says back.** `DUMMY_REPLY` is the whole story: `"{input}"` (the default — what older versions called "echo" is literally this template), `"6"`, `'["6","7","maybe"]'`, or `'{"weather":"raining","*":"no idea"}'`. **The shape of the value is the behaviour; there is no mode.** Harness noise is stripped first (`HARNESS_LINE` in `src/engine.ts`), `DUMMY_STRIP` adds operator regexes, `DUMMY_ECHO_RAW=1` disables it. The pre-0.4 `DUMMY_MODE`/`_TEXT`/`_LINES`/`_CANNED` quartet still maps onto a reply value for one release.

- **Personas.** The model id selects an answer profile (see `src/personas.ts`): `dummy-echo-1` repeats you, `definitely-not-a-model` refuses to be a model. An unknown model falls through to `DUMMY_REPLY`. Adding a persona means adding one entry there — `DEFAULT_MODELS` is derived from it.
- **The playground.** `DUMMY_PLAYGROUND=1` lets a caller pass `?t=<template>`; `playgroundOverride()` in `src/config.ts` applies it to that one request, capped at 2000 characters in and 100000 out, and the landing page labels such answers as visitor-supplied. Off by default, and `?t=` is ignored entirely when off.

- **The admin page.** `src/admin.ts` is the `/admin` surface, `src/admin-auth.ts` is its cookie and CSRF handling, `src/admin-access.ts` verifies Cloudflare Access JWTs, `src/admin-ui.ts` is the page, and `src/store.ts` is the writable overlay. Rules that must not be broken:
  - `/admin*` stays **404** unless `DUMMY_ADMIN_KEY` is set or Access is configured, and it is routed **before** the CORS wrapper and the `DUMMY_API_KEY` check.
  - No secret reaches a log line, a response or a page. Use `src/redact.ts`; never `console.log` a body or a key directly.
  - The pages interpolate **only authored strings from `src/i18n.ts`**. No user, persona, store or request value is ever interpolated into HTML: the client writes those with `textContent`. Add one `innerHTML` and the XSS story the CSP depends on is gone.
  - Writes go through the store layer, never the environment, and are validated before they land. Resolution order is **store > environment > built-in**.
  - The preview must call `openaiChat.chat()` with a synthesised request. Never re-implement the engine in the browser — a test asserts the preview is byte-identical to a client request.
  - Changing any of this means updating `docs/admin.md` and the security deltas in `docs/security.md` in the same commit.
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

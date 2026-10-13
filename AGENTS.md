# AGENTS.md

Instructions for AI coding agents (and humans who like checklists) working on **parrot-llm**.

## TL;DR for an agent asked to "deploy this"

```bash
npm install
npm test                      # must be green before deploying
npx wrangler whoami           # is this machine already authenticated?
npx wrangler deploy           # publishes the Worker
```

- If `wrangler whoami` fails, **do not** try to log in on the user's behalf. Ask the human to run `npx wrangler login` (interactive) or to export `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`. Then retry `npx wrangler deploy`.
- The deploy prints a URL like `https://parrot-llm.<subdomain>.workers.dev`. Verify it with `curl <url>/healthz` and one streaming request (see "Smoke test" below).
- The repo must be **public** for the README deploy button to work.

## What this project is

A fake LLM server. Every request returns a fixed string (`PARROT_TEXT`, default `6`), streamed in the exact wire format of OpenAI, Anthropic, Gemini or Ollama. It is used for (a) comedy and (b) deterministic LLM testing in CI.

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
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}],"stream":true}'
```

You want: a `200` with `text/event-stream`, several `delta` frames, and a final `data: [DONE]`.

## Changing the answer

- One-off: `parrot-llm --text "your text"` or `PARROT_TEXT`.
- Permanent on a deployed Worker: edit the `vars` block in `wrangler.jsonc` and redeploy, or set the variable in the Cloudflare dashboard.
- Funnier modes: `PARROT_MODE=echo` repeats the user; `PARROT_MODE=canned` with `PARROT_CANNED` returns keyword-matched replies.

## Adding a new protocol (recipe)

1. Create `src/protocols/<name>.ts` exporting a handler `(body: unknown, ctx: Ctx) => Response`.
2. Parse the request into a `CanonRequest`; reuse `normalizeContent` from `openai-chat.ts` for message shapes.
3. Render frames with `sse()` / `ndjson()` from `src/sse.ts` and return `streamResponse(frames(), HEADERS)`.
4. Wrap the piece loop in `try/catch` and re-emit `FaultError` with `streamErrorFrame()` so mid-stream fault injection still works.
5. Wire it in `src/http.ts` and add a case to `test/cases.ts`.
6. `npm run golden`, then `npm test`, then `npm run typecheck`.
7. Update the endpoint table in `README.md` and `docs/design.md`.

## Environment variables

See the table in `README.md`. The same names work everywhere: `process.env` on Node, the `env` binding on Workers, dashboard variables when deployed.

## Repo URL placeholder

The buttons and clone commands use `lco117/parrot-llm`. If this repository lives somewhere else, run:

```bash
npm run set-repo -- owner/repo
```

That rewrites `README.md`, `AGENTS.md` and `package.json` in one shot.

## Publishing to npm

The package name @@parrot-llm@@ was free when this repo was created; as of v0.1.0 it is **not yet published**.

@@@bash
npm login --registry=https://registry.npmjs.org/   # interactive: the human must do this
npm test && npm run typecheck
npm publish --access public --registry=https://registry.npmjs.org/
@@@

@@prepublishOnly@@ already runs the build, so @@npx parrot-llm@@ works as soon as the publish lands.

## Commit conventions

Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`. Keep commits small and independently meaningful — the git history is part of the documentation.

## Things that will bite you

- **Reverse proxies buffer SSE.** Nginx needs `proxy_buffering off`; Caddy does not.
- **Compression buffers SSE.** Do not gzip `text/event-stream`.
- **Workers CPU time is not wall-clock time.** `setTimeout` between chunks does not consume the free plan's 10 ms CPU budget, but heavy synchronous work does.
- **`node --test` needs Node 22.18+** to run `.ts` test files directly.

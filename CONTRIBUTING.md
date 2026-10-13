# Contributing

Thanks for wanting to give the dummy a new line. 🧍

## Ground rules

1. **Zero runtime dependencies.** The core must stay Web-standard (`Request` / `Response` / `ReadableStream`) so it runs identically on Node, Cloudflare Workers, Vercel Edge and Deno.
2. **Wire-format changes are breaking changes.** If the bytes on the wire change, say so in the PR and explain which SDK needs it.
3. **Regenerate goldens, never hand-edit them:** `npm run golden`, then read the diff.
4. **Then:** `npm run typecheck`, `npm test`, `npm run build`.

## Good first issues

- A Cohere v2 `/v1/chat` adapter
- `/api/ps` and `/api/show` for Ollama
- An OpenAI-compatible `/v1/audio/speech` returning a silent WAV
- A `DUMMY_LATENCY_PROFILE` flag: `instant` / `dialup` / `sleepy`
- A Chinese README (`README.zh-CN.md`)

## Adding a protocol

See the recipe in [AGENTS.md](AGENTS.md#adding-a-new-protocol-recipe) — it is short on purpose: one new file, one route, one test case, one golden file.

## Commit style

Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), small and independently reviewable.

## License

By contributing you agree that your work is released under the [MIT License](LICENSE).

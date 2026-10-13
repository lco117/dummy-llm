# Security notes

An honest assessment, including the parts that are not solved.

## Threat model

dummy-llm is a **stateless HTTP server that returns a canned answer**. It is not a secret store,
not a proxy to a real model, and not multi-tenant. The realistic risks are:

1. someone burning through your free quota or your VPS bandwidth;
2. someone trying to use it as a proxy or SSRF pivot;
3. you leaking your own users' prompts through logging;
4. supply-chain risk in the thing you install.

## Safe by construction

| property | how |
| --- | --- |
| **Zero runtime dependencies** | `package.json` has no `dependencies` at all. Nothing transitive can be hijacked at runtime; the whole server is one esbuild bundle. |
| **No install-time code** | There is no `postinstall`, `preinstall` or `prepare` script. Installing the package never executes project code. `prepublishOnly` runs only on the publisher's machine. |
| **No outbound requests** | The server never calls another host, so there is no SSRF surface and nothing to exfiltrate to. |
| **No storage** | Nothing is written to disk, KV, D1 or R2. No persistence, no cross-request state. |
| **No secrets in the repo** | Verified by scanning the tracked tree for common token shapes. `.env` is gitignored and `.dev.vars.example` ships fully commented out. |
| **No XSS** | The landing page escapes every operator-controlled value (`escapeHtml`) and the live demo writes model output with `textContent`, never `innerHTML`. |
| **Request size guard** | `DUMMY_MAX_BODY` (default 1 MB) rejects oversized bodies — it checks `content-length` before buffering and re-checks the decoded length afterwards. |
| **Not publicly routable by default** | `wrangler.jsonc` sets `workers_dev: false` and `preview_urls: false`, so a fresh deployment has no URL until the operator binds a domain. |
| **Streaming does not add smuggling surface** | We never set `Content-Length` on a stream and never mix framing; responses are plain Web `Response` objects. |

## What you must configure yourself

| exposure | risk | mitigation |
| --- | --- | --- |
| No API key | Anyone who finds the URL can generate traffic | Set `DUMMY_API_KEY`. It is accepted as `Authorization: Bearer`, `x-api-key`, `x-goog-api-key` or `?key=` |
| `DUMMY_LOG=summary` | The last user message ends up in Workers Logs | Set `DUMMY_LOG=off` for real traffic. `full` records entire request bodies — only use it while debugging your own client |
| Public URL | Free plan is ~100k requests/day | Add a Cloudflare **Rate Limiting** rule or WAF rule in front of the Worker |
| `DUMMY_HANG_MS` | Holds connections open on purpose | Keep it at 0 in production; it exists to test client timeouts |
| `DUMMY_CORS=*` (default) | Any web page can call the endpoint from a browser | Set `DUMMY_CORS=https://your.app` |
| Echo mode | It mirrors whatever you send | Do not point it at traffic containing secrets. It stores nothing, but your client and your logs might |

## Known gaps

- **Auth is one static shared key**, compared with `===`. Constant-time comparison is not worth it
  for an ephemeral joke key, but the gap is real and documented rather than hidden.
- **No rate limiting in the application.** Use the platform (Cloudflare Rate Limiting, an Nginx
  `limit_req` zone, a Caddy plugin).
- **No per-IP quota, no audit log beyond the optional request line.**
- **CI actions are pinned to major tags** (`actions/checkout@v4`), not commit SHAs. Pinning SHAs is
  stronger; it is a one-line hardening you can apply.
- **No SBOM or provenance until you publish** with `--provenance` (see
  [publishing.md](publishing.md)).
- **The request-size guard is best effort**: a client that omits `content-length` and streams a
  huge body still gets buffered before the post-read check rejects it. For a hard limit, put a
  proxy rule in front (`client_max_body_size` in Nginx, or a Cloudflare WAF rule).

## Before you make the URL public

- [ ] `DUMMY_API_KEY` set, and the key is not in the repo
- [ ] `DUMMY_LOG` set to `off` (or `summary`, and you accept that user text is logged)
- [ ] `DUMMY_CORS` narrowed if a browser app talks to it
- [ ] `DUMMY_HANG_MS` is 0
- [ ] a rate limit or WAF rule sits in front
- [ ] `npm audit --omit=dev` reports nothing (it should: there is nothing to audit)

## Reporting a vulnerability

Open a private security advisory on GitHub, or open an issue if the report is not sensitive. This is
a mock server with no users' data to lose, so please keep it proportional.

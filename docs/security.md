# Security notes

An honest assessment, including the parts that are not solved.

## Threat model

dummy-llm is a **stateless HTTP server that returns a canned answer**. It is not a secret store,
not a proxy to a real model, and not multi-tenant. The realistic risks are:

1. someone burning through your free quota or your VPS bandwidth;
2. someone trying to use it as a proxy or SSRF pivot;
3. you leaking your own users' prompts through logging;
4. supply-chain risk in the thing you install;
5. someone editing your personas, if you turn the admin page on with a weak key.

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
| **The admin surface is absent by default** | `/admin*` answers 404 unless `DUMMY_ADMIN_KEY` is set or Cloudflare Access is configured. `DUMMY_ADMIN_AUTH=off` is the panic switch. |
| **The admin session never carries the key** | The cookie holds `<expiry>.<HMAC-SHA256>` only, with HttpOnly, Secure, SameSite=Strict and Path=`/admin`. The key is compared in constant time and is never stored, echoed or logged. |
| **No XSS surface in the admin page** | The page is static HTML with no server-side interpolation; the client writes every value with `textContent`. The response carries a strict CSP (`default-src 'none'`), nosniff and DENY framing. A test asserts there is no `innerHTML`. |
| **No secret in any log line** | Every log line, including a `DUMMY_LOG=full` request body, goes through `src/redact.ts`: credential-shaped keys and values are replaced before they are printed, and authentication events never print the key at all. |
| **Nothing secret is storable** | The store schema has fields for personas and runtime defaults and none for an API key or an admin key. |

## What you must configure yourself

| exposure | risk | mitigation |
| --- | --- | --- |
| No API key | Anyone who finds the URL can generate traffic | Set `DUMMY_API_KEY`. It is accepted as `Authorization: Bearer`, `x-api-key`, `x-goog-api-key` or `?key=` |
| `DUMMY_LOG=summary` | The last user message ends up in Workers Logs | Set `DUMMY_LOG=off` for real traffic. `full` records entire request bodies — only use it while debugging your own client |
| Public URL | Free plan is ~100k requests/day | Add a Cloudflare **Rate Limiting** rule or WAF rule in front of the Worker |
| `DUMMY_HANG_MS` | Holds connections open on purpose | Keep it at 0 in production; it exists to test client timeouts |
| `DUMMY_CORS=*` (default) | Any web page can call the endpoint from a browser | Set `DUMMY_CORS=https://your.app` |
| `DUMMY_PLAYGROUND=1` | Any visitor can make your server answer with a template of their own, and screenshot the result | Off by default. Templates are capped at 2000 characters, answers at 100000, the page says who supplied the template, and nothing is stored |
| Echo mode | It mirrors whatever you send | Do not point it at traffic containing secrets. It stores nothing, but your client and your logs might |
| `DUMMY_ADMIN_KEY` unset | Nobody can reach `/admin` — which is the default and the recommended state unless you want the page | Set it only when you want the admin surface. Use at least 32 random bytes, and never the same value as `DUMMY_API_KEY` (the surface refuses to serve itself in that case) |
| `DUMMY_STORE` not `off` | The server is no longer stateless: the document is world-writable *to whoever holds the admin key* | Treat it as a config file, not a database. On Workers the value is eventually consistent across isolates |
| `DUMMY_ADMIN_AUTH=access` | Trusts the `Cf-Access-Jwt-Assertion` header without verifying it, so any route that reaches the Worker while bypassing Access can forge it | Use `access-jwt` unless every route to the Worker passes through the Access application |
| Admin sessions | A stolen cookie is a session until it expires | Keep `DUMMY_ADMIN_TTL` short if the page is exposed, and sign out when you are done |

## Known gaps

- **Auth is one static shared key**, compared with `===`. Constant-time comparison is not worth it
  for an ephemeral joke key, but the gap is real and documented rather than hidden.
- **No rate limiting in the application.** Use the platform (Cloudflare Rate Limiting, an Nginx
  `limit_req` zone, a Caddy plugin).
- **No per-IP quota, no audit log beyond the optional request line.** The admin page adds
  authentication events and write events to the log, but they are lines in the same stream rather than a
  durable audit trail.
- **Login throttling is best effort.** On Workers the counter lives in one isolate's memory, so it is a
  speed bump against an online guess and not a control. The admin documentation says so rather than
  implying safety.
- **`access-jwt` makes one outbound request**, to the team's own JWKS endpoint, cached for an hour. It is
  the only outbound request in the project and it is opt-in.
- **Anyone holding the admin key holds the stored configuration.** There are no accounts and no roles,
  by design; Cloudflare Access is the answer when per-person identity matters.
- **CI actions are pinned to major tags** (`actions/checkout@v4`), not commit SHAs. Pinning SHAs is
  stronger; it is a one-line hardening you can apply.
- **No SBOM or provenance until you publish** with `--provenance` (see
  [publishing.md](publishing.md)).
- **The request-size guard is best effort**: a client that omits `content-length` and streams a
  huge body still gets buffered before the post-read check rejects it. For a hard limit, put a
  proxy rule in front (`client_max_body_size` in Nginx, or a Cloudflare WAF rule).

## The admin surface, in one place

`/admin` is the only part of this server that is stateful, and it is off unless you turn it on.

- **Off by default.** No key and no Access means every `/admin*` path is a plain 404.
- **One key, or Cloudflare Access.** `DUMMY_ADMIN_AUTH` is `key` (default when a key exists),
  `access`, `access-jwt` or `off`.
- **Signed, scoped, expiring cookie.** HttpOnly, Secure, SameSite=Strict, Path=`/admin`, TTL from
  `DUMMY_ADMIN_TTL`.
- **CSRF** is covered by Strict plus an Origin / Sec-Fetch-Site check plus JSON-only writes.
- **Writes only ever touch the store.** The environment, the bindings, the routes and the secrets are
  out of reach, because the platform does not offer a way in.
- **Bounds before bytes.** A write is validated (document size, persona count, reply length) before it
  is persisted, and nothing is written partially.

The operator-facing version of this page, with the setup walkthrough, is [admin.md](admin.md).

## Before you make the URL public

- [ ] `DUMMY_API_KEY` set, and the key is not in the repo
- [ ] `DUMMY_LOG` set to `off` (or `summary`, and you accept that user text is logged)
- [ ] `DUMMY_CORS` narrowed if a browser app talks to it
- [ ] `DUMMY_HANG_MS` is 0
- [ ] `DUMMY_ADMIN_KEY` is set only if you want `/admin`, is long and random, and differs from `DUMMY_API_KEY`
- [ ] a rate limit or WAF rule sits in front
- [ ] `npm audit --omit=dev` reports nothing (it should: there is nothing to audit)

## Reporting a vulnerability

Open a private security advisory on GitHub, or open an issue if the report is not sensitive. This is
a mock server with no users' data to lose, so please keep it proportional.

# The admin page: personas, defaults, and the store

> **Status: shipped.** `/admin` exists in this repository, is covered by the test suite
> (`test/admin.test.ts`), and is **off by default**: without `DUMMY_ADMIN_KEY` or Cloudflare Access,
> every `/admin*` path answers `404` as if it were never there.

The admin page is a small, private web page that edits what this server says. It is the only part of
dummy-llm that is not stateless, and it stays absent until an operator turns it on.

## 1. What the admin edits

After v0.4.0 there is no separate "mode" and no standalone "template". The unit of configuration is the
**persona**:

```ts
interface Persona {
  reply?: Reply;        // string | string[] | Record<string, string>
  thinking?: string[];
  description?: string;
}
```

So the admin UI is a **persona editor**, and a "template" is one string somewhere inside a `reply`.
That removes most of the confusion: there is one list to manage (personas), one set of defaults
(the server's own `reply` and `thinking`), and `/v1/models` *is* that list.

| the operator edits | what changes on the wire |
| --- | --- |
| a persona's id | it appears in `/v1/models`; clients can select it |
| a persona's `reply` / `thinking` | what that model id answers with |
| the default `reply` / `thinking` | what an *unknown* model id falls through to |
| `tps` / `chunk` / `ttftMs` / `delayMs` / `maxReplyChars` / `log` / `playground` / `models` | global settings for every client, so they live in the defaults panel rather than on a persona |

The admin edits **runtime values only**. It cannot edit the deployment shape, the environment bindings
or the secrets, and that is a property of the platform rather than a decision — see section 3.

## 2. Turning it on

### 2.1 The key (works on every host)

```bash
# anywhere Docker or Node runs
DUMMY_ADMIN_KEY='a-long-random-string' npm run dev
```

```bash
# Cloudflare, where a key is a secret and not a var
npx wrangler secret put DUMMY_ADMIN_KEY
```

Then open `http://localhost:8080/admin` (or your domain) and sign in. The key is sent once, compared in
constant time, and never stored in the browser: what comes back is a signed session cookie.

Generate the key like a password, not like a password you will reuse:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`DUMMY_ADMIN_KEY` must **never** equal `DUMMY_API_KEY`. If it does, `/admin*` answers `500` with an
explanation while the rest of the server keeps working — failing loudly beats serving a page protected
by a key that every API client already knows.

### 2.2 Cloudflare Access (Cloudflare only)

If the hostname is proxied by Cloudflare, Access gives you real SSO, MFA and per-person policies with
no code at all. Set the authentication mode and the two parameters the JWT check needs:

```bash
npx wrangler secret put DUMMY_ADMIN_KEY      # optional in access mode; keep it for the panic switch
# then, in wrangler.jsonc or the dashboard:
#   DUMMY_ADMIN_AUTH = access-jwt
#   CF_ACCESS_TEAM_DOMAIN = https://<your-team>.cloudflareaccess.com
#   CF_ACCESS_AUD = <the application audience tag>
npx wrangler deploy
```

Section 6 walks through the dashboard. In Access mode the key is ignored and the login page is never
shown.

### 2.3 Turning it off

```bash
DUMMY_ADMIN_AUTH=off      # /admin* is 404 even with DUMMY_ADMIN_KEY set
```

That is the panic switch: one variable, no deploy of the rest of the configuration, and the surface is
gone. Removing `DUMMY_ADMIN_KEY` (and the Access application) has the same effect.

## 3. What the admin can and cannot change

A Worker cannot change its own environment variables. The `env` object is read-only at runtime, and no
Cloudflare interface lets a Worker rewrite its own bindings, its own routes, or its own name. Secrets
are write-only from the outside and cannot be listed or rewritten from inside the Worker either.

Therefore the sentence "let the admin page write back into the Cloudflare environment variables"
describes something that cannot be built. It is not a matter of effort or permission; the platform does
not offer it. Everything below follows from that one fact.

| layer | where it lives | who writes it | when it takes effect | can the admin edit it? |
| --- | --- | --- | --- | --- |
| deployment shape: worker name, the hostname, `workers_dev`, preview URLs, compatibility date, KV bindings | `wrangler.jsonc`, `npx wrangler deploy --domain …`, or the dashboard | the operator | on the next deploy | **no** |
| runtime baseline: reply, thinking, tps, log level, model list, and the rest | environment variables, from the `vars` block in `wrangler.jsonc` or from the dashboard | the operator | on the next deploy, or immediately when set in the dashboard | **no** |
| runtime override | the store: a KV namespace, or one JSON file on disk | **the admin page** | immediately | **yes** |
| secrets: the API key and the admin key | `wrangler secret put`, or the dashboard | the operator | when written | **no**; the admin page cannot read them either |

## 4. The store: making edits permanent

### 4.1 `off` — the default

With no store the admin page is **read-only**: it lists every persona and default, previews anything,
and refuses every write with a clear message. That is a useful mode on its own — the preview runs the
real engine, so you can iterate on a template in a browser and then put it in `wrangler.jsonc` by hand.

The server stays exactly as stateless as it was: with `DUMMY_STORE=off` the store is never read, and
the request path is byte-for-byte unchanged.

### 4.2 `kv` on Cloudflare, step by step

Declare the binding **without an id** and let Wrangler provision the namespace. This is what this
repository does, and it is the only form that belongs in a public template: a namespace id belongs to
one account, so a committed id makes everybody else's deploy fail.

```jsonc
// wrangler.jsonc
"vars": { "DUMMY_STORE": "kv" },
"kv_namespaces": [{ "binding": "DUMMY_ADMIN_KV" }]
```

```bash
npx wrangler deploy --domain your.example.com
# Experimental: The following bindings need to be provisioned:
#   env.DUMMY_ADMIN_KV   KV Namespace
# Provisioning DUMMY_ADMIN_KV (KV Namespace)...
# 🌀 Creating new KV Namespace "my-worker-dummy-admin-kv"...
# ✨ DUMMY_ADMIN_KV provisioned 🎉
```

The first deploy creates the namespace (named after the Worker and the binding); every deploy after that
reports the same binding as `(inherited)`, so nothing is duplicated and no id is ever written down.

If you would rather create and own the namespace yourself, that works too - put the id back:

```bash
npx wrangler kv namespace create DUMMY_ADMIN_KV   # prints the id
```

```jsonc
"kv_namespaces": [{ "binding": "DUMMY_ADMIN_KV", "id": "<printed id>" }]
```

Two footnotes worth knowing:

- Setting `DUMMY_STORE=kv` with **no** `DUMMY_ADMIN_KV` binding is a misconfiguration, not a silent
  downgrade: the Worker logs `DUMMY_STORE=kv but no DUMMY_ADMIN_KV binding is present` and the page stays
  read-only.
- KV is eventually consistent across the edge. The admin's own isolate sees its write immediately, and
  other isolates catch up within a few seconds. There is no way around that on Workers, and it does not
  matter for a config file.

### 4.3 `file:./data` on a server, step by step

```bash
DUMMY_STORE='file:./data' DUMMY_ADMIN_KEY='...' node dist/cli.js
# the document lives at ./data/store.json
```

```bash
# or with a colon-separated file path
DUMMY_STORE='file:/var/lib/dummy-llm/config.json' npm run dev
```

In Docker, make the directory a volume or the configuration dies with the container:

```yaml
services:
  dummy:
    image: ghcr.io/OWNER/dummy-llm:latest
    environment:
      DUMMY_STORE: "file:/data"
      DUMMY_ADMIN_KEY: "${DUMMY_ADMIN_KEY}"
    volumes:
      - dummy-config:/data
volumes:
  dummy-config:
```

Writes go to a temporary file and are renamed into place, so a reader never sees a half-written
document. The file store is Node-only: Vercel Edge and Deno Deploy have no filesystem, so their admin
page is read-only (which is the safe default anyway).

### 4.4 Precedence, and why the Cloudflare dashboard can look wrong

Every setting resolves in one order:

```
store  >  environment  >  built-in default
```

The confusing case is a setting that exists in two places at once:

1. The operator writes `DUMMY_TPS = 100` in `wrangler.jsonc` and deploys.
2. They open the admin page and set `tps` to 40. The store holds 40, and the running server uses 40.
3. The Cloudflare dashboard still displays `DUMMY_TPS = 100`, because the dashboard displays the
   binding and the binding was not changed. Nothing is broken, but it looks broken.
4. They later edit `wrangler.jsonc` and deploy. The binding becomes whatever the file says, and the
   server still uses 40, because the store takes precedence.

Three things turn that from a mystery into something a person can reason about:

- `GET /admin/api/state` returns, for every setting, the **environment** value, the **stored** override
  if one exists, and the **effective** value.
- The page renders that as a four-column table (`environment | stored | effective | value`).
- Every row has a **Reset** button that deletes just that override, so the environment value takes over
  again. "Drop the whole store" deletes the document.

The admin only ever writes fields you actually changed. Loading the page and pressing save will not
freeze the current environment values into the store.

## 5. Authentication, in detail

### 5.1 The cookie

```
GET  /admin            no cookie -> the login form
POST /admin/login      { key }   -> Set-Cookie: dummy_admin=<expiry>.<HMAC-SHA256>
POST /admin/logout               -> clears it
```

The cookie value is `<expiry>.<hmac>`, where the MAC is
`HMAC-SHA256(adminKey, "dummy-admin-v1." + expiry)` in hex. The key itself is **never** in the cookie,
the HTML, a URL, or a log line.

```
dummy_admin=<exp>.<hmac>; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```

- **HttpOnly** — JavaScript cannot read it, so an XSS bug cannot exfiltrate the session.
- **Secure** — always, with no exception. `http://localhost` is treated as a secure context by Chrome
  and Firefox, so local development works. A LAN address over plain HTTP does not: browse to
  `http://localhost:8080/admin`, not `http://192.168.1.20:8080/admin`.
- **SameSite=Strict** — a cross-site request never carries it.
- **Path=/admin** — it is not sent to `/v1/chat/completions` or anywhere else.
- **Max-Age** — `DUMMY_ADMIN_TTL` seconds, default seven days.

### 5.2 Constant-time comparison

The submitted key and the stored key are both hashed with SHA-256 and the digests are compared byte by
byte, so the comparison takes the same time whatever was submitted and a length edge case cannot leak.
Cloudflare's non-standard `crypto.subtle.timingSafeEqual` is used when the runtime provides it.

### 5.3 CSRF

Three layers, and none of them depends on the others:

1. `SameSite=Strict` on the cookie, so a cross-site request is unauthenticated by construction;
2. an `Origin` check (and `Sec-Fetch-Site: cross-site` rejection) on every write;
3. writes must be `content-type: application/json`, which a plain cross-site HTML form cannot send.

The login form is the one request that is deliberately not JSON: it accepts
`application/x-www-form-urlencoded` so that sign-in works with JavaScript disabled, and it is still
covered by the origin check.

### 5.4 XSS

The admin page is static HTML with **zero server-side interpolation**. The client fetches
`/admin/api/state` and writes every value with `textContent` or `.value`. There is no `innerHTML`
anywhere in `src/admin-ui.ts`, and a test asserts it. On top of that the response carries:

```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self';
  connect-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
```

Personas hold operator-authored *templates*, and a template can contain anything — including HTML. It
is never rendered as markup: it appears in a `<textarea>` and in the preview as text. That is the rule
to keep if you change the page.

### 5.5 The login throttle, honestly

Failed sign-ins are counted per address: eight failures inside fifteen minutes block that address for
fifteen minutes, and the block is reported as `429` with `Retry-After`.

**On Cloudflare Workers this is per-isolate memory, so it is a speed bump and not an access control.**
It makes an online guessing attempt slow and visible; it does not stop a distributed one. The real
controls are a long random key and, on Cloudflare, Access. The documentation says this rather than
implying safety.

### 5.6 What is not protected

- **Anyone holding the admin key has the whole store.** Treat it as a config file, not a database, and
  do not put a key you use anywhere else.
- **`DUMMY_LOG=full`** can be turned on from the admin page, and it records last-user-message text in
  the log. Bodies and credential-shaped values are redacted (section 10), but the message text is not a
  secret you should assume stays private.
- **The admin key is not per-user.** There is one key and no accounts. Use Cloudflare Access when you
  want per-person identities and an audit trail of who signed in.

## 6. Cloudflare Access, step by step

1. **Put the hostname behind Cloudflare.** The DNS record must be proxied (orange cloud).
2. **Zero Trust → Access → Applications → Add an application → Self-hosted.**
3. Application domain: your hostname, and the path `admin` (or `admin/*`). Access matches on path, so
   this protects the page and the API behind it.
4. **Add a policy.** "Allow", and include your email (or a domain, an IP range, a country, a group). One
   policy is enough for one operator.
5. **Copy the Application Audience (AUD) tag** from the application's overview, and note your team
   domain (`https://<team>.cloudflareaccess.com`).
6. **Set the mode.** `DUMMY_ADMIN_AUTH=access-jwt` is the one to use. `access` skips the signature
   check and trusts the edge; it is only correct when *every* way to reach the Worker passes through the
   Access application, so treat it as the lighter option rather than the safe one.
7. **Set the parameters**, then redeploy:
   `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`.
8. Open `https://your-host/admin`. Access redirects to its login, and only then does the request reach
   the Worker.

What the Worker checks in `access-jwt`:

- the header `Cf-Access-Jwt-Assertion` is present;
- the token is a JWT with `alg: RS256` and a `kid`;
- the signature verifies against the team's key set at
  `<team>/cdn-cgi/access/certs`, cached for an hour (and refreshed once when an unknown `kid` appears);
- `exp` / `nbf` are valid within a minute of clock skew;
- `iss` equals the team domain and `aud` contains `CF_ACCESS_AUD`.

**This is the first and only outbound request this project makes.** It happens at most once an hour, it
goes to your own team's domain, and it is opt-in: with `DUMMY_ADMIN_AUTH=key` or `access`, the server
still never calls anything.

Signing out redirects to the Access logout URL so the Access session ends too.

## 7. The HTTP API

Every route below needs the session cookie (or an Access identity). Writes need `content-type:
application/json` and a same-origin `Origin`.

| method | path | body | returns |
| --- | --- | --- | --- |
| GET | `/admin` | — | the page, or the login form |
| POST | `/admin/login` | `{ key }` or a form | sets the cookie, `303` to `/admin` |
| POST | `/admin/logout` | — | clears the cookie |
| GET | `/admin/app.js`, `/admin/app.css` | — | the static assets |
| GET | `/admin/api/state` | — | `{ auth, defaults, personas, models, packs }` with the environment / stored / effective triple |
| POST | `/admin/api/preview` | `{ input, model?, patch? }` | **an SSE stream from the real engine** |
| PUT | `/admin/api/personas/{id}` | a `Persona` | saves (and un-tombstones) a persona |
| DELETE | `/admin/api/personas/{id}` | — | tombstones a persona |
| PUT | `/admin/api/defaults` | a partial `StoreDefaults` | merges the fields you changed |
| DELETE | `/admin/api/defaults/{key}` | — | drops one override |
| GET | `/admin/api/packs` | — | the curated index |
| POST | `/admin/api/import` | `{ pack, apply? }` | a diff, and applies it when `apply` is true |
| POST | `/admin/api/export` | `{ source? }` | a pack JSON (`store`, or `effective`) |
| POST | `/admin/api/reset` | — | drops the whole stored document |

A shell session looks like this:

```bash
BASE=https://your-host
JAR=$(mktemp)

# sign in (the cookie is HttpOnly, so curl keeps it in the jar)
curl -s -c "$JAR" -H 'content-type: application/json' \
  -d '{"key":"'"$DUMMY_ADMIN_KEY"'"}' "$BASE/admin/login"

# what is set, where it came from, and what is winning
curl -s -b "$JAR" "$BASE/admin/api/state" | head -40

# preview a template with the real engine (streamed, byte-identical to a client)
curl -sN -b "$JAR" -H 'content-type: application/json' \
  -d '{"input":"hello","model":"dummy-echo-1","patch":{"reply":"{input|ascii}"}}' \
  "$BASE/admin/api/preview"

# add a persona
curl -s -b "$JAR" -X PUT -H 'content-type: application/json' \
  -d '{"reply":["yes","no","maybe"],"thinking":["The user said \"{input}\"."]}' \
  "$BASE/admin/api/personas/dummy-maybe-1"

# change one global default, then put it back
curl -s -b "$JAR" -X PUT -H 'content-type: application/json' -d '{"tps":40}' "$BASE/admin/api/defaults"
curl -s -b "$JAR" -X DELETE "$BASE/admin/api/defaults/tps"
```

### Why the preview matters

`POST /admin/api/preview` does not re-implement the engine. It patches the effective configuration,
synthesises a real chat request and hands it to the same OpenAI protocol module that serves
`/v1/chat/completions`. A test asserts that the preview is **byte-identical** to the client request
with the same configuration. If you ever find yourself writing a JavaScript version of the engine in
the page, stop: that is the bug this design exists to prevent.

## 8. The page

One page, vanilla JavaScript, same origin, no build step. It speaks **English or Chinese**, switched
from the top bar: `?lang=` wins, then a cookie, then Accept-Language, then English (see
`src/i18n.ts`). The client script reads the strings the server embedded, so a language change is one
implementation rather than two.

Loading is a state, not a blank page: the page says it is loading, and a failure shows the message, the
HTTP status and a **Retry** button. (Before that, a state request that had not landed yet looked exactly
like a server with no personas.)

- **Personas** on the left, with a tag saying where each one comes from (`builtin`, `env`, `store`,
  or `deleted`). The built-in personas are listed like any other and can be edited or deleted: editing
  writes an override into the store, deleting writes a tombstone, and the environment copy is untouched.
- **The editor** in the middle, with a shape-aware reply box: *one template*, *a pool* (one entry per
  line) or *a keyword map* (`key = template` per line, `*` for the fallback). The shape is the
  behaviour, so the editor shows the shape instead of teaching a mode.
- **Defaults** as a table of environment / stored / effective, with a Reset button per row.
- **Live preview**: type a message, pick who answers, watch the thinking and the answer stream in.
- **Packs**: fetch one from the gallery or paste a URL or the JSON itself, look at the diff, apply it,
  or export the current store as a pack.

Every value is written with `textContent`, and the reply-shape conversion is a handful of lines, so
there is no client-side engine and no markup injection.

## 9. Packs

A pack is a small JSON document:

```json
{
  "name": "shout",
  "description": "Screams your message back inside a box.",
  "personas": {
    "dummy-shout-1": { "reply": "{input|upper|box}", "thinking": ["They said \"{input}\"."] }
  },
  "defaults": { "tps": 60 }
}
```

- A persona whose value is `null` is a **tombstone**: importing that pack removes the persona.
- Importing is a **merge**: existing personas keep the fields the pack does not mention.
- `POST /admin/api/import` with `apply: false` returns the diff without writing anything. That is what
  the page shows before you press Apply.

**The browser fetches, the server never does.** `raw.githubusercontent.com` and gist both send
`access-control-allow-origin: *`, so the page can pull a pack, show it, and post the JSON back. That
keeps "no outbound requests" true for the server, which is worth more than the convenience of fetching
it server-side.

Three built-in examples live in [packs/](../packs): `shout`, `mirror` and `shrug`. The loop that makes
contributed packs possible: install one, tweak it in the page, **Export**, open a pull request.

## 10. Logging and redaction

Admin events are logged as one JSON line each:

```json
{"dummy":"admin","event":"login_ok","ip":"203.0.113.7"}
{"dummy":"admin","event":"login_failed","ip":"203.0.113.7","path":"/admin/login"}
{"dummy":"admin","event":"persona_saved","id":"dummy-maybe-1","has":["reply","thinking"]}
```

- **Authentication events always log**, even with `DUMMY_LOG=off`. A security event you cannot see is
  not a security event. Everything else follows the configured log level.
- **No secret is ever logged.** Every log line goes through `src/redact.ts`: keys named like
  credentials become `[redacted]`, and credential-shaped strings (`sk-…`, `Bearer …`, `AIza…`,
  `ghp_…`, AWS key ids) are masked in free text. `DUMMY_LOG=full` redacts the request body before it
  is printed. A test captures the log and asserts that a key never appears.
- The login key, the admin key, the API key and the session cookie are never logged at all, at any log
  level.

Read them locally, or live from the Worker:

```bash
npx wrangler tail dummy-llm
```

## 11. Limits

| thing | limit | why |
| --- | --- | --- |
| stored document | 512 KB | it is a config file, not a database |
| personas | 200 | the same |
| thinking templates per persona | 50 | the same |
| one reply string | 100,000 characters | a runaway `{input|repeat:100000}` should not hang a tab |
| preview input | 4,000 characters | the preview is a demonstration |
| admin request body | `DUMMY_MAX_BODY` (1 MB) | the same guard the API uses |

Anything over a structural limit is refused with a message naming the limit; nothing is written
partially.

## 12. Troubleshooting

| symptom | cause | fix |
| --- | --- | --- |
| `/admin` is 404 | no `DUMMY_ADMIN_KEY` and no Access, or `DUMMY_ADMIN_AUTH=off` | set the key (and redeploy), or remove the `off` |
| `/admin` is 500 with "identical to `DUMMY_API_KEY`" | the two secrets are the same string | use a different admin key |
| `/admin` is 500 with "needs both CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD" | `access-jwt` is on and a parameter is missing | set both, or use `access` |
| 403 and the Access page | the request reached the Worker without an Access identity | sign in through the Access application; or you are on a route that bypasses Access, in which case use `access-jwt` |
| Signed in, but every save says "read-only" | there is no store | set `DUMMY_STORE=kv` (plus the binding) or `file:<path>` |
| `DUMMY_STORE=kv` and the page is still read-only | the `DUMMY_ADMIN_KV` binding is missing | `npx wrangler kv namespace create DUMMY_ADMIN_KV`, add the binding, redeploy (there is a log line saying exactly this) |
| The login form says the key is wrong but it is not | the cookie is not being stored | you are on plain HTTP on a non-localhost address; browse to `http://localhost` or put TLS in front |
| A change works for one request and then reverts | the store is on but the request hit another isolate | wait a few seconds; KV is eventually consistent |
| I edited `wrangler.jsonc` and the server ignored it | the store takes precedence | look at the **stored** column, press Reset on that row |
| The stored persona is not in `/v1/models` | `models` is an explicit list that does not include it | add it to the `models` default, or reset `models` |

## 13. Security summary

- `/admin*` does not exist (404) unless an operator turns it on.
- The key never appears in a cookie, a page, a URL, or a log.
- Session cookies are signed, HttpOnly, Secure, SameSite=Strict, scoped to `/admin`, and expire.
- Comparisons are constant-time.
- CSRF is covered three ways; XSS has no interpolation surface and a strict CSP.
- Login throttling is a per-isolate speed bump and is documented as such.
- Every write is same-origin JSON, goes through the store, and is bounds-checked before it lands.
- No secret is storable: the document schema has no field for an API key or an admin key.
- `docs/security.md` carries the same list in the project's threat model.

## 14. What was deliberately not built

| idea | why not |
| --- | --- |
| a "copy for `wrangler.jsonc`" button | it duplicates the environment table and the store's job; the state API already shows the environment value |
| per-user accounts | one operator, one key. Use Cloudflare Access when you want identities |
| a "the environment changed since your override" drift warning | it needs a snapshot per override, and the four-column table already shows both values |
| server-side pack fetching | the browser can fetch, and the server keeping zero outbound requests is worth more |
| a JavaScript re-implementation of the engine for the preview | the preview runs the real engine, byte for byte |
| a full web UI for the public landing page | it is a terminal joke with one box; the admin page is the one place a UI earns its keep |

## 15. Where the design came from

`/admin` grew out of a longer design note that argued through the alternatives: a built-in key versus
Cloudflare Access, why the store is the only writable layer, why the playground and the admin are two
surfaces of one editor, and what the public `?t=` link costs. Those arguments are settled; the ones
that still matter are kept in the sections above, and the public playground is documented in the
[README](../README.md#a-shareable-link).

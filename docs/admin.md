# Admin UI: persona editing and pack import

> **Status: plan. Nothing here is implemented.** This file is the design of record; it gets rewritten
> into user docs once P1 ships.

## 1. What the admin actually edits

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
That reframing removes most of the confusion: there is one list to manage (personas), one default
(the server's own `reply` / `thinking`), and `/v1/models` *is* that list.

| the operator edits | what changes on the wire |
| --- | --- |
| a persona's id | it appears in `/v1/models`; clients can select it |
| a persona's `reply` / `thinking` | what that model id answers with |
| the default `reply` / `thinking` | what an *unknown* model id falls through to |
| `tps` / `chunk` / `ttft` | pacing for everyone (global, not per persona) |

Deliberately **not** editable in v1: fault injection, logging, auth. Those are deployment concerns, not
content, and they stay environment-only.

## 2. Three surfaces, one codebase

```
/            public landing page + a live demo     always on
/play        the same editor, public              off unless DUMMY_PLAYGROUND=1
/admin       private: persona CRUD + pack import  off unless DUMMY_ADMIN_KEY (or Access) is set
/admin/api/* the JSON API behind it               same gate
```

`/play` and `/admin` are **the same editor component**. They differ in exactly two ways: whether a
request is authenticated, and whether edits are persisted. Building them twice would be the mistake
this plan exists to avoid.

Everything in the admin is a person's own deployment configuration, so the default for both is
**absent**: no admin route exists until an operator turns it on.

## 3. Auth

### 3.1 The requirement

It has to work on the VPS, in Docker, on Vercel, on Deno Deploy **and** on Cloudflare Workers, because
that is where this project runs. It has to be off by default. It must not need a database.

### 3.2 Option A — built-in key + signed cookie (the portable default)

```
GET  /admin            no cookie   -> an HTML login form (same origin, no JS needed)
POST /admin/login      { key }     -> Set-Cookie: dummy_admin=<exp>.<hmac>; HttpOnly; Secure;
                                      SameSite=Strict; Path=/admin; Max-Age=7d
POST /admin/api/*      cookie      -> verify HMAC + expiry, then serve
POST /admin/logout                 -> clear the cookie
```

Implementation notes that matter:

- The cookie carries `<expiry>.<HMAC-SHA256(adminKey, "dummy-admin-v1" + expiry)>` — never the key itself.
- Compare the submitted key with a **constant-time** byte compare (WebCrypto has no `timingSafeEqual`, so
  write the 15-line loop).
- `SameSite=Strict` plus an `Origin` check plus requiring `content-type: application/json` on writes covers CSRF.
- Best-effort login throttling: an in-memory counter of failures per IP. On Workers each isolate has its
  own memory, so this is a speed bump, not a control — say so in the docs rather than implying safety.
- `DUMMY_ADMIN_KEY` unset -> `/admin*` returns **404**. The surface does not exist.

### 3.3 Option B — Cloudflare Access (recommended *when* you are on Cloudflare)

Access is an identity-aware proxy sitting in front of the Worker: no valid `CF_Authorization` cookie ->
302 to `<team>.cloudflareaccess.com` -> authenticate (email OTP, Google, GitHub, SAML) -> a short-lived
JWT cookie -> only then does the request reach your Worker.

- **Zero code**, real SSO, MFA, policies by email / domain / IP / country. Free for up to 50 users.
- The Worker can trust the edge (`DUMMY_ADMIN_AUTH=access`, checking that `Cf-Access-Jwt-Assertion` is
  present) or verify the JWT properly against the team certs (`access-jwt`, ~40 lines of WebCrypto plus a
  cached JWKS fetch — which would be the first outbound request the server ever makes, so it is opt-in).
- **Requirement:** the hostname must be proxied by Cloudflare.
- It is not an application login system for *your* users; it is for gating *your* apps to *your* people.
  For an admin page that is exactly right.

### 3.4 What about Vercel, Deno, a VPS?

Vercel's password protection is a **paid** feature, so it cannot be the answer on Hobby. Cloudflare
Access in front of a Vercel deployment is possible (Cloudflare Tunnel) but heavy. Therefore:

> **Option A ships as the default and must work everywhere. Option B is a documented upgrade for
> Cloudflare users, costing zero lines of code.**

One knob, explicit precedence:

```
DUMMY_ADMIN_KEY unset, no Access        -> 404, no admin surface
DUMMY_ADMIN_KEY set                     -> key mode (the default whenever a key exists)
DUMMY_ADMIN_AUTH=access                 -> trust Cf-Access-Jwt-Assertion; the key is ignored
DUMMY_ADMIN_AUTH=off                    -> 404 even if a key is set (panic switch)
```

## 4. Storage

The server is stateless today and that is a documented security property, so persistence is opt-in and
declared explicitly.

| `DUMMY_STORE` | where | notes |
| --- | --- | --- |
| `off` *(default)* | nowhere | admin is **read-only**: it can preview and copy config, not save it |
| `kv` | an `ADMIN_KV` namespace | Cloudflare; declared without an id it is auto-provisioned by the deploy button |
| `file:./data` | one JSON file | Node / VPS / Docker (needs a volume) |
| `d1` | an `ADMIN_DB` database | later, if the blob ever outgrows KV |

Shape: **one key, one document** — `config = { version: 1, personas: {...}, defaults: {...} }`. Atomic
writes, no half-saved persona, and the whole thing is a handful of KB. Never one key per persona.

**Precedence: store over env over built-ins.** The env keeps working as the initial seed, and the UI labels
each persona `inherited` (from env) or `overridden` (in the store), with a **Reset to env** action that
drops the stored document. That is what stops "why did my env var stop working" becoming a support thread.

## 5. API

| method | path | body | returns |
| --- | --- | --- | --- |
| GET | `/admin` | — | the UI |
| POST | `/admin/login` | `{ key }` | sets the cookie |
| POST | `/admin/logout` | — | clears it |
| GET | `/admin/api/state` | — | `{ auth, store, defaults, personas: [{ id, source, persona }], models }` |
| PUT | `/admin/api/personas/:id` | a `Persona` | the saved persona |
| DELETE | `/admin/api/personas/:id` | — | `{ deleted: true }` |
| PUT | `/admin/api/defaults` | `{ reply, thinking, tps, chunk }` | the saved defaults |
| POST | `/admin/api/preview` | `{ reply, thinking, input, model? }` | **an SSE stream**, exactly as a client would see it |
| GET | `/admin/api/packs` | — | the curated index |
| POST | `/admin/api/import` | `{ pack }` | a **diff** of what would change |
| POST | `/admin/api/export` | — | a pack JSON |
| POST | `/admin/api/reset` | — | drops the stored document |

`/admin/api/preview` is the important one: it builds a transient config from the posted values and runs
the **real engine**, so the preview is byte-identical to what a client would receive. No client-side
re-implementation of the engine, ever.

That transient-config mechanism is shared with the public playground, which is why §2 insists on one
editor: both surfaces need "run the server with this config override, just for this request".

## 6. Import and export

**The rule: the browser fetches, the server never does.** `raw.githubusercontent.com` and gist both send
`access-control-allow-origin: *`, so the UI can pull a pack, show it, and POST the JSON back. That keeps
"zero outbound requests" true for the server — a property worth more than the convenience of fetching
server-side.

| tier | how | who maintains it |
| --- | --- | --- |
| 1 | paste a URL (gist, raw GitHub, any JSON) | whoever wrote the pack |
| 2 | a gallery in the UI, listing `packs/index.json` from this repository | us — a handful of curated packs |
| 3 | a separate `dummy-packs` repository taking pull requests | the community |

And the loop that makes tier 3 possible: **install → tweak in the UI → Export → open a PR.** The export
button is the contribution funnel, which is why it is in P3 rather than P4.

A pack is a small JSON document:

```json
{
  "name": "rickroll",
  "description": "Never gonna give you up.",
  "personas": {
    "dummy-rickroll-1": { "reply": "Never gonna give you up." }
  },
  "defaults": { "reply": "{input}" }
}
```

## 7. The UI

One page, vanilla JS, same origin, no build step — the landing page already proves that this is enough.

```
┌ personas ────────┬  persona ─────────────────────────────┐
│ dummy-echo-1  ●  │ id      [dummy-ascii-1            ]   │
│ definitely-not-… │ reply   ( ) one  (•) pool  ( ) keys   │
│ dummy-ascii-1    │         ┌───────────────────────────┐ │
│ + New            │         │ {input|ascii}             │ │
│                  │         └───────────────────────────┘ │
│ Import / Export  │ thinking (one per line)               │
│ [paste a URL]    │ ┌───────────────────────────────────┐ │
│ ┌──────────────┐ │ │ The user wrote "{input}" ...      │ │
│ │ rickroll     │ │ └───────────────────────────────────┘ │
│ │ haiku-only   │ │ ── live preview ────────────────────  │
│ │ adversarial  │ │ ❯ hello                               │
│ └──────────────┘ │   thinking … .#.  ###                 │
└──────────────────┴───────────────────────────────────────┘
   [ Save ]  [ Copy as env var ]  [ Export ]
```

The **shape-aware reply editor** (one / pool / keys) is the UX payoff of v0.4.0: instead of teaching a
"mode" dropdown, the editor shows the shape. The **Copy as env var** button renders the equivalent
`DUMMY_REPLY` / `DUMMY_PERSONAS` line, so an operator can leave the UI and go back to plain config at
any time. That escape hatch is what makes it safe to build the UI at all.

## 8. Phasing

| phase | scope | size | ships when |
| --- | --- | --- | --- |
| **P1** | `/admin` behind the key, read-only: list personas and defaults, live preview, copy-as-env. **No store.** | ~250 lines | it is useful even with zero persistence — you can iterate on templates in a browser and paste the result into `wrangler.jsonc` |
| **P2** | store (`kv` / `file`) + persona CRUD + defaults + reset-to-env | ~280 lines | the operator wants to change behaviour without a redeploy |
| **P3** | import by URL, the gallery, export-as-pack, the diff view | ~150 lines | there is more than one pack worth importing |
| **P4** | `DUMMY_ADMIN_AUTH=access`, and `access-jwt` if we want signature verification | ~50 lines | a Cloudflare user asks for SSO |

Each phase is independently shippable and independently testable. P1 is the one that proves the concept.

## 9. Security deltas

Everything here must land in [security.md](security.md) in the same PR that implements it.

- **New surface** `/admin`, absent (404) by default; enabled only by a key or by Access.
- **New state** when `DUMMY_STORE` is not `off`: the server is no longer stateless, and the store
  document is world-writable *to whoever holds the admin key*. Treat it as a config file, not a database.
- **A second secret.** `DUMMY_ADMIN_KEY` must never equal `DUMMY_API_KEY`; the UI should refuse to start
  if they are the same.
- **The cookie** is HttpOnly, Secure, SameSite=Strict, scoped to `/admin`, and signed with a derived key.
- **CSRF** is covered by Strict + Origin check + JSON-only writes; state it explicitly anyway.
- **Login throttling** is best effort on Workers (per-isolate memory). Do not advertise it as a control.
- **The public playground** (`DUMMY_PLAYGROUND=1`) lets any visitor override the reply *for their own
  request*. It changes nothing persistent, but it is off by default and the docs say why.
- **No secrets in the store**: personas and defaults only. Never write API keys into KV.

## 10. Open decisions

1. **Do we ship the public playground at all?** It is the growth loop (shareable `?t=` links) but it lets
   visitors change responses. Harmless on a joke server, off by default.
2. **Should `DUMMY_STORE` default to `off` or `file` on Node?** `off` is honest; `file` is more
   useful. I lean `off` and let the docs show the one-line enable.
3. **Does the admin edit pacing (`tps`/`chunk`) or only content?** Editing pacing is global, not per
   persona, which is a different kind of change and might deserve its own panel or none at all.
4. **Single shared key, or per-user accounts?** Recommendation: shared key. This is a personal deployment,
   not a product.
5. **Same bundle or a separate package?** Same bundle (~+15 KB on a Worker that is currently ~69 KB), so the
   deploy button keeps giving you everything in one step.

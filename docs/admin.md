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
| `tps` / `chunk` / `ttft` | pacing for everyone, so it is a *global* setting and belongs in a defaults panel rather than on a persona |

The admin page edits runtime values only. It cannot edit the deployment shape, the environment bindings or
the secrets, and that is a property of the platform rather than a decision — see section 4.1.

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

## 4. Storage, and the two sources of truth

### 4.1 The boundary is not a design choice

A Worker cannot change its own environment variables. The `env` object is read-only at runtime, and no
Cloudflare interface lets a Worker rewrite its own bindings, its own routes, or its own name. Secrets are
write-only from the outside and cannot be listed or rewritten from inside the Worker either.

Therefore the sentence "let the admin page write back into the Cloudflare environment variables" describes
something that cannot be built. It is not a matter of effort or permission; the platform does not offer it.
Everything below follows from that one fact.

### 4.2 What each layer is for

| layer | where it lives | who writes it | when it takes effect | can the admin edit it? |
| --- | --- | --- | --- | --- |
| deployment shape: worker name, routes, `workers_dev`, preview URLs, compatibility date, KV and D1 bindings | `wrangler.jsonc` | the operator, by running `wrangler deploy` | on the next deploy | **no** |
| runtime baseline: reply, thinking, tps, chunk, ttft, log level, model list, and the rest | environment variables, coming from the `vars` block in `wrangler.jsonc` or from the Cloudflare dashboard | the operator | on the next deploy, or immediately when set in the dashboard | **no** |
| runtime override | the store: a KV namespace, or one JSON file on disk | **the admin page** | immediately | **yes** |
| secrets: the API key and the admin key | `wrangler secret put`, or the dashboard | the operator | when written | **no**; the admin page cannot read them either |

The admin page therefore edits exactly one layer, and it is the only layer a running server can write.

### 4.3 The rule: store over environment over built-in

A running server resolves every setting in that order. The environment block keeps working exactly as it
does today, and the store is an overlay that the operator turns on by setting `DUMMY_STORE`.

| `DUMMY_STORE` | where the overlay lives | notes |
| --- | --- | --- |
| `off` — the default | nowhere | the admin page is **read-only**: it can preview and copy configuration, but it cannot save |
| `kv` | a KV namespace bound as `ADMIN_KV` | on Cloudflare; declared without an id, the Deploy to Cloudflare button creates it automatically |
| `file:./data` | one JSON file | on a VPS or in Docker, where the file is a mounted volume |

The document is a single key holding a single object, ```{ version, personas, defaults }```, not one key per
persona. That keeps every write atomic, and the whole document is a few kilobytes.

### 4.4 Why the Cloudflare dashboard can then look wrong

The confusing case is a setting that exists in two places at once:

1. The operator writes `DUMMY_TPS = 100` in `wrangler.jsonc` and deploys.
2. They open the admin page and set tps to 40. The store now holds 40, and the running server uses 40.
3. The Cloudflare dashboard still displays `DUMMY_TPS = 100`, because the dashboard displays the binding,
   and the binding was not changed. Nothing is broken, but it looks broken.
4. They later edit `wrangler.jsonc` and deploy. The binding becomes whatever the file says, and the server
   still uses 40, because the store takes precedence.

Four things turn that from a mystery into something a person can reason about:

- `/admin/api/state` returns, for every setting, the environment value, the stored override if one
  exists, and the effective value.
- The admin page renders that as "environment 100, overridden to 40" with a **Reset to environment** button
  on each row.
- Every override is stored together with a `basedOn` snapshot of the environment value at the moment the
  override was created, so the page can also report "the environment changed from 100 to 200 after you set
  this override".
- A **Copy for wrangler.jsonc** button produces the exact lines that reproduce the current effective state.
  Making a change permanent is then mechanical: paste, deploy, reset the override.

### 4.5 What is true on the Cloudflare side, for the record

- Cloudflare's own Wrangler configuration page states: "If you change your environment variables in the
  Cloudflare dashboard, Wrangler will override them the next time you deploy." For every variable that
  appears in `wrangler.jsonc`, the file is the source of truth.
- A variable that does not appear in `wrangler.jsonc` may survive a deploy, but that behaviour has changed
  between Wrangler versions, so it should not be relied on.
- Practical consequence: nothing the admin page writes can ever appear in the Cloudflare dashboard, because
  the admin page writes to the store and the dashboard displays bindings. The place to make a change
  permanent is `wrangler.jsonc`, which is what the copy button is for.


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

## 10. Decisions

| # | question | decision |
| --- | --- | --- |
| 1 | Ship the public playground? | **open** — the full explanation of what it would do and what could go wrong is section 11 |
| 2 | `DUMMY_STORE` default | **`off`** — the server stays stateless unless an operator opts in |
| 3 | Does the admin edit global settings too? | **yes**, using the two-source-of-truth model in section 4. Every runtime value takes the same edit path; pacing is global, so it lives in a defaults panel rather than on a persona |
| 4 | Single key, or per-person accounts? | **single shared key** |
| 5 | Same package, or a separate one? | **same package**, so the deploy button keeps delivering everything in one step |

## 11. The public playground, explained in full (open decision)

This section exists so that the decision can be made by reading one page instead of reconstructing an
argument from a conversation.

### 11.1 What exists today

The server answers requests at several addresses. One of them is the root address, `/`. A browser that
opens that address receives a small web page. The page contains a text box, a button labelled Send, and an
area below them where text appears.

When a person types something into the box and presses Send, the page sends a real chat request to the same
server, to the same endpoint that any program would use. The answer comes back as a stream, and the page
prints the answer as it arrives.

What the server answers with is whatever the operator configured. A visitor chooses the message. A visitor
does not choose the answer.

### 11.2 What the proposal would add

The proposal adds a second text box to that page, above the first one. The second box holds the template
that decides the answer.

A person could type `{input|upper}` into the second box, press Send, and watch the server answer in
capital letters. The operator would not need to change anything, restart anything, or deploy anything.

The second box is filled in when the page loads, from a value carried in the page address. After a person
edits the box, the page rewrites its own address so that the address contains the current template. Copying
that address and sending it to another person produces a link that opens the page with the same template
already in the box.

### 11.3 Why this is worth considering

Without the link, explaining this project requires asking a person to install something, or to read a page
of configuration, or to trust a description. With the link, a person opens a page and sees the behaviour in
two seconds.

The specific thing that becomes possible is a sentence such as "open this and type anything":

```
https://dummy.example.com/?t=%7Binput%7Cascii%7D
```

The part after the question mark is the template `{input|ascii}`, encoded so that it can travel inside an
address. Whoever opens that address sees the template already present and can press Send immediately.

This is the only mechanism in the project that turns the server into something a non-programmer can
experience. Everything else requires a terminal.

### 11.4 What could go wrong, and how each problem is handled

**A visitor can make the server produce text that the operator did not choose, and can then take a
screenshot of it.** The text appears under the operator's own domain, so the screenshot is attributable to
the operator even though a visitor chose the words. On a project that is openly a fake language model the
realistic harm is small, but it is not zero. Two mitigations, neither of which removes the problem:

- the page states, next to the answer, that the template was supplied by the visitor;
- the feature is absent unless the operator sets `DUMMY_PLAYGROUND=1`, so a deployment that does not want
  the behaviour never has it.

**A visitor can make the server emit a very large answer.** The reply currently has no upper bound. A
template such as `{input|repeat:100000}` would ask the server to stream an enormous response, and the
message the caller sends can itself be large. Two limits address this: the template accepted from a request
is limited to 2000 characters, and the rendered reply is limited to 100000 characters, with streaming
stopping when the limit is reached. Both limits apply only to the per-request override; the operator's own
configured template is not limited, because the operator is not an adversary towards their own server.

**A crafted template could inject markup into the page.** This is already handled by a rule the current page
follows: every value that came from the server is written into the page as text rather than as markup. The
template box must follow the same rule. The rule is recorded here because a later change could break it
silently.

**An optional feature is one more thing that can be misconfigured.** The feature is absent unless it is
turned on, and the environment table in the README will say so.

### 11.5 The smaller versions of the same idea

Three options, in increasing order of exposure:

| option | what a visitor can do | what is lost |
| --- | --- | --- |
| do not build it | read a fixed demonstration | the shareable link, and with it the only path into the project that does not require a terminal |
| build the link, leave the box read-only | open a link and press Send; can still edit the address by hand | almost nothing for an honest visitor, because the address can always be edited by hand; the box becomes a display rather than an editor |
| build the link and the editable box | as above, and can author new templates without touching the address | the operator can no longer say that every answer this page shows was chosen by them |

The middle option deserves serious consideration. It keeps nearly all of the demonstration value, because
the link is the thing people share, and it removes the sentence "a visitor made my server say that". A
person who edits an address on purpose is acting deliberately, which is a different situation from a page
that invites them to.

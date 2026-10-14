# Deployment

> ⚠️ **Verify the quota numbers.** They are written from memory and every platform changes
> them regularly. Check the links in each section before you publish a claim. The
> architecture advice below does not depend on the exact numbers.

## Already configured in this repository

Everything below is implemented; you only have to pick a host.

| File | Host |
| --- | --- |
| [wrangler.jsonc](../wrangler.jsonc) + [src/adapters/worker.ts](../src/adapters/worker.ts) | Cloudflare Workers (the README button uses these) |
| [Dockerfile](../Dockerfile) + [docker-compose.yml](../docker-compose.yml) + [deploy/Caddyfile](../deploy/Caddyfile) | VPS with automatic HTTPS |
| [deploy/nginx.conf](../deploy/nginx.conf) | VPS behind Nginx (note `proxy_buffering off`) |
| [vercel.json](../vercel.json) + [api/index.ts](../api/index.ts) | Vercel Edge |
| [src/adapters/deno.ts](../src/adapters/deno.ts) | Deno Deploy |

```bash
npx wrangler deploy --domain your.example.com   # Cloudflare (this repo commits no hostname)
docker compose up -d       # VPS (edit DUMMY_DOMAIN in .env first)
vercel deploy              # Vercel
```

### One-click buttons

| button | what it provisions | what it needs |
| --- | --- | --- |
| **Deploy to Cloudflare** | the Worker, its `vars`, and any `kv_namespaces` / `d1_databases` declared **without an id** (Cloudflare provisions them and binds them automatically) | a Cloudflare account |
| **Deploy with Vercel** | an edge function plus the catch-all rewrite | a Vercel account |
| **Run on Google Cloud** | a Cloud Run service built from the Dockerfile | a GCP account **with billing enabled** |

### The private admin page (optional, off by default)

`/admin` does not exist until you turn it on. Two ways, and they compose:

```bash
# a) the key: works on every host
npx wrangler secret put DUMMY_ADMIN_KEY       # a long random string, never the same as DUMMY_API_KEY

# b) Cloudflare Access: real SSO, no code
#    Zero Trust -> Access -> Applications -> Add -> Self-hosted, path /admin, policy = your email
#    then set DUMMY_ADMIN_AUTH=access-jwt plus CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD
```

Access is **not** provisioned by a deploy button — it is account-level Zero Trust configuration, not a
Worker resource. The dashboard walkthrough, the two Access modes and the difference between them are in
[admin.md](admin.md#6-cloudflare-access-step-by-step).

The page is **read-only** until a store is configured. On Workers that is a KV namespace:

```jsonc
// wrangler.jsonc - no namespace id in the file, on purpose
"vars": { "DUMMY_STORE": "kv" },
"kv_namespaces": [{ "binding": "DUMMY_ADMIN_KV" }]
```

```bash
npx wrangler deploy        # provisions the namespace on the first deploy, inherits it afterwards
```

A namespace id belongs to one account, so committing one would make every other clone fail to deploy.
Declaring the binding without an id means each operator provisions their own. To create and own it
yourself instead, run `npx wrangler kv namespace create DUMMY_ADMIN_KV` and add the id back. Every step,
including what to do when the page still says read-only, is in
[admin.md](admin.md#4-the-store-making-edits-permanent).

## Which target should you pick?

| Target | Free tier? | Streaming (SSE) | Cold start | Real limitation | Verdict |
| --- | --- | --- | --- | --- | --- |
| **Your VPS** (Docker + Caddy) | you already pay it | unlimited, minutes-long | none | you maintain it | the "real" home |
| **Cloudflare Workers** | ✅ 100k req/day | ✅ native | none | free CPU budget per request | best free demo |
| **Vercel Hobby** | ✅ non-commercial | ✅ | ~0 | function max duration; Hobby is non-commercial | good if you live on Vercel |
| **Deno Deploy** | ✅ | ✅ | none | monthly request quota | clean 5-line deploy |
| **Google Cloud Run** | ✅ scale-to-zero | ✅ | ~1s | needs a billing account | containers for free-ish |
| **Render free** | ✅ | ✅ | ~30-50s after 15 min idle | sleeps | demos only |
| **Hugging Face Spaces** | ✅ Docker | ✅ | sleeps after ~48h idle | public, sleeps | fun, on-brand |
| **Netlify Functions** | ✅ | ✅ | none | invocation quota | fine |
| **Railway / Fly.io** | ❌ effectively | ✅ | — | no real free tier left | pay |
| **GitHub Pages / any static host** | — | ❌ | — | cannot run a server | impossible |

**Recommendation.** Run the Docker image on your VPS as the canonical instance
(`llm.yourdomain.com`), and deploy the same handler to Cloudflare Workers as the free
public demo. The entire reason to architect around Web `Request`/`Response` is that these
two are the *same code*.

## 1. VPS — Docker + Caddy (recommended)

Why it wins for this project: nothing enforces a wall-clock ceiling, so a
`DUMMY_DELAY_MS` of 200 with a long paragraph still completes, and there is no cold start.

### Dockerfile (multi-stage, non-root)

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
USER node
EXPOSE 8080
HEALTHCHECK CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["node", "--enable-source-maps", "dist/adapters/node.js"]
```

### docker-compose.yml (app + automatic HTTPS)

```yaml
services:
  dummy:
    image: ghcr.io/OWNER/dummy-llm:latest
    restart: unless-stopped
    environment:
      DUMMY_TEXT: "6"
      DUMMY_DELAY_MS: "20"
    expose: ["8080"]

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./deploy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
volumes:
  caddy_data:
```

```
llm.example.com {
	reverse_proxy dummy:8080
}
```

Caddy handles TLS automatically and, unlike Nginx, flushes SSE frames immediately without
extra configuration.

If you want the writable admin page on the VPS, mount the directory that holds the store document, or it
dies with the container:

```yaml
services:
  dummy:
    environment:
      DUMMY_STORE: "file:/data"
      DUMMY_ADMIN_KEY: "${DUMMY_ADMIN_KEY}"
    volumes:
      - dummy-config:/data
volumes:
  dummy-config:
```

The document is one JSON file at `/data/store.json`, written to a temporary file and renamed into place.
See [admin.md](admin.md#43-filedata-on-a-server-step-by-step).

### Nginx instead of Caddy — the one stanza that matters

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_buffering off;          # <- without this, SSE arrives in one lump
    proxy_cache off;
    proxy_read_timeout 3600s;
    chunked_transfer_encoding on;
}
```

(Also send `X-Accel-Buffering: no` from the app; dummy-llm does this by default.)

### No Docker: systemd

```ini
[Unit]
Description=dummy-llm
After=network.target

[Service]
WorkingDirectory=/opt/dummy-llm
EnvironmentFile=/opt/dummy-llm/.env
ExecStart=/usr/bin/node dist/adapters/node.js
Restart=always
User=dummy

[Install]
WantedBy=multi-user.target
```

Then `sudo systemctl enable --now dummy-llm`, and put Caddy/Nginx in front for TLS.
Only open ports 22/80/443 in the firewall.

## 2. Cloudflare Workers (best free option)

The handler is already `(request: Request) => Promise<Response>`, so the Worker adapter is
about fifteen lines.

```jsonc
// wrangler.jsonc
{
  "name": "dummy-llm",
  "main": "src/adapters/worker.ts",
  "compatibility_date": "2026-01-01",
  "observability": { "enabled": true }
}
```

```bash
npx wrangler deploy                          # no public route: workers_dev/preview_urls are false
npx wrangler deploy --domain your.example.com  # attach your own Custom Domain for this deploy
```

The template ships with both routes **disabled**, because a joke endpoint that anyone can hit
is a joke endpoint that anyone can burn through your free quota.

**No hostname is committed.** `wrangler.jsonc` has no `routes` block: this repository is a public
template, and a cloner should neither inherit your domain nor publish their own. Three ways to attach
one, in order of convenience:

```bash
# 1. at deploy time - nothing is written to the repository
npx wrangler deploy --domain your.example.com
npm run deploy:domain -- your.example.com     # the same thing, via an npm script

# 2. a route of your own, kept out of your commits
#    "routes": [{ "pattern": "your.example.com", "custom_domain": true }]   in wrangler.jsonc

# 3. once, in the dashboard: Worker -> Settings -> Domains & Routes -> Add -> Custom Domain
```

`--domain` creates a **Custom Domain** (`custom_domain: true`), which is what this Worker wants: it
serves every path on that hostname. Use `--route` instead if you are putting the Worker on a path of a
domain that already has an origin.

Because a deploy sends whatever the configuration and the flags say, passing `--domain` on every deploy
is the option that cannot surprise you. If you attached the domain in the dashboard and then deploy
without it, check the dashboard afterwards: the safe habit is to put the flag in your deploy command or
in CI.

Alternatively set `"workers_dev": true` to use the free `*.workers.dev` URL, which needs no domain at
all but is public the moment you deploy.

Why this is the best free host for a streaming fake:

- **Streaming is native.** Return a `ReadableStream` and Workers streams it chunk by chunk;
  no configuration, no buffering layer in the way.
- **No cold starts**, global edge, free TLS on `*.workers.dev` (and on a custom domain if the
  domain is on Cloudflare).
- **Waiting is not CPU.** Free plan is famously tight on CPU time per invocation (~10 ms), but
  sitting in a `setTimeout` / `scheduler.wait()` between chunks is wall-clock, not CPU — so
  simulated typing does not blow the budget. Building the JSON frames does, and that is
  microseconds.
- We use no storage, so KV/D1/R2 quotas never apply — unless you turn the admin store on, in which case
  one small KV document is read per request.

Caveats to design around:

- Keep the **total** stream duration reasonable for a demo; very long-held connections across
  the edge are not the intended use. The VPS instance is the one for long streams.
- Free plan request quota is roughly 100k/day; a public joke endpoint can meet that. Add a
  simple cache/preflight bypass or a rate limit if it goes viral.
- Avoid `Content-Encoding: gzip` on an event stream; per-frame compression can delay
  flushing. dummy-llm sends `Cache-Control: no-transform`.

Docs: <https://developers.cloudflare.com/workers/platform/limits/>

## 3. Vercel (Hobby)

Two ways, both work with the same core handler:

```ts
// api/index.ts  — Node runtime, streaming supported
export const config = { runtime: "nodejs", maxDuration: 60 };
export default async function handler(req: Request) { return app(req); }
```

- **Node runtime**: full freedom, streaming via `ReadableStream`, but bounded by
  `maxDuration`. Hobby's default is short (seconds); raise it in config. Fluid compute
  raised the ceilings — re-check the current limit.
- **Edge runtime**: no duration problem worth worrying about for this workload, but a narrower
  API surface (we do not need Node APIs, so we are fine).

```json
// vercel.json
{ "functions": { "api/index.ts": { "maxDuration": 60 } } }
```

Caveats: the Hobby plan is licensed for **non-commercial** use — a free public demo is fine,
selling it is not; and a very long stream can be cut when it exceeds `maxDuration`.

Docs: <https://vercel.com/docs/limits>

## 4. Deno Deploy

```ts
// main.ts
import { app } from "./src/index.ts";
Deno.serve(app);
```

```bash
deployctl deploy --project=dummy-llm main.ts
```

Streaming works natively, zero cold start. Check the current monthly free quota before making
it the primary host: <https://deno.com/deploy/pricing>

## 5. Google Cloud Run

```bash
gcloud run deploy dummy-llm --source . --allow-unauthenticated --region asia-east1
```

Useful when you want the Docker image but no VPS: scale-to-zero, real SSE support, request
timeout configurable far beyond any other free option. Needs a billing account; the free tier
is generous but not unlimited. Docs: <https://cloud.google.com/run/pricing>

## 6. Other hosts worth knowing

- **Render free web service** — works, but sleeps after ~15 minutes idle and takes tens of
  seconds to wake. Fine for a link you share, bad for an API your app calls in CI.
- **Hugging Face Spaces (Docker)** — free, public, sleeps after long idle. Very on-brand for a
  joke LLM; the Dockerfile above works nearly unchanged.
- **Netlify Functions** — streaming responses supported; a good fallback if you want the repo
  to be drag-and-drop deployable.
- **Home server + Cloudflare Tunnel** — free, real, no port forwarding; the box must stay on.

## 7. Streaming checklist (the part that actually breaks)

1. **Proxy buffering** — Nginx buffers by default (`proxy_buffering off`); Caddy and the
   edge platforms do not.
2. **No `Content-Length`** — let the response be chunked; a Content-Length makes clients wait
   for the whole body.
3. **`Cache-Control: no-store, no-transform`** on every stream, or an intermediary may
   rewrite or cache it.
4. **Compression** — gzip on an event stream can hold frames inside a buffer. Do not compress
   `text/event-stream`.
5. **Heartbeats** — send `: ping` (an SSE comment) every ~15 s so idle timeouts on mobile
   networks do not kill a slow stream.
6. **Serverless duration caps** — a stream that outlives `maxDuration` dies mid-answer;
   keep default delays small and document the knob.
7. **HTTP/2** — `Connection: keep-alive` is a hop-by-hop header and is ignored; harmless, but
   do not rely on it.
8. **Test on a phone** — carrier proxies are the world's best SSE debugger.
9. **Flush per event** — never accumulate frames and write once; the whole point is that the
   first byte arrives early.

## 8. CI/CD sketch

```yaml
# .github/workflows/release.yml
# 1. test      -> node 20/22 + wrangler dev + deno
# 2. publish   -> docker buildx push ghcr.io/OWNER/dummy-llm
# 3. deploy    -> cloudflare/wrangler-action  (optional, needs CF_API_TOKEN)
# 4. deploy    -> vercel --prod               (optional, needs VERCEL_TOKEN)
```

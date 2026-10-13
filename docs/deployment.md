# Deployment

> ⚠️ **Verify the quota numbers.** They are written from memory and every platform changes
> them regularly. Check the links in each section before you publish a claim. The
> architecture advice below does not depend on the exact numbers.

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
`PARROT_DELAY_MS` of 200 with a long paragraph still completes, and there is no cold start.

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
  parrot:
    image: ghcr.io/OWNER/parrot-llm:latest
    restart: unless-stopped
    environment:
      PARROT_TEXT: "6"
      PARROT_DELAY_MS: "20"
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
	reverse_proxy parrot:8080
}
```

Caddy handles TLS automatically and, unlike Nginx, flushes SSE frames immediately without
extra configuration.

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

(Also send `X-Accel-Buffering: no` from the app; parrot-llm does this by default.)

### No Docker: systemd

```ini
[Unit]
Description=parrot-llm
After=network.target

[Service]
WorkingDirectory=/opt/parrot-llm
EnvironmentFile=/opt/parrot-llm/.env
ExecStart=/usr/bin/node dist/adapters/node.js
Restart=always
User=parrot

[Install]
WantedBy=multi-user.target
```

Then `sudo systemctl enable --now parrot-llm`, and put Caddy/Nginx in front for TLS.
Only open ports 22/80/443 in the firewall.

## 2. Cloudflare Workers (best free option)

The handler is already `(request: Request) => Promise<Response>`, so the Worker adapter is
about fifteen lines.

```jsonc
// wrangler.jsonc
{
  "name": "parrot-llm",
  "main": "src/adapters/worker.ts",
  "compatibility_date": "2026-01-01",
  "observability": { "enabled": true }
}
```

```bash
npx wrangler deploy
# -> https://parrot-llm.<your-subdomain>.workers.dev
```

Why this is the best free host for a streaming fake:

- **Streaming is native.** Return a `ReadableStream` and Workers streams it chunk by chunk;
  no configuration, no buffering layer in the way.
- **No cold starts**, global edge, free TLS on `*.workers.dev` (and on a custom domain if the
  domain is on Cloudflare).
- **Waiting is not CPU.** Free plan is famously tight on CPU time per invocation (~10 ms), but
  sitting in a `setTimeout` / `scheduler.wait()` between chunks is wall-clock, not CPU — so
  simulated typing does not blow the budget. Building the JSON frames does, and that is
  microseconds.
- We use no storage, so KV/D1/R2 quotas never apply.

Caveats to design around:

- Keep the **total** stream duration reasonable for a demo; very long-held connections across
  the edge are not the intended use. The VPS instance is the one for long streams.
- Free plan request quota is roughly 100k/day; a public joke endpoint can meet that. Add a
  simple cache/preflight bypass or a rate limit if it goes viral.
- Avoid `Content-Encoding: gzip` on an event stream; per-frame compression can delay
  flushing. parrot-llm sends `Cache-Control: no-transform`.

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
deployctl deploy --project=parrot-llm main.ts
```

Streaming works natively, zero cold start. Check the current monthly free quota before making
it the primary host: <https://deno.com/deploy/pricing>

## 5. Google Cloud Run

```bash
gcloud run deploy parrot-llm --source . --allow-unauthenticated --region asia-east1
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
# 2. publish   -> docker buildx push ghcr.io/OWNER/parrot-llm
# 3. deploy    -> cloudflare/wrangler-action  (optional, needs CF_API_TOKEN)
# 4. deploy    -> vercel --prod               (optional, needs VERCEL_TOKEN)
```

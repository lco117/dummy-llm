import { resolveConfig, type Env } from "../config.ts";
import { createApp, type App } from "../index.ts";
import { kvStore, type KvBinding } from "../store-kv.ts";
import { KV_KEY } from "../store.ts";

let cached: App | null = null;

/**
 * Cloudflare Workers entry point. wrangler bundles this file directly from TypeScript,
 * so the "Deploy to Cloudflare" button needs no build step for the Worker itself.
 *
 * The KV binding is optional: without it the admin page is read-only, which is the default
 * posture. DUMMY_STORE=kv with no binding is a misconfiguration worth saying out loud.
 */
export default {
  fetch(request: Request, env: Env = {}, _ctx?: unknown): Promise<Response> {
    if (cached === null) {
      const config = resolveConfig(env);
      const kv = (env as { DUMMY_ADMIN_KV?: KvBinding }).DUMMY_ADMIN_KV;
      if (config.store === "kv" && !kv) {
        console.error("dummy-llm: DUMMY_STORE=kv but no DUMMY_ADMIN_KV binding is present; the admin page stays read-only");
      }
      cached = createApp(config, { store: config.store === "kv" && kv ? kvStore(kv, KV_KEY) : undefined });
    }
    return cached(request);
  },
};

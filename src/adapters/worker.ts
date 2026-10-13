import { resolveConfig, type Env } from "../config.ts";
import { createApp, type App } from "../index.ts";

let cached: App | null = null;

/**
 * Cloudflare Workers entry point. wrangler bundles this file directly from TypeScript,
 * so the "Deploy to Cloudflare" button needs no build step for the Worker itself.
 */
export default {
  fetch(request: Request, env: Env = {}, _ctx?: unknown): Promise<Response> {
    if (cached === null) cached = createApp(resolveConfig(env));
    return cached(request);
  },
};

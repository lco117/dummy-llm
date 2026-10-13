import { processEnv, resolveConfig } from "../config.ts";
import { createApp } from "../index.ts";

declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): unknown };

const app = createApp(resolveConfig(processEnv()));

Deno.serve(app);

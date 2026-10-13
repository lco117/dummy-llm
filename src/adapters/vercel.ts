import { processEnv, resolveConfig } from "../config.ts";
import { createApp } from "../index.ts";

export const config = { runtime: "edge" };

const app = createApp(resolveConfig(processEnv()));

export default function handler(request: Request): Promise<Response> {
  return app(request);
}

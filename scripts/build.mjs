// Bundles the Node CLI with esbuild. The Cloudflare Worker does not use this:
// wrangler bundles TypeScript itself.
import { build } from "esbuild";
import { chmodSync } from "node:fs";

const shared = {
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
};

await build({
  ...shared,
  entryPoints: ["src/adapters/node.ts"],
  outfile: "dist/cli.js",
  banner: { js: "#!/usr/bin/env node" },
});

await build({
  ...shared,
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
});

try {
  chmodSync("dist/cli.js", 0o755);
} catch {
  // not a POSIX host; irrelevant on Windows
}

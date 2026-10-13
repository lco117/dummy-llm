// Keeps src/version.ts in step with package.json. Wired to npm's "version" lifecycle,
// so `npm version patch` updates both and stages the result.
import { readFile, writeFile } from "node:fs/promises";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const target = new URL("../src/version.ts", import.meta.url);
await writeFile(target, `/** Generated from package.json by scripts/sync-version.mjs — do not edit by hand. */\nexport const version = "${pkg.version}";\n`);
console.log(`src/version.ts -> ${pkg.version}`);

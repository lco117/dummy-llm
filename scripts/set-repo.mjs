// Rewrites the placeholder repository slug everywhere it appears.
// Usage: npm run set-repo -- owner/repo
import { readFile, writeFile } from "node:fs/promises";

const PLACEHOLDER = "lco117/parrot-llm";
const slug = process.argv[2];

if (!slug || !/^[\w.-]+\/[\w.-]+$/.test(slug)) {
  console.error("usage: npm run set-repo -- owner/repo");
  process.exit(1);
}

const files = ["README.md", "README.zh-CN.md", "AGENTS.md", "package.json", "docker-compose.yml", "docs/deployment.md"];
let changed = 0;

for (const file of files) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch {
    continue;
  }
  if (!text.includes(PLACEHOLDER)) continue;
  await writeFile(file, text.split(PLACEHOLDER).join(slug));
  console.log(`updated ${file}`);
  changed++;
}

console.log(changed === 0 ? "nothing to update" : `${changed} file(s) now point at ${slug}`);

import { mkdir, writeFile } from "node:fs/promises";
import { CASES, runCase } from "../test/cases.ts";

const dir = new URL("../test/golden/", import.meta.url);
await mkdir(dir, { recursive: true });

for (const testCase of CASES) {
  const output = await runCase(testCase);
  await writeFile(new URL(`${testCase.name}.txt`, dir), output);
  console.log(`wrote test/golden/${testCase.name}.txt`);
}

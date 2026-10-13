import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CASES, runCase } from "./cases.ts";

for (const testCase of CASES) {
  test(`golden: ${testCase.name}`, async () => {
    const actual = await runCase(testCase);
    const expected = await readFile(new URL(`./golden/${testCase.name}.txt`, import.meta.url), "utf8");
    assert.equal(actual, expected, `golden mismatch for ${testCase.name} (run: npm run golden)`);
  });
}

import test from "node:test";
import assert from "node:assert/strict";
import { buildText, chunkText, estimateTokens } from "../src/engine.ts";
import { mulberry32, randomId } from "../src/random.ts";
import { parseFaultSpec } from "../src/errors.ts";
import { resolveConfig } from "../src/config.ts";

test("chunkText splits by code point, not UTF-16 unit", () => {
  assert.deepEqual(chunkText("a\u{1F99C}b", 1), ["a", "\u{1F99C}", "b"]);
  assert.deepEqual(chunkText("\u4f60\u597d", 1), ["\u4f60", "\u597d"]);
  assert.deepEqual(chunkText("abcdef", 3), ["abc", "def"]);
});

test("chunkText word and line modes keep their separators", () => {
  assert.deepEqual(chunkText("hello big world", "word"), ["hello ", "big ", "world"]);
  assert.deepEqual(chunkText("a\nb\n", "line"), ["a\n", "b\n"]);
  assert.deepEqual(chunkText("hello", "whole"), ["hello"]);
  assert.deepEqual(chunkText("", 1), []);
});

test("seedable PRNG is reproducible", () => {
  const a = mulberry32(1);
  const b = mulberry32(1);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
  assert.match(randomId(mulberry32(1), 12), /^[A-Za-z0-9]{12}$/);
});

test("fault specs parse", () => {
  assert.equal(parseFaultSpec(undefined), null);
  assert.equal(parseFaultSpec("off"), null);
  assert.deepEqual(parseFaultSpec("429"), { status: 429, after: undefined });
  assert.deepEqual(parseFaultSpec("429:after=3"), { status: 429, after: 3 });
  assert.deepEqual(parseFaultSpec("rate_limit"), { status: 429, after: undefined });
});

test("config falls back safely", () => {
  const config = resolveConfig({});
  assert.equal(config.text, "6");
  assert.equal(config.mode, "fixed");
  assert.equal(config.chunk, 1);
  assert.equal(config.apiKey, null);
  assert.equal(resolveConfig({ PARROT_MODE: "nonsense" as never }).mode, "fixed");
  assert.equal(resolveConfig({ PARROT_CHUNK: "0" }).chunk, 1);
});

test("buildText modes", () => {
  const cfg = resolveConfig({ PARROT_TEXT: "6" });
  const rand = mulberry32(1);
  assert.equal(buildText({ protocol: "openai-chat", model: "m", messages: [{ role: "user", content: "what?" }], stream: false, includeUsage: false, raw: {} }, cfg, rand), "6");
  const echo = resolveConfig({}, { mode: "echo" });
  assert.equal(buildText({ protocol: "openai-chat", model: "m", messages: [{ role: "user", content: "say it back" }], stream: false, includeUsage: false, raw: {} }, echo, rand), "say it back");
  const canned = resolveConfig({}, { mode: "canned", canned: { weather: "it is raining" } });
  assert.equal(buildText({ protocol: "openai-chat", model: "m", messages: [{ role: "user", content: "how is the WEATHER" }], stream: false, includeUsage: false, raw: {} }, canned, rand), "it is raining");
});

test("token estimate is never zero for non-empty text", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("a"), 1);
});

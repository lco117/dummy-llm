import test from "node:test";
import assert from "node:assert/strict";
import { buildText, chunkText, estimateTokens, phases, plan, renderThinking, stripReminders, userInput } from "../src/engine.ts";
import { mulberry32, randomId } from "../src/random.ts";
import { parseFaultSpec } from "../src/errors.ts";
import { DEFAULT_THINKING, resolveConfig } from "../src/config.ts";
import type { CanonRequest } from "../src/types.ts";

const canon = (content: string): CanonRequest => ({
  protocol: "openai-chat",
  model: "gpt-4o",
  messages: [{ role: "user", content }],
  stream: true,
  includeUsage: false,
  raw: {},
});

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

test("the defaults are: repeat the user, with hardcoded thinking", () => {
  const config = resolveConfig({});
  assert.equal(config.mode, "echo");
  assert.equal(config.thinking, DEFAULT_THINKING);
  assert.equal(config.text, "6");
  assert.equal(config.apiKey, null);
  assert.equal(resolveConfig({ PARROT_MODE: "nonsense" as never }).mode, "echo");
  assert.equal(resolveConfig({ PARROT_CHUNK: "0" }).chunk, 1);
  assert.equal(resolveConfig({ PARROT_THINKING: "off" }).thinking, null);
  assert.equal(resolveConfig({ PARROT_THINKING: "none" }).thinking, null);
  assert.equal(resolveConfig({ PARROT_THINKING: "custom" }).thinking, "custom");
});

test("it says whatever the user said", () => {
  const config = resolveConfig({});
  const rand = mulberry32(1);
  assert.equal(buildText(canon("abc"), config, rand), "abc");
  assert.equal(buildText(canon(""), config, rand), "6", "empty input falls back to PARROT_TEXT");
});

test("thinking is a hardcoded template with the user's words dropped in", () => {
  const config = resolveConfig({});
  const later = plan(canon("abc"), config, mulberry32(1));
  assert.equal(later.reply, "abc");
  assert.equal(later.thinking, 'We need answer to user. User just said "abc". Need infer? Probably minimal. We need respond maybe "abc".');
  assert.equal(
    renderThinking(canon("abc"), resolveConfig({ PARROT_THINKING: "say {reply} to {input}" }), "abc"),
    "say abc to abc",
  );
  assert.equal(renderThinking(canon("abc"), resolveConfig({ PARROT_THINKING: "off" }), "abc"), null);
});

test("thinking streams before the reply", async () => {
  const config = resolveConfig({ PARROT_DELAY_MS: "0" }, { chunk: "whole" });
  const out: string[] = [];
  for await (const phase of phases(canon("abc"), config, mulberry32(1))) out.push(`${phase.channel}:${phase.text}`);
  assert.deepEqual(out, [
    'thinking:We need answer to user. User just said "abc". Need infer? Probably minimal. We need respond maybe "abc".',
    "text:abc",
  ]);
});

test("buildText modes", () => {
  const rand = mulberry32(1);
  const fixed = resolveConfig({ PARROT_TEXT: "6" }, { mode: "fixed" });
  assert.equal(buildText(canon("what?"), fixed, rand), "6");
  const canned = resolveConfig({}, { mode: "canned", canned: { weather: "it is raining" } });
  assert.equal(buildText(canon("how is the WEATHER"), canned, rand), "it is raining");
  const random = resolveConfig({}, { mode: "random", lines: ["a", "b"] });
  assert.ok(["a", "b"].includes(buildText(canon("x"), random, rand)));
});

test("harness reminder blocks are stripped before deciding what the user said", () => {
  assert.equal(stripReminders("hello <system-reminder>noise</system-reminder>"), "hello");
  assert.equal(stripReminders("<system-reminder>only noise</system-reminder>"), "");
  assert.equal(stripReminders("<SYSTEM-REMINDER>case</SYSTEM-REMINDER>x"), "x");
  assert.equal(stripReminders("x <system-reminder>unclosed"), "x");
  assert.equal(stripReminders("no reminders here"), "no reminders here");

  const noisy: CanonRequest = {
    protocol: "openai-chat",
    model: "parrot-1",
    messages: [
      { role: "user", content: "hwfaeouheaw" },
      { role: "user", content: '<system-reminder>Updated instructions from: AGENTS.md</system-reminder>' },
    ],
    stream: false,
    includeUsage: false,
    raw: {},
  };
  assert.equal(userInput(noisy, resolveConfig({})), "hwfaeouheaw", "falls back to the previous real message");
  assert.equal(userInput(noisy, resolveConfig({ PARROT_ECHO_RAW: "1" })), "<system-reminder>Updated instructions from: AGENTS.md</system-reminder>");
  assert.equal(resolveConfig({ PARROT_ECHO_RAW: "1" }).echoRaw, true);
  assert.equal(resolveConfig({}).echoRaw, false);
  assert.equal(plan(noisy, resolveConfig({}), mulberry32(1)).reply, "hwfaeouheaw");
});

test("token estimate is never zero for non-empty text", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("a"), 1);
});

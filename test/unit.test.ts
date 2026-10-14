import test from "node:test";
import assert from "node:assert/strict";
import { buildText, chunkText, describeReply, estimateTokens, phases, plan, renderTemplate, renderThinking, stripReminders, userInput } from "../src/engine.ts";
import { FILTER_NAMES } from "../src/filters.ts";
import { NOT_A_MODEL_REPLIES } from "../src/personas.ts";
import { mulberry32, randomId } from "../src/random.ts";
import { parseFaultSpec } from "../src/errors.ts";
import { DEFAULT_THINKING_POOL, PLAYGROUND_MAX_REPLY, parseReply, playgroundOverride, resolveConfig } from "../src/config.ts";
import { makeApp } from "./cases.ts";
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
  assert.equal(config.reply, "{input}", "echo is not a mode, it is this template");
  assert.equal(config.chunk, 4, "one streamed piece is roughly one token");
  assert.equal(config.thinking.length, DEFAULT_THINKING_POOL.length);
  assert.equal(config.thinking.length, 10);
  assert.equal(config.apiKey, null);
  assert.equal(describeReply(config.reply), "{input}");
  assert.equal(resolveConfig({ DUMMY_CHUNK: "0" }).chunk, 4);
  assert.deepEqual(resolveConfig({ DUMMY_THINKING: "off" }).thinking, []);
  assert.deepEqual(resolveConfig({ DUMMY_THINKING: "none" }).thinking, []);
  assert.deepEqual(resolveConfig({ DUMMY_THINKING: "custom" }).thinking, ["custom"]);
  assert.equal(resolveConfig({}).deterministic, false);
  assert.equal(resolveConfig({ DUMMY_SEED: "1" }).deterministic, true);
});

test("the shape of the reply value is the behaviour", () => {
  assert.equal(parseReply("6"), "6");
  assert.deepEqual(parseReply('["6","7","maybe"]'), ["6", "7", "maybe"]);
  assert.equal(parseReply("{input|upper}"), "{input|upper}", "a filter pipe is never a pool separator");
  assert.deepEqual(parseReply('{"weather":"raining","*":"no idea"}'), { weather: "raining", "*": "no idea" });
  assert.deepEqual(parseReply('["a|b", "c"]'), ["a|b", "c"], "JSON first, so a literal pipe survives");
  assert.equal(parseReply(undefined), undefined);
  assert.equal(parseReply("   "), undefined);

  assert.equal(resolveConfig({ DUMMY_MODE: "fixed", DUMMY_TEXT: "6" }).reply, "6", "the pre-0.4 quartet still maps");
  assert.equal(resolveConfig({ DUMMY_MODE: "echo" }).reply, "{input}");
  assert.deepEqual(resolveConfig({ DUMMY_MODE: "random", DUMMY_LINES: "a|b" }).reply, ["a", "b"]);
  assert.deepEqual(resolveConfig({ DUMMY_MODE: "canned", DUMMY_CANNED: '{"a":"b"}' }).reply, { a: "b" });
  assert.equal(resolveConfig({ DUMMY_REPLY: "winning" }).reply, "winning", "DUMMY_REPLY beats the legacy quartet");

  assert.equal(describeReply(["a", "b"]), "random of 2");
  assert.equal(describeReply({ "*": "x", weather: "y" }), "canned, 1 key");
});

test("it says whatever the user said", () => {
  const config = resolveConfig({});
  const rand = mulberry32(1);
  assert.equal(buildText(canon("abc"), config, rand), "abc");
  assert.equal(buildText(canon(""), config, rand), "", "no input, no words to give back");
});

test("thinking comes from a pool of hardcoded templates", () => {
  const config = resolveConfig({});
  const later = plan(canon("abc"), config, mulberry32(1));
  assert.equal(later.reply, "abc");
  assert.ok(later.thinking !== null && later.thinking.includes('"abc"'), "the user's words are dropped in");
  const filled = DEFAULT_THINKING_POOL.map((template) => template.split("{input}").join("abc").split("{reply}").join("abc"));
  assert.ok(filled.includes(later.thinking as string), "and it is one of the ten templates");

  const vars = { input: "abc", raw: "abc", model: "gpt-4o", reply: "abc" };
  assert.equal(renderThinking(["say {reply} to {input}"], vars, mulberry32(1)), "say abc to abc");
  assert.equal(renderThinking(resolveConfig({ DUMMY_THINKING: "off" }).thinking, vars, mulberry32(1)), null);

  const pool = resolveConfig({ DUMMY_THINKING: "A {input} | B {reply} | C" });
  assert.deepEqual(pool.thinking, ["A {input}", "B {reply}", "C"]);
  const seen = new Set<string>();
  for (let seed = 0; seed < 200; seed++) seen.add(renderThinking(pool.thinking, vars, mulberry32(seed)) as string);
  assert.equal(seen.size, 3, "every template in the pool can be picked");
});

test("thinking streams before the reply", async () => {
  const config = resolveConfig({ DUMMY_DELAY_MS: "0" }, { chunk: "whole" });
  const out: string[] = [];
  for await (const phase of phases(canon("abc"), config, mulberry32(1))) out.push(`${phase.channel}:${phase.text}`);
  assert.equal(out.length, 2);
  assert.match(out[0], /^thinking:.+"abc".+"abc".$/, "one template, both placeholders filled in");
  assert.equal(out[1], "text:abc");
});

test("every reply shape answers correctly", () => {
  const rand = mulberry32(1);
  assert.equal(buildText(canon("what?"), resolveConfig({}, { reply: "6" }), rand), "6");
  const canned = resolveConfig({}, { reply: { weather: "it is raining", "*": "no idea" } });
  assert.equal(buildText(canon("how is the WEATHER"), canned, rand), "it is raining");
  assert.equal(buildText(canon("hello"), canned, rand), "no idea", '"*" is the fallback');
  const random = resolveConfig({}, { reply: ["a", "b"] });
  assert.ok(["a", "b"].includes(buildText(canon("x"), random, rand)));
  assert.equal(buildText(canon("hi"), resolveConfig({}, { reply: "{input|upper}" }), rand), "HI");
});

test("tokens per second drive the delay, and DUMMY_DELAY_MS still wins", () => {
  assert.equal(resolveConfig({}).tps, 100);
  assert.equal(resolveConfig({}).delayMs, 10);
  assert.equal(resolveConfig({ DUMMY_TPS: "10" }).delayMs, 100);
  assert.equal(resolveConfig({ DUMMY_TPS: "0" }).delayMs, 0, "0 tps means no artificial delay");
  assert.equal(resolveConfig({ DUMMY_TPS: "5", DUMMY_DELAY_MS: "50" }).delayMs, 50, "explicit delay overrides tps");
});

test("log level parses", () => {
  assert.equal(resolveConfig({}).log, "off");
  assert.equal(resolveConfig({ DUMMY_LOG: "summary" }).log, "summary");
  assert.equal(resolveConfig({ DUMMY_LOG: "1" }).log, "summary");
  assert.equal(resolveConfig({ DUMMY_LOG: "full" }).log, "full");
  assert.equal(resolveConfig({ DUMMY_LOG: "nonsense" }).log, "off");
});

test("a reply template can contain the user's words", () => {
  const cfg = resolveConfig({}, { reply: "{input} — 你说得对" });
  assert.equal(buildText(canon("abc"), cfg, mulberry32(1)), "abc — 你说得对");
  assert.equal(buildText(canon("abc"), resolveConfig({}, { reply: "6" }), mulberry32(1)), "6");
  const withModel = resolveConfig({}, { reply: "{model} says {input}" });
  assert.equal(buildText(canon("hi"), withModel, mulberry32(1)), "gpt-4o says hi");
});

test("the landing page is a live demo, not a giant 6", async () => {
  const app = makeApp();
  const response = await app(new Request("http://localhost/"));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  assert.match(html, /says whatever you said/);
  assert.match(html, /v1\/chat\/completions/);
  assert.match(html, /dummy-echo-1/);
});

test("harness reminder blocks are stripped before deciding what the user said", () => {
  assert.equal(stripReminders("hello <system-reminder>noise</system-reminder>"), "hello");
  assert.equal(stripReminders("<system-reminder>only noise</system-reminder>"), "");
  assert.equal(stripReminders("<SYSTEM-REMINDER>case</SYSTEM-REMINDER>x"), "x");
  assert.equal(stripReminders("x <system-reminder>unclosed"), "x");
  assert.equal(stripReminders("no reminders here"), "no reminders here");

  const metadata =
    "Time sampled while preparing turn 1, step 1: 2026-10-13T18:09:13+08:00[Asia/Shanghai]\n" +
    "Browser time zone for this request: Asia/Shanghai. Interpret otherwise-unqualified dates and times in this zone.\n" +
    "Elapsed since the preceding model-visible message: unavailable.";
  assert.equal(stripReminders(metadata), "", "untagged harness metadata is not something a human said");
  assert.equal(stripReminders("hi\n\n" + metadata), "hi", "and it does not contaminate a real message");
  assert.equal(stripReminders("keep me", ["keep"]) , "me", "operator-supplied patterns are applied");
  assert.equal(
    stripReminders("[model changed: assistant turns above this point were generated by parrot-1; the session continues with dummy-1-mini]"),
    "",
    "model-switch notices are harness noise too",
  );
  assert.equal(stripReminders("hi\n[model changed: a; b]"), "hi");

  const noisy: CanonRequest = {
    protocol: "openai-chat",
    model: "dummy-1",
    messages: [
      { role: "user", content: "hwfaeouheaw" },
      { role: "user", content: '<system-reminder>Updated instructions from: AGENTS.md</system-reminder>' },
    ],
    stream: false,
    includeUsage: false,
    raw: {},
  };
  assert.equal(userInput(noisy, resolveConfig({})), "hwfaeouheaw", "falls back to the previous real message");
  assert.equal(userInput(noisy, resolveConfig({ DUMMY_ECHO_RAW: "1" })), "<system-reminder>Updated instructions from: AGENTS.md</system-reminder>");
  assert.equal(resolveConfig({ DUMMY_ECHO_RAW: "1" }).echoRaw, true);
  assert.equal(resolveConfig({}).echoRaw, false);
  assert.equal(plan(noisy, resolveConfig({}), mulberry32(1)).reply, "hwfaeouheaw");
});

test("oversized request bodies are rejected", async () => {
  const app = makeApp({ maxBodyBytes: 200 });
  const big = await app(
    new Request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "dummy-1", messages: [{ role: "user", content: "x".repeat(400) }] }),
    }),
  );
  assert.equal(big.status, 413);
  const small = await app(
    new Request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "dummy-1", messages: [{ role: "user", content: "hi" }] }),
    }),
  );
  assert.equal(small.status, 200);
  assert.equal(resolveConfig({ DUMMY_MAX_BODY: "10" }).maxBodyBytes, 10);
  assert.equal(resolveConfig({}).maxBodyBytes, 1000000);
});

test("placeholder filters compose", () => {
  const vars = { input: "hello world", raw: "hello world", model: "dummy-echo-1" };
  assert.equal(renderTemplate("{input|upper}", vars), "HELLO WORLD");
  assert.equal(renderTemplate("{input|reverse}", vars), "dlrow olleh");
  assert.equal(renderTemplate("{input|truncate:5}", vars), "hello…");
  assert.equal(renderTemplate("{input|count}", vars), "11");
  assert.equal(renderTemplate("{input|repeat:2}", vars), "hello worldhello world");
  assert.equal(renderTemplate("{input|morse}", vars), ".... . .-.. .-.. --- / .-- --- .-. .-.. -..");
  assert.equal(renderTemplate("{input|base64}", vars), "aGVsbG8gd29ybGQ=");
  assert.equal(renderTemplate("{input|hex}", vars), "68 65 6c 6c 6f 20 77 6f 72 6c 64");
  assert.equal(renderTemplate("{input|json}", vars), '"hello world"');
  assert.equal(renderTemplate("{input|leet}", vars), "h3ll0 w0rld");
  assert.equal(renderTemplate("{input|spongebob}", { ...vars, input: "abcd" }), "aBcD");
  assert.equal(renderTemplate("{input|upper|reverse}", vars), "DLROW OLLEH");
  assert.equal(renderTemplate("{input|nope}", vars), "hello world", "an unknown filter is ignored");
  assert.equal(renderTemplate("{unknown}", vars), "{unknown}", "an unknown placeholder is left alone");
  assert.equal(renderTemplate("{input|box}", vars), "+-------------+\n| hello world |\n+-------------+");
  assert.equal(renderTemplate("{input|ascii}", { ...vars, input: "AB" }).split("\n").length, 5);
  assert.equal(renderTemplate("{input|ascii}", { ...vars, input: "A" }), ".#.\n#.#\n###\n#.#\n#.#");
  assert.equal(renderTemplate("{input|hash}", vars).length, 8);
  assert.ok(FILTER_NAMES.includes("ascii") && FILTER_NAMES.includes("box"));
});

test("the model id selects a persona", () => {
  const cfg = resolveConfig({});
  assert.deepEqual(cfg.models, ["dummy-echo-1", "definitely-not-a-model"]);
  const base = { protocol: "openai-chat" as const, messages: [{ role: "user", content: "hi" }], stream: false, includeUsage: false, raw: {} };
  const dummy = plan({ ...base, model: "definitely-not-a-model" }, cfg, mulberry32(1));
  assert.ok(NOT_A_MODEL_REPLIES.includes(dummy.reply), "the reply comes from the persona pool");
  assert.ok(dummy.thinking !== null && dummy.thinking.includes("hi"), "and its thinking explains itself");
  assert.equal(plan({ ...base, model: "dummy-echo-1" }, cfg, mulberry32(1)).reply, "hi");
  assert.equal(plan({ ...base, model: "gpt-4o" }, cfg, mulberry32(1)).reply, "hi", "unknown models fall through");

  const custom = resolveConfig({ DUMMY_PERSONAS: '{"dummy-ascii-1":{"reply":"{input|ascii}","thinking":[]}}' });
  assert.deepEqual(custom.models, ["dummy-echo-1", "definitely-not-a-model", "dummy-ascii-1"], "env personas join the model list");
  const art = plan({ ...base, model: "dummy-ascii-1" }, custom, mulberry32(1));
  assert.equal(art.reply.split("\n").length, 5, "the ASCII banner has five rows");
  assert.equal(art.thinking, null, "and this persona silences the thinking channel");
});

test("the playground override is opt-in, length-limited and one-request-only", () => {
  const url = new URL("http://x/v1/chat/completions?t=" + encodeURIComponent("{input|upper}"));
  assert.equal(playgroundOverride(resolveConfig({}), url).reply, "{input}", "?t= is ignored unless the operator opts in");

  const on = playgroundOverride(resolveConfig({ DUMMY_PLAYGROUND: "1" }), url);
  assert.equal(on.reply, "{input|upper}");
  assert.equal(on.maxReplyChars, PLAYGROUND_MAX_REPLY);
  assert.equal(resolveConfig({ DUMMY_PLAYGROUND: "1" }).playground, true);

  assert.throws(
    () => playgroundOverride(resolveConfig({ DUMMY_PLAYGROUND: "1" }), new URL("http://x/?t=" + "x".repeat(2001))),
    /limited to 2000/,
  );

  const capped = resolveConfig({ DUMMY_PLAYGROUND: "1" }, { maxReplyChars: 10 });
  assert.equal(plan(canon("abcdefghijklmnop"), { ...capped, reply: "{input}" }, mulberry32(1)).reply, "abcdefghij");
});

test("both editors document the template format", async () => {
  const { ADMIN_HTML } = await import("../src/admin-ui.ts");
  const on = makeApp({ playground: true });
  const landing = await (await on(new Request("http://localhost/"))).text();
  assert.match(landing, /What you can write here/);
  assert.match(landing, /\{input\}/);
  assert.match(landing, /\{input\|upper\}/);
  assert.match(ADMIN_HTML, /Format reference/);
  assert.match(ADMIN_HTML, /\{reply\}/);
});

test("the landing page only offers the editor when the playground is on", async () => {
  const off = await (await makeApp()(new Request("http://localhost/"))).text();
  assert.match(off, /id="editor" hidden/);
  const on = await (await makeApp({ playground: true })(new Request("http://localhost/"))).text();
  assert.match(on, /id="editor"/);
  assert.doesNotMatch(on, /id="editor" hidden/);
  assert.match(on, /Edit the reply template/);
  assert.match(on, /not by this site's owner/);
});

test("the format help is generated from the real filter registry", async () => {
  const { TEMPLATE_HELP_HTML } = await import("../src/help.ts");
  for (const name of FILTER_NAMES) {
    assert.ok(TEMPLATE_HELP_HTML.includes(">" + name + "<") || TEMPLATE_HELP_HTML.includes(name), `the help must mention the ${name} filter`);
  }
  for (const token of ["{input}", "{raw}", "{reply}", "{model}", "{text}"]) {
    assert.ok(TEMPLATE_HELP_HTML.includes(token), `the help must mention ${token}`);
  }
  assert.match(TEMPLATE_HELP_HTML, /\["6","7","maybe"\]/);
  assert.match(TEMPLATE_HELP_HTML, /\{"weather":"raining","\*":"no idea"\}/);
  assert.equal(TEMPLATE_HELP_HTML.includes("<script"), false);
});

test("token estimate is never zero for non-empty text", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("a"), 1);
});

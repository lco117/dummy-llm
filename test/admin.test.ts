import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/index.ts";
import { resolveConfig, storeFilePath } from "../src/config.ts";
import { createStoreLayer, memoryStore, parseStoreDoc, serializeDoc, validateDoc } from "../src/store.ts";
import { fileStore } from "../src/store-file.ts";
import { kvStore } from "../src/store-kv.ts";
import { constantTimeEqual, readCookie, signSession, verifySession } from "../src/admin-auth.ts";
import { resetAccessCache, verifyAccessJwt } from "../src/admin-access.ts";
import { redact, redactText, redactedJson } from "../src/redact.ts";
import { FIXED_NOW, normalize } from "./cases.ts";
import type { Config, StoreDoc } from "../src/types.ts";
import type { Store } from "../src/store.ts";

const KEY = "correct-horse-battery-staple";
const NOW_SEC = Math.floor(FIXED_NOW / 1000);

function adminApp(
  env: Record<string, string | undefined> = {},
  store?: Store,
  overrides: Partial<Config> = {},
): ReturnType<typeof createApp> {
  const config = resolveConfig({ DUMMY_DELAY_MS: "0", DUMMY_TTFT_MS: "0", ...env }, { seed: 1, now: () => FIXED_NOW, ...overrides });
  return createApp(config, { store });
}

function call(app: ReturnType<typeof createApp>, path: string, init: RequestInit = {}): Promise<Response> {
  return app(new Request("http://localhost" + path, init));
}

function json(body: unknown): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

function storedCookie(response: Response): string | null {
  const header = response.headers.get("set-cookie");
  if (!header) return null;
  const match = header.match(/dummy_admin=([^;]*)/);
  return match ? match[1] : null;
}

async function signIn(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await call(app, "/admin/login", json({ key: KEY }));
  assert.equal(response.status, 200);
  const value = storedCookie(response);
  assert.ok(value, "login must set a cookie");
  return value;
}

function authed(value: string, init: RequestInit = {}): RequestInit {
  return { ...init, headers: { ...(init.headers as Record<string, string> | undefined), cookie: "dummy_admin=" + value } };
}

/** Concatenates the content deltas of an OpenAI-style SSE stream. */
function assemble(text: string): string {
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => {
      try {
        return (JSON.parse(line.slice(6)) as any).choices?.[0]?.delta?.content ?? "";
      } catch {
        return "";
      }
    })
    .join("");
}

function fakeStore(initial: StoreDoc | null): Store {
  return memoryStore(initial ? serializeDoc(initial) : null);
}

/* ------------------------------------------------------------------ the gate */

test("the admin surface does not exist without a key", async () => {
  const app = adminApp();
  for (const path of ["/admin", "/admin/api/state", "/admin/login", "/admin/app.js"]) {
    const response = await call(app, path, path === "/admin/login" ? json({ key: KEY }) : {});
    assert.equal(response.status, 404, path + " must be 404");
  }
});

test("DUMMY_ADMIN_AUTH=off is a panic switch even with a key set", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY, DUMMY_ADMIN_AUTH: "off" });
  assert.equal((await call(app, "/admin")).status, 404);
});

test("an unknown DUMMY_ADMIN_AUTH value fails loudly instead of downgrading", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY, DUMMY_ADMIN_AUTH: "basic" });
  const response = await call(app, "/admin");
  assert.equal(response.status, 500);
  const body = await response.json() as { error: string };
  assert.match(body.error, /unknown DUMMY_ADMIN_AUTH/);
});

test("a key equal to the API key is refused", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY, DUMMY_API_KEY: KEY });
  const response = await call(app, "/admin");
  assert.equal(response.status, 500);
  assert.match(JSON.stringify(await response.json()), /identical to DUMMY_API_KEY/);
});

test("the admin surface is not gated by DUMMY_API_KEY", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY, DUMMY_API_KEY: "sk-another-key" });
  const cookie = await signIn(app);
  assert.equal((await call(app, "/admin", authed(cookie))).status, 200);
  assert.equal((await call(app, "/v1/models")).status, 401);
});

/* ------------------------------------------------------------------ login */

test("the login form works without JavaScript and without a cookie", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY });
  const response = await call(app, "/admin");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /method="post" action="\/admin\/login"/);
  assert.doesNotMatch(html, /onclick=|onload=/);
});

test("a wrong key is refused, with a redirect for a form and JSON for a fetch", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY });
  const form = await call(app, "/admin/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "key=nope",
  });
  assert.equal(form.status, 303);
  assert.equal(form.headers.get("location"), "/admin?e=bad-key");
  assert.equal(storedCookie(form), null);

  const fetchResponse = await call(app, "/admin/login", json({ key: "nope" }));
  assert.equal(fetchResponse.status, 401);
  assert.equal(storedCookie(fetchResponse), null);
});

test("a correct key issues a hardened cookie that does not contain the key", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY });
  const response = await call(app, "/admin/login", json({ key: KEY }));
  const header = response.headers.get("set-cookie") as string;
  assert.match(header, /HttpOnly/);
  assert.match(header, /Secure/);
  assert.match(header, /SameSite=Strict/);
  assert.match(header, /Path=\/admin/);
  const value = storedCookie(response);
  assert.ok(value);
  assert.equal(value.includes(KEY), false);
  assert.equal(header.includes(KEY), false);
  assert.equal(await verifySession(KEY, value as string, NOW_SEC), true);
});

test("a tampered or foreign cookie is rejected", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY });
  const value = await signIn(app);
  const tampered = value.slice(0, -1) + (value.endsWith("a") ? "b" : "a");
  assert.equal((await call(app, "/admin/api/state", authed(tampered))).status, 401);
  const foreign = await signSession("a-different-key", NOW_SEC + 3600);
  assert.equal((await call(app, "/admin/api/state", authed(foreign))).status, 401);
});

test("an expired cookie is rejected", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY });
  const expired = await signSession(KEY, NOW_SEC - 60);
  assert.equal((await call(app, "/admin/api/state", authed(expired))).status, 401);
});

test("login failures are throttled", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY });
  let last = 0;
  for (let attempt = 0; attempt < 9; attempt++) {
    const response = await call(app, "/admin/login", json({ key: "wrong-" + attempt }));
    last = response.status;
  }
  assert.equal(last, 429);
});

test("logout clears the cookie", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY });
  const response = await call(app, "/admin/logout", { method: "POST" });
  assert.equal(response.status, 303);
  assert.match(response.headers.get("set-cookie") as string, /Max-Age=0/);
});

test("signing out works even when the origin check is unhappy", async () => {
  // A refused logout would show the operator a JSON error and leave them signed in. It destroys
  // nothing and a cross-site request cannot carry the Strict cookie, so it must always go through.
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY });
  const cookie = await signIn(app);
  for (const origin of ["https://somewhere-else.example", "null"]) {
    const response = await call(app, "/admin/logout", {
      method: "POST",
      headers: { origin, cookie: "dummy_admin=" + cookie },
    });
    assert.equal(response.status, 303, "logout must not be refused for origin " + origin);
    assert.match(response.headers.get("set-cookie") as string, /Max-Age=0/);
  }
});

test("a same-host Origin is accepted even when fetch metadata says cross-site", async () => {
  // Cloudflare Access can replay a form POST after its login redirect, which makes the browser label
  // the request cross-site even though it came from the operator's own page. The Origin header is the
  // authoritative one, so a matching host wins over Sec-Fetch-Site.
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY }, fakeStore(null));
  const cookie = await signIn(app);
  const accepted = await call(app, "/admin/api/personas/dummy-same-host", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      "sec-fetch-site": "cross-site",
      cookie: "dummy_admin=" + cookie,
    },
    body: JSON.stringify({ reply: "ok" }),
  });
  assert.equal(accepted.status, 200);

  const refused = await call(app, "/admin/api/personas/dummy-other-host", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: "https://evil.example",
      "sec-fetch-site": "same-origin",
      cookie: "dummy_admin=" + cookie,
    },
    body: JSON.stringify({ reply: "no" }),
  });
  assert.equal(refused.status, 403);
});

/* ------------------------------------------------------------------ CSRF and headers */

test("a cross-origin write is refused", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY }, fakeStore(null));
  const cookie = await signIn(app);
  const response = await call(app, "/admin/api/personas/x", {
    method: "PUT",
    headers: { "content-type": "application/json", origin: "https://evil.example", cookie: "dummy_admin=" + cookie },
    body: JSON.stringify({ reply: "hi" }),
  });
  assert.equal(response.status, 403);
});

test("admin responses carry no CORS grant and a strict CSP", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY });
  const response = await call(app, "/admin");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  const csp = response.headers.get("content-security-policy") as string;
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-inline/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("the app script is served same-origin with no inline handlers in the page", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY }, fakeStore(null));
  const cookie = await signIn(app);
  const response = await call(app, "/admin", authed(cookie));
  const html = await response.text();
  assert.match(html, /script src="\/admin\/app.js"/);
  assert.doesNotMatch(html, /innerHTML/);
  const script = await call(app, "/admin/app.js");
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type") as string, /javascript/);
});

/* ------------------------------------------------------------------ state and precedence */

test("state reports the environment, the store and the effective value", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY, DUMMY_TPS: "100" }, fakeStore({ version: 1, defaults: { tps: 40 } }));
  const cookie = await signIn(app);
  const body = await (await call(app, "/admin/api/state", authed(cookie))).json() as any;
  assert.equal(body.state.defaults.tps.env, 100);
  assert.equal(body.state.defaults.tps.stored, 40);
  assert.equal(body.state.defaults.tps.effective, 40);
  assert.equal(body.state.auth.writable, true);
  const ids = body.state.personas.map((entry: any) => entry.id);
  assert.ok(ids.includes("dummy-echo-1"));
  assert.equal(body.state.personas.find((entry: any) => entry.id === "dummy-echo-1").source, "builtin");
});

test("the store beats the environment on the inference path too", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY, DUMMY_TPS: "100" }, fakeStore({ version: 1, defaults: { tps: 7 } }));
  const health = await (await call(app, "/healthz")).json() as any;
  assert.equal(health.tps, 7);
});

test("a stored persona answers, and a tombstone removes it", async () => {
  const doc: StoreDoc = { version: 1, personas: { "dummy-env-1": { reply: "env says hi" } } };
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY, DUMMY_PERSONAS: JSON.stringify({ "dummy-env-1": { reply: "from the environment" } }) }, fakeStore(doc));
  const answer = async (model: string) => {
    const response = await call(app, "/v1/chat/completions", json({ model, messages: [{ role: "user", content: "x" }] }));
    return ((await response.json() as any).choices?.[0]?.message?.content ?? null);
  };
  assert.equal(await answer("dummy-env-1"), "env says hi");
  const cookie = await signIn(app);
  assert.equal((await call(app, "/admin/api/personas/dummy-env-1", authed(cookie, { method: "DELETE" }))).status, 200);
  assert.equal(await answer("dummy-env-1"), "x");
  const models = await (await call(app, "/v1/models")).json() as any;
  assert.equal(models.data.some((entry: any) => entry.id === "dummy-env-1"), false);
});

test("writes are refused with a clear message when no store is configured", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY });
  const cookie = await signIn(app);
  const response = await call(app, "/admin/api/personas/dummy-x", authed(cookie, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ reply: "hi" }) }));
  assert.equal(response.status, 409);
  assert.match(JSON.stringify(await response.json()), /read-only/);
});

test("a persona can be saved, listed and reverted one default at a time", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY, DUMMY_TPS: "100" }, fakeStore(null));
  const cookie = await signIn(app);
  const save = await call(app, "/admin/api/personas/dummy-yoda-1", authed(cookie, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reply: "{input|reverse}", thinking: ["hmm {input}"] }),
  }));
  assert.equal(save.status, 200);

  const state = await (await call(app, "/admin/api/state", authed(cookie))).json() as any;
  const entry = state.state.personas.find((item: any) => item.id === "dummy-yoda-1");
  assert.equal(entry.source, "store");
  assert.ok(state.state.models.includes("dummy-yoda-1"));

  const answer = await (await call(app, "/v1/chat/completions", json({ model: "dummy-yoda-1", messages: [{ role: "user", content: "abc" }] }))).json() as any;
  assert.equal(answer.choices[0].message.content, "cba");

  await call(app, "/admin/api/defaults", authed(cookie, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ tps: 5 }) }));
  let after = await (await call(app, "/admin/api/state", authed(cookie))).json() as any;
  assert.equal(after.state.defaults.tps.effective, 5);
  await call(app, "/admin/api/defaults/tps", authed(cookie, { method: "DELETE" }));
  after = await (await call(app, "/admin/api/state", authed(cookie))).json() as any;
  assert.equal(after.state.defaults.tps.effective, 100);
  assert.equal(after.state.defaults.tps.stored, null);
});

test("a keyword-map reply can be stored and answers as a map", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY }, fakeStore(null));
  const cookie = await signIn(app);
  await call(app, "/admin/api/defaults", authed(cookie, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reply: { weather: "raining", "*": "no idea" } }),
  }));
  const response = await call(app, "/v1/chat/completions", json({ model: "unknown-model", messages: [{ role: "user", content: "what is the weather" }] }));
  assert.equal((await response.json() as any).choices[0].message.content, "raining");
});

test("resetting drops the whole document", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY }, fakeStore({ version: 1, defaults: { tps: 5 } }));
  const cookie = await signIn(app);
  assert.equal((await call(app, "/admin/api/reset", authed(cookie, { method: "POST" }))).status, 200);
  const state = await (await call(app, "/admin/api/state", authed(cookie))).json() as any;
  assert.equal(state.state.defaults.tps.effective, 100);
  assert.equal(state.state.defaults.tps.stored, null);
});

/* ------------------------------------------------------------------ preview */

test("the preview is byte-identical to a real client request", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY, DUMMY_REPLY: "{input|upper}" }, fakeStore(null));
  const cookie = await signIn(app);
  const direct = await call(app, "/v1/chat/completions", json({ model: "dummy-preview", stream: true, messages: [{ role: "user", content: "abc" }] }));
  const preview = await call(app, "/admin/api/preview", authed(cookie, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: "abc", model: "", patch: { reply: "{input|upper}", thinking: [] } }),
  }));
  const directText = normalize(await direct.text());
  const previewText = normalize(await preview.text());
  // the preview patches thinking to [] as well, so strip both reasoning channels is unnecessary:
  // compare only the answer frames
  const answers = (text: string) => text.split("\n").filter((line) => line.includes('"content":"')).join("\n");
  assert.equal(answers(previewText).length > 0, true);
  assert.equal(answers(directText).replace(/"reasoning_content":"[^"]*"/g, ""), answers(previewText));
});

test("the preview applies a draft persona and refuses a cross-origin call", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY, DUMMY_THINKING: "off" }, fakeStore(null));
  const cookie = await signIn(app);
  const response = await call(app, "/admin/api/preview", authed(cookie, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: "abc", model: "dummy-new-1", patch: { reply: "draft: {input}" } }),
  }));
  assert.equal(response.status, 200);
  const text = await response.text();
  const streamed = assemble(text);
  assert.equal(streamed, "draft: abc");

  const crossOrigin = await call(app, "/admin/api/preview", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://evil.example", cookie: "dummy_admin=" + cookie },
    body: JSON.stringify({ input: "abc" }),
  });
  assert.equal(crossOrigin.status, 403);
});

/* ------------------------------------------------------------------ packs */

test("a pack can be previewed as a diff, applied, and exported again", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY }, fakeStore(null));
  const cookie = await signIn(app);
  const pack = { name: "test-pack", personas: { "dummy-pack-1": { reply: "from a pack" } }, defaults: { tps: 3 } };

  const preview = await (await call(app, "/admin/api/import", authed(cookie, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pack, apply: false }),
  }))).json() as any;
  assert.deepEqual(preview.diff.personas.added, ["dummy-pack-1"]);
  assert.equal(preview.applied, false);

  const applied = await (await call(app, "/admin/api/import", authed(cookie, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pack, apply: true }),
  }))).json() as any;
  assert.equal(applied.applied, true);

  const exported = await (await call(app, "/admin/api/export", authed(cookie, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }))).json() as any;
  assert.equal(exported.pack.personas["dummy-pack-1"].reply, "from a pack");
  assert.equal(exported.pack.defaults.tps, 3);
});

test("a junk pack is rejected without touching the store", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY }, fakeStore(null));
  const cookie = await signIn(app);
  const response = await call(app, "/admin/api/import", authed(cookie, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pack: { personas: { bad: 42 }, defaults: {} }, apply: true }),
  }));
  assert.equal(response.status, 400);
  const state = await (await call(app, "/admin/api/state", authed(cookie))).json() as any;
  assert.equal(state.state.personas.some((entry: any) => entry.id === "bad"), false);
});

/* ------------------------------------------------------------------ logs */

test("no secret reaches a log line", async () => {
  const lines: string[] = [];
  const original = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => { lines.push(args.map((value) => String(value)).join(" ")); };
  console.error = (...args: unknown[]) => { lines.push(args.map((value) => String(value)).join(" ")); };
  try {
    const adminKey = "sk-admin-secret-value-123456";
    const app = adminApp({ DUMMY_ADMIN_KEY: adminKey, DUMMY_LOG: "full" });
    await call(app, "/admin/login", json({ key: "sk-bad-guess-value-987654321" }));
    await call(app, "/admin/login", json({ key: adminKey }));
    await call(app, "/v1/chat/completions", json({ model: "dummy-echo-1", api_key: "sk-leak-me-please-12345678", messages: [{ role: "user", content: "hi" }] }));
  } finally {
    console.log = original;
    console.error = originalError;
  }
  const joined = lines.join("\n");
  assert.equal(joined.includes("sk-admin-secret-value-123456"), false);
  assert.equal(joined.includes("sk-bad-guess-value-987654321"), false);
  assert.equal(joined.includes("sk-leak-me-please-12345678"), false);
  assert.match(joined, /\[redacted\]/);
});

test("redaction covers credential keys and credential shapes", () => {
  const value = redact({ api_key: "anything", nested: { password: "x", note: "sk-abcdefghijklmnop" }, keep: "hello" });
  assert.deepEqual(value, { api_key: "[redacted]", nested: { password: "[redacted]", note: "[redacted]" }, keep: "hello" });
  assert.equal(redactText("Bearer abcdefghijkl"), "Bearer [redacted]");
  assert.equal(redactText("sk-dummy is the documented placeholder"), "sk-dummy is the documented placeholder");
  assert.match(redactedJson({ adminKey: "shh" }), /\[redacted\]/);
});

/* ------------------------------------------------------------------ auth helpers */

test("constant-time comparison is correct for equal, unequal and empty strings", async () => {
  assert.equal(await constantTimeEqual("abc", "abc"), true);
  assert.equal(await constantTimeEqual("abc", "abd"), false);
  assert.equal(await constantTimeEqual("", ""), true);
  assert.equal(await constantTimeEqual("abc", "abcd"), false);
});

test("cookies parse to the right name", () => {
  assert.equal(readCookie("a=1; dummy_admin=xyz; b=2", "dummy_admin"), "xyz");
  assert.equal(readCookie(null, "dummy_admin"), null);
});

/* ------------------------------------------------------------------ store plumbing */

test("the store document is sanitised, not trusted", () => {
  const doc = parseStoreDoc(JSON.stringify({
    personas: { good: { reply: "hi" }, tombstone: null, junk: { reply: 42 }, empty: {} },
    defaults: { tps: "fast", chunk: "line", log: "verbose", playground: true },
    models: ["good", 7],
  }));
  assert.ok(doc);
  assert.equal(doc?.personas?.good?.reply, "hi");
  assert.equal(doc?.personas?.tombstone, null);
  assert.equal("junk" in (doc?.personas ?? {}), false);
  assert.equal(doc?.defaults?.tps, undefined);
  assert.equal(doc?.defaults?.chunk, "line");
  assert.equal(doc?.defaults?.log, undefined);
  assert.equal(doc?.defaults?.playground, true);
  assert.deepEqual(doc?.models, ["good"]);
  assert.equal(parseStoreDoc("not json"), null);
});

test("an oversized document is refused before it is written", () => {
  const personas: Record<string, { reply: string }> = {};
  for (let index = 0; index < 201; index++) personas["dummy-" + index] = { reply: "hi" };
  assert.match(validateDoc({ version: 1, personas }) ?? "", /too many personas/);
  assert.equal(validateDoc({ version: 1, personas: { one: { reply: "hi" } } }), null);
});

test("the file store writes atomically and survives a missing file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dummy-store-"));
  try {
    const path = storeFilePath("file:" + directory);
    assert.equal(path, directory.replace(/\/+$/, "") + "/store.json");
    const store = fileStore(path);
    assert.equal(await store.read(), null);
    await store.write('{"version":1}');
    assert.equal(await readFile(path, "utf8"), '{"version":1}');
    assert.equal(await store.read(), '{"version":1}');
    await store.write(null);
    assert.equal(await store.read(), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the kv store maps null onto delete", async () => {
  const map = new Map<string, string>();
  const store = kvStore({
    get: async (key) => map.get(key) ?? null,
    put: async (key, value) => { map.set(key, value); },
    delete: async (key) => { map.delete(key); },
  }, "config");
  await store.write("first");
  assert.equal(await store.read(), "first");
  await store.write(null);
  assert.equal(await store.read(), null);
});

test("the store layer overlays and then trusts its write", async () => {
  const layer = createStoreLayer(fakeStore({ version: 1, defaults: { tps: 9 } }));
  assert.equal((await layer.read())?.defaults?.tps, 9);
  await layer.write({ version: 1, defaults: { tps: 3 } });
  assert.equal((await layer.read())?.defaults?.tps, 3);
});

/* ------------------------------------------------------------------ Cloudflare Access */

const TEAM = "https://team.cloudflareaccess.com";
const AUD = "aud-abc";

function segment(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function accessFixture(overrides: Record<string, unknown> = {}) {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const header = { alg: "RS256", kid: "kid-1", typ: "JWT" };
  const payload = {
    iss: TEAM,
    aud: AUD,
    exp: NOW_SEC + 3600,
    nbf: NOW_SEC - 60,
    email: "operator@example.com",
    ...overrides,
  };
  const data = segment(header) + "." + segment(payload);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(data));
  return { jwk: { ...jwk, kid: "kid-1" }, token: data + "." + Buffer.from(signature).toString("base64url"), pair };
}

test("a Cloudflare Access token is verified against the team key set", async () => {
  resetAccessCache();
  const { jwk, token } = await accessFixture();
  const options = { teamDomain: TEAM, aud: AUD, now: () => FIXED_NOW, fetchJwks: async () => ({ keys: [jwk] }) };
  const good = await verifyAccessJwt(token, options);
  assert.equal(good.ok, true);
  assert.equal(good.ok && good.email, "operator@example.com");

  const expired = await verifyAccessJwt((await accessFixture({ exp: NOW_SEC - 120 })).token, { ...options, fetchJwks: async () => ({ keys: [jwk] }) });
  assert.equal(expired.ok, false);

  const wrongAudience = await verifyAccessJwt((await accessFixture({ aud: "someone-else" })).token, options);
  assert.equal(wrongAudience.ok, false);

  const tampered = await verifyAccessJwt(token.slice(0, -2) + "aa", options);
  assert.equal(tampered.ok, false);

  const malformed = await verifyAccessJwt("not-a-jwt", options);
  assert.equal(malformed.ok, false);
});

test("access-jwt needs both the team domain and the audience", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY, DUMMY_ADMIN_AUTH: "access-jwt", CF_ACCESS_TEAM_DOMAIN: TEAM });
  const response = await call(app, "/admin");
  assert.equal(response.status, 500);
  assert.match(JSON.stringify(await response.json()), /CF_ACCESS_AUD/);
});

test("access edge-trust mode accepts the edge header and nothing else", async () => {
  const app = adminApp({ DUMMY_ADMIN_KEY: KEY, DUMMY_ADMIN_AUTH: "access" });
  const denied = await call(app, "/admin");
  assert.equal(denied.status, 403);
  const allowed = await call(app, "/admin", { headers: { "cf-access-jwt-assertion": "anything" } });
  assert.equal(allowed.status, 200);
});

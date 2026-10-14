/**
 * Two languages, one dictionary, no build step.
 *
 * The rule that keeps this honest: every string the server renders comes from here, and the language
 * is resolved from the URL (`?lang=`), then a cookie, then Accept-Language, then English. Nothing is
 * guessed from the browser at runtime, and switching language is a link - the same URL works for
 * everybody, including someone who never runs JavaScript.
 */

export type Lang = "en" | "zh";
export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "dummy_lang";
export const LANG_MAX_AGE = 60 * 60 * 24 * 365;

const EN = {
  "lang.other": "中文",
  "lang.label": "Language",

  "nav.demo": "Demo",
  "nav.protocols": "Protocols",
  "nav.models": "Models",
  "nav.admin": "Admin",
  "nav.source": "Source",

  "hero.tagline": "A fake LLM server that repeats whatever you send — or answers with a template of your own.",
  "hero.sub": "It streams in the exact wire format of OpenAI, Anthropic, Gemini and Ollama, byte for byte. Zero runtime dependencies.",
  "hero.chip.protocols": "4 protocols",
  "hero.chip.deps": "0 dependencies",
  "hero.chip.deterministic": "deterministic",

  "install.title": "Run it",
  "install.sub": "Any of these gives you the same server. Point an SDK at it and change nothing else.",
  "install.curl.note": "From source. Node 22.18+ runs the TypeScript directly, no build.",
  "install.npm.note": "The published package, once you have it.",
  "install.docker.note": "Or build the image straight from the repository.",
  "install.workers.note": "Cloudflare Workers, no cold start. Bring your own domain.",

  "demo.title": "Try it",
  "demo.sub": "This really calls the API — the same endpoint a client would use, streamed back as it arrives.",
  "demo.editor": "Edit the reply template",
  "demo.editorHint": "Whatever you write here answers your next message and is then forgotten. Nothing is stored. The address bar keeps a copy, so you can share this exact demonstration as a link.",
  "demo.limits": "Templates are limited to 2000 characters and answers to 100000.",
  "demo.input": "Your message",
  "demo.send": "Send",
  "demo.empty": "Type anything. It will think about it, then say it back.",
  "demo.thinking": "thinking",
  "demo.answer": "answer",
  "demo.visitor": "Reply template supplied by you, the visitor — not by this site's owner.",
  "demo.format": "What you can write here",
  "demo.httpError": "HTTP {status} — check DUMMY_API_KEY",
  "demo.networkError": "The request failed. Is the server still running?",
  "demo.copy": "Copy",
  "demo.copied": "Copied",

  "proto.title": "Endpoints",
  "proto.sub": "Unknown routes answer 404 in the shape of the protocol you were speaking, so error handling gets tested too.",
  "proto.col.protocol": "Protocol",
  "proto.col.endpoint": "Endpoints",
  "proto.col.note": "Notes",
  "proto.openai.note": "Chat, legacy completions, embeddings, models",
  "proto.anthropic.note": "Real thinking blocks with a closing signature_delta",
  "proto.gemini.note": "thought: true parts",
  "proto.ollama.note": "NDJSON, message.thinking",
  "proto.other.note": "Health check, the admin surface, this page",

  "models.title": "Models",
  "models.sub": "Every advertised id is a persona: the model a client sends picks how the answer is written. Any other id falls through to the server's own reply.",
  "models.col.id": "Model id",
  "models.col.behaviour": "Behaviour",

  "foot.license": "MIT licensed",
  "foot.security": "Security notes",
  "foot.admin": "Admin",
  "foot.note": "Not affiliated with OpenAI, Anthropic or Google. Protocol shapes are reproduced for interoperability and testing only.",

  "help.placeholders": "Placeholders — anything else is passed through as written.",
  "help.input": "the cleaned-up user message — normally the one you want",
  "help.raw": "the same message before harness noise is stripped out",
  "help.reply": "the answer being generated right now (useful in a thinking template)",
  "help.model": "the model id the client asked for",
  "help.text": "the template itself",
  "help.filters": "Filters chain onto a placeholder with",
  "help.filters.arg": "Four of them take a number:",
  "help.shapes": "A reply value can have three shapes — the shape is the behaviour:",
  "help.shape.one": "one template:",
  "help.shape.pool": "a pool, drawn at random:",
  "help.shape.keys": "a keyword map, where \"*\" is the fallback:",
  "help.note": "An unknown placeholder is left alone and an unknown filter is ignored, so a typo shows up in the answer instead of breaking anything.",
  "help.thinking": "A thinking template may use {reply}; a reply template may not.",
} as const;

export type MessageKey = keyof typeof EN;

const ZH: Record<MessageKey, string> = {
  "lang.other": "English",
  "lang.label": "语言",

  "nav.demo": "演示",
  "nav.protocols": "接口",
  "nav.models": "模型",
  "nav.admin": "管理",
  "nav.source": "源码",

  "hero.tagline": "一个假的大模型服务：你说什么它就复读什么，或者按你自己写的模板回答。",
  "hero.sub": "它按 OpenAI、Anthropic、Gemini、Ollama 的真实线格式逐字节流式返回。零运行时依赖。",
  "hero.chip.protocols": "4 种协议",
  "hero.chip.deps": "0 个依赖",
  "hero.chip.deterministic": "可复现",

  "install.title": "跑起来",
  "install.sub": "下面任意一种都能得到同一个服务。把 SDK 指过来，其余都不用改。",
  "install.curl.note": "从源码跑。Node 22.18+ 可直接执行 TypeScript，无需构建。",
  "install.npm.note": "发布后的 npm 包。",
  "install.docker.note": "或者直接从仓库构建镜像。",
  "install.workers.note": "Cloudflare Workers，无冷启动。域名自己挂。",

  "demo.title": "试一下",
  "demo.sub": "这里真的在调 API——和客户端用的是同一个端点，逐帧流式返回。",
  "demo.editor": "编辑回复模板",
  "demo.editorHint": "你写在这里的内容只用于你的下一条消息，之后就被忘掉，什么都不会存储。地址栏会保留一份，所以这个演示本身可以当链接分享。",
  "demo.limits": "模板上限 2000 字符，回答上限 100000 字符。",
  "demo.input": "你的消息",
  "demo.send": "发送",
  "demo.empty": "随便输入点什么。它会先想一想，然后说回来。",
  "demo.thinking": "思考",
  "demo.answer": "回答",
  "demo.visitor": "这条回答的模板由访客（你）提供，不是本站运营者。",
  "demo.format": "这里能写什么",
  "demo.httpError": "HTTP {status} —— 检查 DUMMY_API_KEY",
  "demo.networkError": "请求失败了。服务还在跑吗？",
  "demo.copy": "复制",
  "demo.copied": "已复制",

  "proto.title": "接口",
  "proto.sub": "未知路径会按你正在使用的协议格式返回 404，顺带把你的错误处理也测了。",
  "proto.col.protocol": "协议",
  "proto.col.endpoint": "端点",
  "proto.col.note": "说明",
  "proto.openai.note": "Chat、旧版 completions、embeddings、models",
  "proto.anthropic.note": "真正的 thinking block，带收尾的 signature_delta",
  "proto.gemini.note": "thought: true 的 Part",
  "proto.ollama.note": "NDJSON，message.thinking",
  "proto.other.note": "健康检查、管理页、本页",

  "models.title": "模型",
  "models.sub": "每个列出的 id 都是一个 persona：客户端发来的 model 决定回答怎么写。其他任何 id 都会落回服务端自己的 reply。",
  "models.col.id": "模型 id",
  "models.col.behaviour": "行为",

  "foot.license": "MIT 许可",
  "foot.security": "安全说明",
  "foot.admin": "管理页",
  "foot.note": "本项目与 OpenAI、Anthropic、Google 无关联。协议格式仅用于互操作与测试。",

  "help.placeholders": "占位符 —— 其他内容一律原样保留。",
  "help.input": "清洗过的用户消息——通常你就想用这个",
  "help.raw": "同样这条消息，但还没剥离框架噪声",
  "help.reply": "正在生成的回答（写在思考模板里最有用）",
  "help.model": "客户端请求的模型 id",
  "help.text": "模板本身",
  "help.filters": "过滤器用这个符号串在占位符后面：",
  "help.filters.arg": "其中四个要带数字：",
  "help.shapes": "一个 reply 值可以是三种形状之一——形状就是行为：",
  "help.shape.one": "一个模板：",
  "help.shape.pool": "一个池子，随机抽一条：",
  "help.shape.keys": "关键词映射，\"*\" 是兜底：",
  "help.note": "未知占位符原样保留、未知过滤器直接忽略，所以打错字只会体现在回答里，不会把服务弄坏。",
  "help.thinking": "思考模板里可以用 {reply}；回复模板里不行。",
};

const TABLES: Record<Lang, Record<MessageKey, string>> = { en: EN, zh: ZH };

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "zh";
}

export function dict(lang: Lang): Record<MessageKey, string> {
  return TABLES[lang] ?? TABLES[DEFAULT_LANG];
}

export function t(lang: Lang, key: MessageKey): string {
  return dict(lang)[key];
}

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at === -1) continue;
    if (part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return null;
}

/** Accept-Language, reduced to the one bit we care about: does Chinese come first? */
function prefersChinese(header: string | null): boolean {
  if (!header) return false;
  for (const entry of header.split(",")) {
    const tag = entry.split(";")[0].trim().toLowerCase();
    if (tag === "" || tag === "*") continue;
    if (tag.startsWith("zh")) return true;
    return false; // the first real preference is not Chinese
  }
  return false;
}

export function resolveLang(request: Request, url: URL, fallback: Lang = DEFAULT_LANG): Lang {
  const fromQuery = url.searchParams.get("lang");
  if (isLang(fromQuery)) return fromQuery;
  const fromCookie = cookieValue(request.headers.get("cookie"), LANG_COOKIE);
  if (isLang(fromCookie)) return fromCookie;
  if (prefersChinese(request.headers.get("accept-language"))) return "zh";
  return fallback;
}

export function langCookie(value: Lang): string {
  return LANG_COOKIE + "=" + value + "; Path=/; Max-Age=" + LANG_MAX_AGE + "; SameSite=Lax";
}

/**
 * The switch is two links, so it works with JavaScript disabled and leaves the language in the URL.
 * The server remembers the choice in a cookie when it sees `?lang=`.
 */
export function langSwitch(lang: Lang, path: string): string {
  const target: Lang = lang === "zh" ? "en" : "zh";
  const href = path + "?lang=" + target;
  return (
    '<div class="lang" role="group" aria-label="' + t(lang, "lang.label") + '">' +
    '<span class="lang-now" aria-current="true">' + (lang === "zh" ? "中文" : "EN") + "</span>" +
    '<a class="lang-other" href="' + href + '" rel="nofollow">' + t(lang, "lang.other") + "</a>" +
    "</div>"
  );
}

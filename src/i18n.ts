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
  "demo.placeholder": "Type anything…",
  "demo.try": "Or start with one of these",
  "demo.ex1": "hello",
  "demo.ex2": "Repeat after me: a rubber duck",
  "demo.ex3": "Are you a language model?",
  "demo.ex4": "Explain relativity in four words",
  "demo.thinking": "thinking",
  "demo.answer": "answer",
  "demo.visitor": "Reply template supplied by you, the visitor — not by this site's owner.",
  "demo.format": "What you can write here",
  "hero.chip.sse": "byte-exact SSE",
  "hero.chip.mock": "mock server",
  "demo.model": "Answering as",
  "demo.stats.prompt": "prompt ≈ {n} tok",
  "demo.stats.after": "prompt {p} · completion {c} · {tps} tok/s",
  "demo.templateWins": "your template answers — the model picker is ignored",
  "term.label": "Terminal",
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
  "models.col.model": "Model",
  "models.col.best": "Best for",
  "models.col.context": "Context",
  "models.col.speed": "Output speed",
  "models.col.price": "Price (per million tokens)",
  "models.speed": "{tps} tok/s",
  "models.price": "in ¥0 · out ¥0",
  "models.note": "Context, speed and price are set dressing — the server keeps none of them. Speed is the one real number here, and it comes from DUMMY_TPS.",

  "bench.title": "Benchmarks",
  "bench.sub": "Invented from the model id, and identical on every reload. That is the only kind of reproducible result a fake model can offer.",
  "bench.dim.echo": "Echo fidelity",
  "bench.dim.thinking": "Theatre of thinking",
  "bench.dim.nonsense": "Deadpan nonsense",
  "bench.dim.pedantry": "Byte-exact pedantry",
  "bench.note": "Fictional benchmarks for a fictional model. A perfect score is 100.",

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

  "admin.title": "Admin",
  "admin.chip.auth": "auth",
  "admin.chip.store": "store",
  "admin.chip.version": "version",
  "admin.signout": "Sign out",
  "admin.readonlyWord": "read-only",
  "admin.loading": "Loading the current configuration…",
  "admin.loadFailed": "Could not load the configuration.",
  "admin.retry": "Retry",
  "admin.readonly": "Read-only: this deployment has no store, so nothing here can be saved. Set DUMMY_STORE=kv on Cloudflare (with a KV namespace bound as DUMMY_ADMIN_KV) or DUMMY_STORE=file:./data on a server, then reload.",
  "admin.publicPage": "the public page",
  "admin.foot": "the admin edits the store only; the environment and the deployment shape stay with the operator.",

  "admin.personas": "Personas",
  "admin.new": "New",
  "admin.newPlaceholder": "dummy-new-1",
  "admin.source.builtin": "builtin",
  "admin.source.env": "env",
  "admin.source.store": "store",
  "admin.source.deleted": "deleted",

  "admin.editor": "Persona editor",
  "admin.id": "id",
  "admin.shape": "reply shape — the shape is the behaviour",
  "admin.shape.one": "one template",
  "admin.shape.pool": "a pool, one entry per line",
  "admin.shape.keys": "keyword map, \"key = template\" per line",
  "admin.reply": "reply",
  "admin.thinking": "thinking — one per line, empty means no reasoning channel",
  "admin.description": "description",
  "admin.save": "Save persona",
  "admin.revert": "Revert",
  "admin.delete": "Delete",
  "admin.format": "Format reference — placeholders, filters and the three reply shapes",
  "admin.note.builtin": "Coming from the {source} layer. Saving writes an override into the store; the original stays untouched.",
  "admin.note.store": "Overridden by the store. Saving writes this draft; the environment copy stays where it is.",
  "admin.note.deleted": "This persona is deleted by the store. Saving it again restores it.",
  "admin.defaultEntry": "Default (any unmatched model id)",
  "admin.note.default": "This is the fallback: it answers when a client sends a model id that no persona matches. Nothing else changes.",
  "admin.resetDefault": "Reset the default reply and thinking to the environment values?",

  "admin.defaults": "Defaults",
  "admin.defaults.sub": "resolved as store > environment > built-in",
  "admin.col.setting": "setting",
  "admin.col.environment": "environment",
  "admin.col.stored": "stored",
  "admin.col.effective": "effective",
  "admin.col.value": "value",
  "admin.reset": "Reset",
  "admin.saveDefaults": "Save changed defaults",
  "admin.dropStore": "Drop the whole store",

  "admin.preview": "Live preview",
  "admin.preview.sub": "this runs the real engine",
  "admin.preview.input": "Message to preview",
  "admin.preview.run": "Run",
  "admin.preview.empty": "Nothing previewed yet.",
  "admin.preview.defaults": "defaults (an unknown model id)",
  "admin.preview.model": "Answering as",

  "admin.packs": "Packs",
  "admin.packs.sub": "install, tweak, export, share",
  "admin.packs.url": "or paste a pack URL — the browser fetches it, this server never does",
  "admin.packs.fetch": "Fetch",
  "admin.packs.json": "pack JSON",
  "admin.packs.diff": "Preview diff",
  "admin.packs.apply": "Apply",
  "admin.packs.export": "Export store as a pack",
  "admin.packs.about": "A pack is a small JSON document: a few personas plus some defaults. Fetch one from the list above, or paste a URL or the JSON itself, look at the diff, then apply it.",
  "admin.packs.fetchTitle": "Fetch {file} and show what it would change",
  "pack.shout.name": "Shout",
  "pack.shout.desc": "Repeats your message in capitals, inside a box.",
  "pack.mirror.name": "Mirror",
  "pack.mirror.desc": "One persona reverses you; the other answers from a keyword map.",
  "pack.shrug.name": "Shrug",
  "pack.shrug.desc": "One answer for everything, with a quieter thinking pool.",

  "msg.saved": "Saved {id}.",
  "msg.confirmDelete": "Delete {id}? A built-in persona is hidden with a tombstone; the environment copy stays where it is.",
  "msg.deleted": "Deleted {id}.",
  "msg.nothingChanged": "Nothing changed.",
  "msg.defaultReset": "The default reply and thinking are back to the environment values.",
  "msg.savedDefaults": "Saved {count} default(s). Only the fields you changed were written.",
  "msg.resetOne": "Reset {key} to the environment value.",
  "msg.confirmReset": "Drop the whole stored document? Personas and defaults go back to the environment.",
  "msg.storeDropped": "The store is empty again.",
  "msg.badId": "A persona id may use letters, digits, dot, dash and underscore.",
  "msg.pickPersona": "Pick a persona first.",
  "msg.newPersona": "New persona {id} — edit it and press Save persona.",
  "msg.exported": "Exported the stored document into the box above.",
  "msg.packApplied": "Pack applied.",
  "msg.packPreview": "Preview only — nothing was written.",
  "msg.fetching": "Fetching {url} …",
  "msg.fetched": "Fetched. Press Preview diff to see what it would change.",
  "msg.pasteFirst": "Paste a pack first, or fetch one from the list.",
  "msg.confirmApply": "Apply this pack to the store?",
  "msg.nothingToChange": "nothing would change",

  "login.intro": "This deployment exposes a private configuration page. Sign in with the admin key. The key is compared in constant time and never stored in the browser: what comes back is a signed session cookie carrying only an expiry and an HMAC.",
  "login.key": "Admin key",
  "login.submit": "Sign in",
  "login.note": "This form works without JavaScript. Failed attempts are throttled per address.",
  "login.badKey": "That key was not correct. Failed attempts are throttled per address.",
  "login.throttled": "Too many failed attempts. Wait a few minutes and try again.",

  "denied.title": "Access required",
  "denied.body": "This deployment authenticates the admin page with Cloudflare Access, and this request did not arrive with a valid Access identity.",
  "denied.hint": "If you are the operator: sign in through the Access application (a fresh navigation normally redirects you there), then reload this page. Refusals are logged with the exact check that failed, so read them with npx wrangler tail dummy-llm — a team domain or an audience tag that no longer matches the application is the usual cause.",
} as const;

export type MessageKey = keyof typeof EN;

const ZH: Record<MessageKey, string> = {
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
  "demo.placeholder": "随便输入点什么…",
  "demo.try": "或者从这几句开始",
  "demo.ex1": "你好",
  "demo.ex2": "跟我念：一只橡皮鸭",
  "demo.ex3": "你是语言模型吗？",
  "demo.ex4": "用四个字解释相对论",
  "demo.thinking": "思考",
  "demo.answer": "回答",
  "demo.visitor": "这条回答的模板由访客（你）提供，不是本站运营者。",
  "demo.format": "这里能写什么",
  "hero.chip.sse": "逐字节 SSE",
  "hero.chip.mock": "mock 服务",
  "demo.model": "由谁回答",
  "demo.stats.prompt": "输入 ≈ {n} tok",
  "demo.stats.after": "输入 {p} · 输出 {c} · {tps} tok/s",
  "demo.templateWins": "模板正在生效，模型选择被忽略",
  "term.label": "终端",
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
  "models.col.model": "模型",
  "models.col.best": "适合",
  "models.col.context": "上下文",
  "models.col.speed": "输出速度",
  "models.col.price": "价格（每百万 tokens）",
  "models.speed": "{tps} tokens/秒",
  "models.price": "输入 ¥0 · 输出 ¥0",
  "models.note": "上下文、速度和价格都是布景——服务端一个都不记录。速度是这里唯一真实的数字，来自 DUMMY_TPS。",

  "bench.title": "评测表现",
  "bench.sub": "按模型 id 编出来的，刷新多少次都一样。假模型能提供的可复现结果，也就这一种。",
  "bench.dim.echo": "复读保真度",
  "bench.dim.thinking": "思考的仪式感",
  "bench.dim.nonsense": "一本正经地胡说",
  "bench.dim.pedantry": "逐字节的洁癖",
  "bench.note": "虚构评测，仅用于这个虚构模型。满分 100。",

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

  "admin.title": "管理",
  "admin.chip.auth": "鉴权",
  "admin.chip.store": "存储",
  "admin.chip.version": "版本",
  "admin.signout": "退出",
  "admin.readonlyWord": "只读",
  "admin.loading": "正在加载当前配置…",
  "admin.loadFailed": "没能加载配置。",
  "admin.retry": "重试",
  "admin.readonly": "只读：这个部署没有存储层，所以这里什么都存不下来。在 Cloudflare 上设 DUMMY_STORE=kv（并绑定名为 DUMMY_ADMIN_KV 的 KV namespace），或在服务器上设 DUMMY_STORE=file:./data，然后刷新。",
  "admin.publicPage": "公开页面",
  "admin.foot": "管理页只改存储层；环境变量和部署形态仍然由运维者掌握。",

  "admin.personas": "Persona",
  "admin.new": "新建",
  "admin.newPlaceholder": "dummy-new-1",
  "admin.source.builtin": "内置",
  "admin.source.env": "环境",
  "admin.source.store": "存储",
  "admin.source.deleted": "已删除",

  "admin.editor": "Persona 编辑器",
  "admin.id": "id",
  "admin.shape": "reply 形状 —— 形状就是行为",
  "admin.shape.one": "一个模板",
  "admin.shape.pool": "一个池子，每行一条",
  "admin.shape.keys": "关键词映射，每行 \"key = 模板\"",
  "admin.reply": "reply",
  "admin.thinking": "thinking —— 每行一条，留空表示不要推理通道",
  "admin.description": "描述",
  "admin.save": "保存 persona",
  "admin.revert": "还原本页",
  "admin.delete": "删除",
  "admin.format": "格式说明 —— 占位符、过滤器和三种 reply 形状",
  "admin.note.builtin": "来自{source}层。保存会写一条覆盖进存储层，原来那份不动。",
  "admin.note.store": "已被存储层覆盖。保存写入当前草稿；环境层那份留在原处。",
  "admin.note.deleted": "这个 persona 被存储层删除了。再保存一次即可恢复。",
  "admin.defaultEntry": "默认（未匹配的 model id）",
  "admin.note.default": "这是兜底：当客户端发来的 model id 没有被任何 persona 匹配时，用它回答。其余什么都不变。",
  "admin.resetDefault": "把默认回复和默认思考恢复成环境变量值？",

  "admin.defaults": "默认值",
  "admin.defaults.sub": "解析顺序：存储层 > 环境层 > 内置默认",
  "admin.col.setting": "设置项",
  "admin.col.environment": "环境变量",
  "admin.col.stored": "存储层",
  "admin.col.effective": "生效值",
  "admin.col.value": "修改",
  "admin.reset": "重置",
  "admin.saveDefaults": "保存改动过的默认值",
  "admin.dropStore": "清空整个存储层",

  "admin.preview": "实时预览",
  "admin.preview.sub": "跑的是真引擎",
  "admin.preview.input": "要预览的消息",
  "admin.preview.run": "运行",
  "admin.preview.empty": "还没预览过。",
  "admin.preview.defaults": "默认值（用一个不存在的 model id）",
  "admin.preview.model": "由谁回答",

  "admin.packs": "Packs",
  "admin.packs.sub": "安装、微调、导出、分享",
  "admin.packs.url": "或者粘贴一个 pack 的 URL —— 由浏览器去抓，服务端从不外发请求",
  "admin.packs.fetch": "抓取",
  "admin.packs.json": "pack JSON",
  "admin.packs.diff": "预览差异",
  "admin.packs.apply": "应用",
  "admin.packs.export": "导出存储层为 pack",
  "admin.packs.about": "一个 pack 就是一小段 JSON：几个 persona 加一些默认值。可以从上面列表里抓一个，或者粘贴 URL / JSON，先看差异，再应用。",
  "admin.packs.fetchTitle": "抓取 {file} 并展示它会改什么",
  "pack.shout.name": "大喊",
  "pack.shout.desc": "把你说的话转成大写，装进一个方框里。",
  "pack.mirror.name": "镜像",
  "pack.mirror.desc": "一个 persona 把你倒着说，另一个用关键词映射回答。",
  "pack.shrug.name": "耸肩",
  "pack.shrug.desc": "所有问题都只有一句回答，思考模板也更安静。",

  "msg.saved": "已保存 {id}。",
  "msg.confirmDelete": "删除 {id}？内置 persona 会用一个墓碑隐藏起来，环境层那份不动。",
  "msg.deleted": "已删除 {id}。",
  "msg.nothingChanged": "没有任何改动。",
  "msg.defaultReset": "默认回复和思考已恢复成环境变量值。",
  "msg.savedDefaults": "已保存 {count} 项默认值，只有你改过的字段被写入。",
  "msg.resetOne": "已把 {key} 重置为环境变量值。",
  "msg.confirmReset": "清空整个存储文档？persona 和默认值都会回到环境层。",
  "msg.storeDropped": "存储层已清空。",
  "msg.badId": "persona id 只能用字母、数字、点、短横线和下划线。",
  "msg.pickPersona": "先选一个 persona。",
  "msg.newPersona": "新 persona {id} —— 编辑后按「保存 persona」。",
  "msg.exported": "已把存储文档导出到上面的框里。",
  "msg.packApplied": "pack 已应用。",
  "msg.packPreview": "只是预览 —— 什么都没写入。",
  "msg.fetching": "正在抓取 {url} …",
  "msg.fetched": "抓到了。按「预览差异」看它会改什么。",
  "msg.pasteFirst": "先粘贴一个 pack，或从列表里抓一个。",
  "msg.confirmApply": "把这个 pack 应用到存储层？",
  "msg.nothingToChange": "没有任何变化",

  "login.intro": "这个部署暴露了一个私有配置页。用管理密钥登录即可。密钥以常数时间比较，且从不存进浏览器：返回的只是一个带过期时间和 HMAC 的签名会话 Cookie。",
  "login.key": "管理密钥",
  "login.submit": "登录",
  "login.note": "这个表单不依赖 JavaScript。登录失败会按地址限速。",
  "login.badKey": "密钥不对。失败次数会按地址限速。",
  "login.throttled": "失败次数过多。等几分钟再试。",

  "denied.title": "需要通过 Access",
  "denied.body": "这个部署用 Cloudflare Access 认证管理页，而这次请求没有带着有效的 Access 身份进来。",
  "denied.hint": "如果你是运维者：走 Access 应用登录一次（正常刷新页面会被自动跳过去），再回到这一页。每次拒绝都会记下具体是哪一项没过，用 npx wrangler tail dummy-llm 就能看到 —— 通常是团队域名或 AUD 和当前应用对不上了。",
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

/** Each name is written in its own language: you should not have to read English in order to leave it. */
const LANG_NAMES: Record<Lang, string> = { en: "English", zh: "中文" };

/**
 * The switch is a menu of links inside a <details>, so it opens with JavaScript disabled and still
 * leaves the language in the URL. The server remembers the choice in a cookie when it sees `?lang=`.
 * Nothing here is translated: a language list that only appears in the language you cannot read is
 * the one menu that has to be in every language at once.
 */
export function langSwitch(lang: Lang, path: string): string {
  const item = (value: Lang) =>
    '<li role="none"><a role="menuitemradio" aria-checked="' + (value === lang ? "true" : "false") + '"' +
    (value === lang ? ' class="on"' : "") +
    ' hreflang="' + value + '" lang="' + value + '" rel="nofollow" href="' + path + "?lang=" + value + '">' +
    '<span class="name">' + LANG_NAMES[value] + "</span>" +
    '<span class="check" aria-hidden="true">\u2713</span>' +
    "</a></li>";
  return (
    '<details class="lang">' +
    '<summary aria-haspopup="menu" aria-label="' + t(lang, "lang.label") + '">' +
    '<span class="name">' + LANG_NAMES[lang] + "</span>" +
    '<span class="chev" aria-hidden="true">\u2304</span>' +
    "</summary>" +
    '<ul class="lang-menu" role="menu">' + item("en") + item("zh") + "</ul>" +
    "</details>"
  );
}

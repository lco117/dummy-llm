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
  "theme.toLight": "Switch to the light theme",
  "theme.toDark": "Switch to the dark theme",

  "nav.demo": "Demonstration",
  "nav.protocols": "Endpoints",
  "nav.models": "Models",
  "nav.admin": "Administration",
  "nav.source": "Source code",

  "hero.tagline": "A test server that returns the message it has received, or a reply produced from a template that you write.",
  "hero.sub": "Responses are sent in the exact formats used by OpenAI, Anthropic, Gemini and Ollama. The server holds no state between requests, and the package has no runtime dependencies.",
  "hero.chip.protocols": "Four protocols",
  "hero.chip.deps": "No runtime dependencies",
  "hero.chip.deterministic": "deterministic",

  "install.title": "Installation",
  "install.sub": "Each command starts the same server. Configure an SDK to send requests to the address that the server prints; no other change is required.",
  "install.curl.note": "Runs from source. Node.js 22.18 or later executes the TypeScript files directly, so no build step is required.",
  "install.npm.note": "Runs the package published on the npm registry.",
  "install.docker.note": "Builds a container image from the repository.",
  "install.workers.note": "Deploys to Cloudflare Workers. The domain name is supplied by the operator.",

  "demo.title": "Demonstration",
  "demo.sub": "The form sends a real request to the same endpoint that an SDK uses, and displays the response as it arrives.",
  "demo.editor": "Edit the reply template",
  "demo.editorHint": "The template entered here is used for the next message only, and is not stored on the server. The browser address bar keeps a copy, so this exact demonstration can be shared as a link.",
  "demo.limits": "A template is limited to 2000 characters, and a reply to 100000 characters.",
  "demo.input": "Your message",
  "demo.send": "Send",
  "demo.placeholder": "Enter a message",
  "demo.try": "Select one of these messages",
  "demo.ex1": "你好",
  "demo.ex2": "How are you?",
  "demo.visitor": "The reply template for this message was supplied by the visitor, not by the operator of this server.",
  "demo.format": "Template reference",
  "hero.chip.sse": "Streaming responses",
  "hero.chip.mock": "Mock server",
  "demo.model": "Answer profile",
  "demo.default": "default",
  "demo.defaultNote": "(the reply configured on the server)",
  "demo.stats.prompt": "Approximate input length: {n} tok",
  "demo.stats.after": "Input: {p} tok · Output: {c} tok · {tps} tok/s",
  "demo.templateWins": "The reply template is in use, so the selected answer profile is ignored",
  "term.label": "Terminal",
  "demo.httpError": "The server returned HTTP status {status}. Check the value of DUMMY_API_KEY.",
  "demo.networkError": "The request did not complete. Confirm that the server is still running.",
  "demo.copy": "Copy",
  "demo.copied": "Copied",
  "chat.thinking": "Thinking… {n}s",
  "chat.thought": "Thought for {n}s",

  "proto.title": "Endpoints",
  "proto.sub": "A request to an unknown path returns HTTP status 404 in the format of the protocol that the request used, so error handling can be tested as well.",
  "proto.col.protocol": "Protocol",
  "proto.col.endpoint": "Endpoint",
  "proto.col.note": "Notes",
  "proto.openai.note": "Chat, completions, responses, embeddings and model listing",
  "proto.anthropic.note": "Thinking blocks, closed by a signature_delta event",
  "proto.gemini.note": "Parts marked with thought: true",
  "proto.ollama.note": "Newline-delimited JSON, with the reasoning text in message.thinking",
  "proto.other.note": "Health check, administration pages, this page",

  "models.title": "Models",
  "models.sub": "Each identifier selects one answer profile. A request that names any other identifier receives the reply configured on the server.",
  "persona.dummy-echo-1": "Returns the message that the server received, preceded by a fixed reasoning message.",
  "persona.definitely-not-a-model": "Returns one of ten messages stating that this server is not a language model.",
  "models.col.model": "Model",
  "models.col.best": "Purpose",
  "models.col.context": "Context window",
  "models.col.speed": "Output speed",
  "models.col.price": "Price per million tok",
  "models.speed": "{tps} tok/s",
  "models.price": "¥0 to send · ¥0 to receive",
  "models.note": "The context window and the price are illustrative values that the server does not use. The output speed is the configured streaming rate, taken from DUMMY_TPS or from the answer profile.",

  "bench.title": "Benchmark scores",
  "bench.sub": "The scores are fixed values defined by this project, not measurements. The middle row is invented outright; the other two are read off the model id, which is invented too.",
  "bench.dim.humor": "humor-bench-4 (comedic response quality)",
  "bench.dim.verbatim": "verbatim-fidelity-1 (invented here)",
  "bench.dim.capacity": "long-context-capacity (window size)",
  "bench.note": "The benchmark names are used for the demonstration only, and the scores are not measurements. A perfect score is 100.",

  "foot.license": "MIT licensed",
  "foot.security": "Security notes",
  "foot.admin": "Admin",
  "foot.note": "This project is not affiliated with OpenAI, Anthropic or Google. The response formats are reproduced for interoperability testing only.",

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
  "admin.tps": "tokens/s — empty follows DUMMY_TPS",
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
  "pack.snackDragon.name": "Snack dragon",
  "pack.snackDragon.desc": "A small yellow dragon: every question gets 哇塞, a snack, or a very confident no idea.",

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
  "theme.toLight": "切换到浅色主题",
  "theme.toDark": "切换到深色主题",

  "nav.demo": "演示",
  "nav.protocols": "接口",
  "nav.models": "模型",
  "nav.admin": "管理",
  "nav.source": "源代码",

  "hero.tagline": "一个测试用的服务器：收到什么消息就返回什么消息，或者根据你写的模板生成回复。",
  "hero.sub": "响应按照 OpenAI、Anthropic、Gemini 和 Ollama 使用的真实格式发送。服务器不在请求之间保存状态，安装包也没有运行时依赖。",
  "hero.chip.protocols": "支持四种协议",
  "hero.chip.deps": "没有运行时依赖",
  "hero.chip.deterministic": "可复现",

  "install.title": "安装",
  "install.sub": "每一条命令都会启动同一个服务器。把 SDK 的请求地址指向服务器打印出来的地址即可，不需要其他修改。",
  "install.curl.note": "从源代码运行。Node.js 22.18 及以上版本可以直接执行 TypeScript 文件，不需要构建步骤。",
  "install.npm.note": "运行发布在 npm 仓库中的安装包。",
  "install.docker.note": "从代码仓库构建容器镜像。",
  "install.workers.note": "部署到 Cloudflare Workers。域名由使用者自行提供。",

  "demo.title": "演示",
  "demo.sub": "这个表单会向 SDK 使用的同一个接口发送真实请求，并在响应到达时逐段显示。",
  "demo.editor": "编辑回复模板",
  "demo.editorHint": "在这里填写的模板只用于下一条消息，服务器不会保存。浏览器地址栏会保留一份副本，因此这个演示可以当作链接分享。",
  "demo.limits": "模板最多 2000 个字符，回复最多 100000 个字符。",
  "demo.input": "你的消息",
  "demo.send": "发送",
  "demo.placeholder": "输入一条消息",
  "demo.try": "选择任意一条消息开始",
  "demo.ex1": "你好",
  "demo.ex2": "How are you?",
  "demo.visitor": "这条回复使用的模板由访客提供，不是由本服务器的运营者提供。",
  "demo.format": "模板格式说明",
  "hero.chip.sse": "流式返回",
  "hero.chip.mock": "模拟服务",
  "demo.model": "回答配置",
  "demo.default": "默认",
  "demo.defaultNote": "（服务器自身配置的回复）",
  "demo.stats.prompt": "输入长度约为 {n} tok",
  "demo.stats.after": "输入 {p} tok · 输出 {c} tok · {tps} tok/s",
  "demo.templateWins": "当前正在使用回复模板，所选的回答配置不生效",
  "term.label": "终端",
  "demo.httpError": "服务器返回了 HTTP 状态码 {status}。请检查 DUMMY_API_KEY 的取值。",
  "demo.networkError": "请求没有完成。请确认服务器仍在运行。",
  "demo.copy": "复制",
  "demo.copied": "已复制",
  "chat.thinking": "正在思考… {n} 秒",
  "chat.thought": "已思考（用时 {n} 秒）",

  "proto.title": "接口",
  "proto.sub": "请求未知路径时，服务器会按照该请求所用协议的格式返回 404 状态码，因此错误处理逻辑也可以一起测试。",
  "proto.col.protocol": "协议",
  "proto.col.endpoint": "端点",
  "proto.col.note": "说明",
  "proto.openai.note": "Chat、completions、responses、embeddings 和模型列表",
  "proto.anthropic.note": "包含 thinking 块，并以 signature_delta 事件结束",
  "proto.gemini.note": "带有 thought: true 标记的 Part",
  "proto.ollama.note": "以换行分隔的 JSON，推理文本位于 message.thinking 字段",
  "proto.other.note": "健康检查、管理页面、本页",

  "models.title": "模型",
  "models.sub": "每一个标识符都对应一种回答配置。请求使用其他标识符时，服务器会使用自身配置的回复。",
  "persona.dummy-echo-1": "返回服务器收到的消息，并在前面加上一条固定的推理消息。",
  "persona.definitely-not-a-model": "从十条消息中返回一条，说明本服务器不是语言模型。",
  "models.col.model": "模型",
  "models.col.best": "用途",
  "models.col.context": "上下文窗口",
  "models.col.speed": "输出速度",
  "models.col.price": "价格（每百万 tok）",
  "models.speed": "{tps} tok/s",
  "models.price": "输入 ¥0 · 输出 ¥0",
  "models.note": "上下文窗口和价格只是示意值，服务器并不使用。输出速度是配置的流式返回速率，取自 DUMMY_TPS 或该回答配置。",

  "bench.title": "评测分数",
  "bench.sub": "这些分数是本项目定义的固定值，不是测量结果。中间那一行是纯编的，另外两项由模型 id 算出来——而那个 id 本身也是编的。",
  "bench.dim.humor": "humor-bench-4（幽默回应质量）",
  "bench.dim.verbatim": "verbatim-fidelity-1（逐字保真度·自创）",
  "bench.dim.capacity": "long-context-capacity（上下文容量）",
  "bench.note": "评测名称仅用于演示，分数不是测量结果。满分是 100 分。",

  "foot.license": "MIT 许可",
  "foot.security": "安全说明",
  "foot.admin": "管理页",
  "foot.note": "本项目与 OpenAI、Anthropic、Google 没有关联。响应格式仅为互操作测试而重现。",

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
  "admin.tps": "tokens/秒 —— 留空跟随 DUMMY_TPS",
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
  "pack.snackDragon.name": "小吃货龙",
  "pack.snackDragon.desc": "一只黄色小恐龙：不管问什么，回答都是「哇塞」「先吃一口」，或者理直气壮的一句「不知道」。",

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

/**
 * The shipped personas carry their description in source (personas.ts), which is one language. On a
 * page that speaks two, that is a sentence in the wrong voice, so the two built-ins get a key each and
 * anything an operator added falls back to what they typed.
 */
const PERSONA_KEYS: Record<string, MessageKey> = {
  "dummy-echo-1": "persona.dummy-echo-1",
  "definitely-not-a-model": "persona.definitely-not-a-model",
};

export function personaDescription(lang: Lang, id: string, fallback: string): string {
  const key = PERSONA_KEYS[id];
  return key ? t(lang, key) : fallback;
}

export function cookieValue(header: string | null, name: string): string | null {
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

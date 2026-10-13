<div align="center">

# 🦜 parrot-llm

**一个你说什么它就说什么的"大模型"——只不过它会先"思考"一会儿。**

零运行时依赖 · 字节级精准的流式输出 · VPS / 树莓派 / Cloudflare Workers / Vercel 都能跑

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lco117/parrot-llm)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/lco117/parrot-llm&project-name=parrot-llm&repository-name=parrot-llm)

*点一下按钮、授权 Cloudflare，一分钟内 Worker 就部署好了——免费额度、无冷启动、无需构建。本模板默认**关闭** `workers.dev` 和 Preview URL，请自行绑定域名（或把 `wrangler.jsonc` 里的 `"workers_dev"` 改成 `true`）后再访问。*

</div>

---

## 这是什么

你说 `abc`，它先"思考"一下，然后回你 `abc`。

真正的重点在于：它**严格按真实厂商的线格式**回答。相同的 SSE 帧、相同的 `data: [DONE]` 哨兵、相同的 Anthropic 事件顺序、相同的 Ollama NDJSON。官方 SDK 原样接入，在读到那一个字之前根本分辨不出来。

于是它同时是两样东西：

| 你想做的事 | parrot-llm 给你的 |
| --- | --- |
| 整活：把朋友的"前沿大模型"换成鹦鹉 | 改一行配置，任何客户端直接接上 |
| 在 CI 里测 LLM 应用 | 确定性、离线、瞬时、免费的 LLM 替身 |
| 复现某个厂商的 bug | 可以 diff 的字节级 fixture |
| 测重试 / 退避逻辑 | 形状正确的 429、500，以及**流中途断流** |

## 快速开始

```bash
# 方式 A —— Docker，直接从仓库构建（无需 clone）
docker build -t parrot-llm https://github.com/lco117/parrot-llm.git
docker run --rm -p 8080:8080 -e PARROT_TEXT=6 parrot-llm

# 方式 B —— 从源码
git clone https://github.com/lco117/parrot-llm && cd parrot-llm
npm install
npm run dev              # Node 22.18+ 可直接运行 TypeScript，无需构建
# 或：npm run build && node dist/cli.js --port 8080

# 方式 C —— npm（包发布后；parrot-llm 这个名字目前没被占用）
npx parrot-llm --port 8080 --text "6"
```

然后把任何 SDK 指过来，其余都不用改：

```bash
export OPENAI_BASE_URL=http://localhost:8080/v1
export OPENAI_API_KEY=sk-parrot

export ANTHROPIC_BASE_URL=http://localhost:8080
export ANTHROPIC_API_KEY=sk-parrot

export OLLAMA_HOST=http://localhost:8080
```

```bash
curl -N http://localhost:8080/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"parrot-1","messages":[{"role":"user","content":"你是真模型吗"}],"stream":true}'
```

## 接口一览

| 协议 | 方法 | 路径 |
| --- | --- | --- |
| OpenAI Chat Completions | POST | `/v1/chat/completions` |
| OpenAI Responses | POST | `/v1/responses` |
| OpenAI 其他 | POST/GET | `/v1/completions`、`/v1/embeddings`、`/v1/models` |
| Anthropic Messages | POST | `/v1/messages`、`/v1/messages/count_tokens` |
| Gemini | POST | `/v1beta/models/{model}:generateContent` |
| Gemini 流式 | POST | `/v1beta/models/{model}:streamGenerateContent?alt=sse` |
| Ollama | GET/POST | `/api/chat`、`/api/generate`、`/api/tags`、`/api/version`、`/api/embed` |
| 健康检查 / 主页 | GET | `/healthz`、`/` |

未知路径返回的 404 会**使用你当前协议的报错结构**，顺带把你的错误处理也测了。

## 配置

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `PARROT_TEXT` | `6` | `fixed` 模式的回答模板（会替换 `{input}`、`{model}`），也是用户什么都没说时的兜底 |
| `PARROT_MODE` | `echo` | `echo`（复读用户）/ `fixed` / `random` / `canned` |
| `PARROT_ECHO_RAW` | — | 原样复读，不做任何噪声剥离 |
| `PARROT_STRIP` | — | 额外的正则（`\|` 分隔），复读前从用户消息里剔除 |
| `PARROT_CHUNK` | `4` | 每个流式片段几个字符——4 个字符约等于一个英文 token。也支持 `word` / `line` / `whole` |
| `PARROT_TPS` | `100` | 每秒输出多少 token，一个片段多大取决于 `PARROT_CHUNK`（`0` 表示不限速） |
| `PARROT_DELAY_MS` | 由 `PARROT_TPS` 换算 | 显式设置后会覆盖 `PARROT_TPS` |
| `PARROT_TTFT_MS` | `0` | 首 token 延迟 |
| `PARROT_SEED` | `1` | 让 id 和抖动可复现 |
| `PARROT_FAIL` | — | `429` / `429:after=3` / `rate_limit` |
| `PARROT_API_KEY` | — | 设置后 API 路由需要该密钥 |
| `PARROT_CORS` | `*` | 允许的跨域来源 |
| `PARROT_LOG` | `off` | `off` / `summary` / `full`，记录收到的每个请求 |
| `PARROT_MAX_BODY` | `1000000` | 超过这个字节数的请求体直接拒绝（`0` 表示不限制） |
| `PARROT_MODELS` | `parrot-1, parrot-1-mini, definitely-not-a-model` | 逗号分隔 |
| `PARROT_TOOLCALL` | — | 需要时返回固定 function call |
| `PARROT_THINKING` | 内置 10 个模板 | 硬编码的思考。用 `\|` 分隔多个模板，每次请求随机取一个；会替换 `{input}`、`{reply}`；`off` 关闭 |

全部同时是 CLI 参数：`parrot-llm --help`。

`echo` 模式复读的是最后一条**人说的**消息。但 agent 框架会把自己的噪声当成 user 消息塞进对话，
有两种：

- **带标签的块** —— `<system-reminder>Updated instructions from: AGENTS.md…</system-reminder>`
- **没有标签的元数据行** —— `Time sampled while preparing turn 1, step 1: …`、
  `Browser time zone for this request: …`、`Elapsed since the preceding model-visible message: …`

两种都会先被剥掉；如果最新那条除了噪声什么都没有，就往上找上一条真正有人话的消息。可以用
`PARROT_STRIP`（`|` 分隔的正则）加自己的规则，或者用 `--echo-raw` 全部关掉，一个字节不差地看请求体。

## 思考

它回答问题前会先"推理"——从 10 个硬编码模板里随机抽一个：

```bash
curl -s http://localhost:8080/v1/chat/completions -H 'content-type: application/json' \
  -d '{"model":"parrot-1","messages":[{"role":"user","content":"abc"}]}'
```

```json
{
  "role": "assistant",
  "content": "abc",
  "reasoning_content": "We need answer to user. User just said \"abc\". Need infer? Probably minimal. We need respond maybe \"abc\"."
}
```

各协议用**自己的原生字段**承载这段思考：

| 协议 | 思考出现的位置 |
| --- | --- |
| OpenAI Chat Completions | `delta.reasoning_content` / `message.reasoning_content`（DeepSeek、vLLM 的通行约定） |
| OpenAI Responses | 一个 `reasoning` output item，以 `response.reasoning_summary_text.delta` 流式输出 `summary_text` |
| Anthropic | 真正的 `thinking` content block：`thinking_delta` 加一个收尾的 `signature_delta` |
| Gemini | `thought: true` 的 `Part` |
| Ollama | `message.thinking` |

模式速查：

```bash
parrot-llm                             # echo   - 你说什么它说什么（默认）
parrot-llm --mode fixed --text "6"     # fixed  - 永远同一句
parrot-llm --no-thinking               # 不输出思考
```

用 `PARROT_THINKING` 改词（占位符 `{input}`、`{reply}`、`{model}`）。

## 故障注入

```bash
parrot-llm --fail 429            # 流开始前返回标准 429
parrot-llm --fail 500:after=3    # 流到第 3 帧后突然断开
parrot-llm --hang 30000          # 建连后什么都不发
```

**流中途断流**最有价值：客户端会拿到一个中途死掉的合法流，这正是让线上代码永远卡住的场景。

## 日志

`PARROT_LOG=summary` 会对每个请求打一行 JSON：路径、模型、收到几条消息，以及剥离后的最后一条用户消息。
`full` 还会带上完整请求体。

```bash
parrot-llm --log summary         # 本地
npx wrangler tail parrot-llm     # 线上 Worker 的实时日志
```

想知道"客户端到底发了什么"，这是最快的办法：

```json
{"parrot":"request","path":"/v1/chat/completions","model":"parrot-1","stream":true,"messages":2,"lastUser":"hwfaeouheaw"}
```

默认关闭；`wrangler.jsonc` 里给部署好的 Worker 开了 `summary`。

## 部署

| 目标 | 免费额度 | 流式 | 说明 |
| --- | --- | --- | --- |
| **Cloudflare Workers** | ✅ 10 万请求/天 | ✅ 原生 | 一键部署，无冷启动 |
| **自己的 VPS** | 你付 VPS | ✅ 无上限 | Docker + Caddy，正式部署 |
| **Vercel** | ✅ Hobby（非商用） | ✅ | 受函数最大时长限制 |
| **Deno Deploy** | ✅ | ✅ | 五行代码 |
| **Google Cloud Run** | ✅ 缩容到零 | ✅ | 容器，需绑卡 |

完整的复制粘贴配置、反代设置和 SSE 踩坑清单见 **[docs/deployment.md](docs/deployment.md)**。

### 不用按钮，直接命令行部署到 Workers

```bash
npx wrangler deploy        # 部署后没有公开路由，见 wrangler.jsonc
```

`wrangler.jsonc` 里设了 `workers_dev: false` 和 `preview_urls: false`，所以刚部署完还访问不了，
需要去 Cloudflare 后台（Worker → Settings → Domains & Routes）绑定域名。想要免费的
`*.workers.dev` 地址就把这两个开关改回 `true`。

为什么 Workers 特别合适：整个服务就是一个 Web `Request` → `Response` 处理器（`src/adapters/worker.ts` 只有 15 行），wrangler 直接打包 TypeScript。免费版 10ms CPU 限制也不是问题——在帧之间等待属于墙上时间，不消耗 CPU。

## 本地开发

```bash
npm install
npm run dev          # 直接以 TypeScript 运行，无需构建
npm test             # golden 字节级 fixture + 单元测试
npm run golden       # 有意修改协议后重新生成 test/golden/*.txt
npm run typecheck
npm run build        # esbuild 打包 CLI
```

架构的唯一铁律：**engine 不认识任何协议，协议模块不关心任何时间。** 新增一个厂商 = 新增一个文件。

## 安全

一句话：零运行时依赖、无安装脚本、不外发请求、不存数据、仓库里没有密钥。完整的威胁模型和
"你必须自己配的东西"见 **[docs/security.md](docs/security.md)**。

## 发布与推广

- **[docs/launch.md](docs/launch.md)** —— 广告词、可直接复制的发帖文案、投递渠道。
- **[docs/publishing.md](docs/publishing.md)** —— npm 怎么发、为什么要发，以及一条命令的发布流程。

## 许可

[MIT](LICENSE) © lco117 · English: [README.md](README.md)

本项目与 OpenAI、Anthropic、Google 无任何关联，也不代表其立场。协议名称与格式仅用于互操作与测试。

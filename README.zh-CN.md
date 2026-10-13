<div align="center">

# 🦜 parrot-llm

**一个你说什么它就说什么的"大模型"——只不过它会先"思考"一会儿。**

零运行时依赖 · 字节级精准的流式输出 · VPS / 树莓派 / Cloudflare Workers / Vercel 都能跑

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lco117/parrot-llm)

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
| `PARROT_TEXT` | `6` | 用户什么都没说时的兜底，以及 `fixed` 模式的回答 |
| `PARROT_MODE` | `echo` | `echo`（复读用户）/ `fixed` / `random` / `canned` |
| `PARROT_ECHO_RAW` | — | 原样复读，不剥离 `<system-reminder>` 块 |
| `PARROT_CHUNK` | `1` | 每帧几个字符，或 `word` / `line` / `whole` |
| `PARROT_DELAY_MS` | `20` | 帧间隔（模拟打字） |
| `PARROT_TTFT_MS` | `0` | 首 token 延迟 |
| `PARROT_SEED` | `1` | 让 id 和抖动可复现 |
| `PARROT_FAIL` | — | `429` / `429:after=3` / `rate_limit` |
| `PARROT_API_KEY` | — | 设置后 API 路由需要该密钥 |
| `PARROT_CORS` | `*` | 允许的跨域来源 |
| `PARROT_MODELS` | `parrot-1, parrot-1-mini, definitely-not-a-model` | 逗号分隔 |
| `PARROT_TOOLCALL` | — | 需要时返回固定 function call |
| `PARROT_THINKING` | 内置模板 | 硬编码的思考模板，支持 `{input}`、`{reply}` 占位符；`off` 关闭 |

全部同时是 CLI 参数：`parrot-llm --help`。

`echo` 模式复读的是最后一条**人说的**消息。但 agent 框架会把自己的噪声当成 user
消息塞进对话（比如 `<system-reminder>` 块），所以这些块会先被剥掉；如果最新那条除了噪声什么都没有，
就往上找上一条真正有人话的消息。想一个字节不差地看请求体，加 `--echo-raw`。

## 思考

它回答问题前会先"推理"——当然也是硬编码的模板：

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

## 许可

[MIT](LICENSE) © lco117 · English: [README.md](README.md)

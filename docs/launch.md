# Launch kit

Copy, paste, post. Everything here is written to be usable as-is.

## 1. Positioning

| length | English | 中文 |
| --- | --- | --- |
| one line | An LLM that says whatever you said — after thinking about it. | 一个你说什么它就说什么的「大模型」，只不过它会先认真思考一遍。 |
| list / table | A fake LLM with real wire format. | 协议说得最标准的假大模型。 |
| elevator | parrot-llm is a fake LLM server. It "thinks" using ten hardcoded templates, then repeats you. The joke is the surface; the product is a deterministic, offline, byte-exact LLM test double that speaks four provider protocols. | parrot-llm 是个假的大模型服务：先用十条硬编码模板"思考"，然后一字不差复读你。笑点是表面，真正有用的是它——确定、离线、字节级精准，还能说四家厂商的协议，可以当 CI 里的 LLM 测试替身。 |

**Never lead with "it's a joke".** Lead with the protocol fidelity, land the joke second. The
project is funny *because* it is rigorous.

## 2. Ad copy / 广告词

### English

1. An LLM that says whatever you said — after thinking about it.
2. A fake LLM with real wire format.
3. 0 parameters. 0 GPUs. 4 protocols.
4. The cheapest reasoning model ever shipped.
5. It will not write your code. It will repeat you, beautifully.
6. Byte-exact LLM responses for CI — deterministic, offline, free.
7. Your retry logic has never been tested. This fixes that.
8. A 12 KB "model" that speaks OpenAI, Anthropic, Gemini and Ollama.
9. No weights. No billed tokens. No flakiness.
10. The parrot has opinions. Its opinion is you.

### 中文

1. 你说什么，它就说什么——只不过它会先认真思考一遍。
2. 零参数、零 GPU、零依赖，四个协议全都说得很标准。
3. 最便宜的推理模型：十条硬编码思考，零张显卡。
4. 它不会帮你写代码，但复读得比谁都认真。
5. 给 CI 用的假 LLM：确定性、离线、字节级精准、不要钱。
6. 你的重试逻辑从来没被测过，它能测。
7. 一个 12KB 的「大模型」，会说 OpenAI / Anthropic / Gemini / Ollama。
8. 没有权重，不烧 token，永不 flaky。
9. 别人卷参数，它卷协议兼容性。
10. 它唯一的观点，就是你的观点。

## 3. Ready-to-paste posts

### X / Twitter

```
I built parrot-llm 🦜

An LLM that says whatever you said — after "thinking" about it.

• 0 params, 0 GPU, 0 runtime deps
• speaks OpenAI / Anthropic / Gemini / Ollama
• byte-exact SSE, so real SDKs cannot tell the difference
• one click to Cloudflare Workers

The joke is the API. The product is CI that never flakes.

https://github.com/lco117/parrot-llm
```

### Hacker News

Title:

```
Show HN: parrot-llm – a fake LLM that speaks four real protocols
```

First comment (post it yourself, immediately):

```
Author here. This started as a joke and accidentally became a testing tool.

Every team I know hand-rolls a fake LLM for CI, and they all break the same three ways: wrong SSE
framing, no `data: [DONE]` sentinel, and non-deterministic chunk boundaries.

parrot-llm treats the wire format as the product:

- byte-exact frames for OpenAI Chat Completions, OpenAI Responses, Anthropic Messages, Gemini
  and Ollama (yes, Responses has no [DONE] — it ends on response.completed)
- ten hardcoded "reasoning" templates, one drawn per request
- deterministic ids and content: seed the RNG and diff the bytes; the goldens are committed
- fault injection, including a break after N frames *mid-stream* — the case that makes
  production clients hang forever
- zero runtime dependencies. The core is a Web Request → Response handler, so the same file runs
  on Node, Cloudflare Workers, Vercel Edge and Deno

Point any SDK at it: OPENAI_BASE_URL / ANTHROPIC_BASE_URL / OLLAMA_HOST.

MIT. Happy to talk about the protocol details.
```

### Reddit

r/LocalLLaMA:

```
Title: I made a fake LLM that speaks the real protocols (0 parameters, 0 VRAM, byte-exact SSE)

Every mock LLM I've seen for CI gets the wire format subtly wrong, so I built one that treats
the wire format as the whole product: OpenAI Chat Completions + Responses, Anthropic Messages,
Gemini and Ollama. It has ten hardcoded "thinking" templates and then repeats whatever you said.

The genuinely useful part: seeded determinism (diff the bytes in CI), and fault injection that
can break a stream *mid-response* so you can test retry/backoff paths without unplugging the
network. MIT, one file, no dependencies.
```

r/ProgrammerHumor:

```
Title: I trained a model on 10 thoughts and it repeats everything I say

Params: 0. Training cost: $0. GPU: none. It thinks "We need answer to user. User just said
"abc". Need infer? Probably minimal." and then answers "abc". Flawless.

(It also speaks OpenAI, Anthropic, Gemini and Ollama wire formats, which is the actually
useful bit.)
```

### V2EX

```
标题：[分享] 我写了个假的大模型，专门在 CI 里假装自己是 GPT-4

它永远只做两件事：先用十条硬编码模板"思考"一遍，然后一字不差复读你。

但正经的部分是：OpenAI Chat Completions / Responses、Anthropic Messages、Gemini、Ollama
四套协议全部按官方线格式返回，SSE 帧是逐字节对齐的（有 golden 文件做回归），所以官方 SDK
接进来不会有任何解析告警。

更适合工程的地方：
- 随机种子固定后完全确定性，CI 里可以 diff 字节
- 故障注入：流开始前返回标准 429，或者流到第 N 帧突然断掉（测重试逻辑必备）
- 零运行时依赖，核心就是一个 Web Request/Response handler，Node / CF Workers / Vercel / Deno 同一份代码

MIT，欢迎拿来当测试替身。
```

### 即刻 / 小红书

```
我给"大模型"祛了个魅 🦜

它叫 parrot-llm：你问它什么，它先认真思考一遍（十条硬编码模板里随机抽一条），然后一字不差复读你。

但它是认真写协议的那种假：OpenAI、Anthropic、Gemini、Ollama 四家的流式格式全对，官方 SDK 接进去毫无违和。

程序员朋友可以拿它当 CI 里的 GPT 替身，省钱、不 flaky、还能模拟"流到一半断掉"这种真实故障。

GitHub 搜 parrot-llm，MIT。
```

### Product Hunt

```
Tagline: A fake LLM with real wire format
Description: parrot-llm thinks for a moment (ten hardcoded templates), then repeats whatever you
said — over the exact streaming protocols OpenAI, Anthropic, Gemini and Ollama use. Built for
CI: deterministic, offline, fault-injectable, zero dependencies.
```

### 知乎 / 掘金

```
标题：如何优雅地在 CI 里假装自己有大模型——parrot-llm 的实现与线格式细节

大纲：
1. 为什么每个团队都在手写假 LLM，以及它们为什么都会坏
2. 四家协议的 SSE 细节差异（Responses 没有 [DONE]、Anthropic 的 ping 与 signature_delta）
3. 如何让"流式"既真实又确定：绝对时间表 + 固定随机种子
4. 中途断流的故障注入，以及它如何暴露客户端重试逻辑的 bug
5. 一份代码跑在 Node / Workers / Vercel / Deno 的架构取舍
```

## 4. Where to submit

Ordered by effort-to-reward:

1. **GitHub topics** — already set (`llm`, `mock-server`, `openai`, `anthropic`, `ollama`, `gemini`, `cloudflare-workers`, `sse`, `streaming`, `testing`, `fake-llm`, `parrot`, `reasoning`).
2. **LLM client projects** — open a *real PR* proposing parrot-llm as their CI mock: Open WebUI, LibreChat, Cline, Roo Code, Continue, aider. A merged PR beats a hundred tweets.
3. **Awesome lists** — `awesome-llm`, `awesome-chatgpt`, `awesome-testing`, `awesome-nodejs`, `awesome-cloudflare`, `awesome-selfhosted` (as a dev tool), `awesome-mock`.
4. **Cloudflare community** — the Workers template gallery, the Discord `#showcase` channel.
5. **npm** — publishing makes it searchable and adds a downloads badge (see [publishing.md](publishing.md)).
6. **中文平台** — V2EX、即刻、掘金、少数派、知乎、B 站（做个"我用假模型跑通了所有主流 SDK"的 5 分钟视频）。
7. **Reddit / HN** — one shot each; do it after the README has a screenshot and a live demo.

## 5. Timing

- **HN:** Tuesday–Thursday, 08:00–10:00 PT. Post the Show HN, then immediately add the author comment.
- **Reddit:** same day, different subreddit, 6+ hours apart.
- **中文平台:** 工作日 12:00 或 20:00–22:00。
- **Space it out.** GitHub first, then English communities, then Chinese ones a day later. Posting everywhere at once means nobody sees the follow-up answers.

## 6. Handling the obvious objections

| they say | you say |
| --- | --- |
| "That's just an echo server." | "The echo is four lines. The other 600 are wire-format fidelity, ten thinking templates, seeded determinism and mid-stream fault injection. The goldens are the API contract." |
| "What is it actually for?" | "The same reason you mock HTTP: your LLM app's retry, streaming and error paths are untested, and testing them against the real API costs money and flakes." |
| "Won't people abuse the public demo?" | "The template ships with `workers.dev` and preview URLs disabled, an optional `PARROT_API_KEY`, a body-size cap and the free plan's 100k/day ceiling." |
| "Isn't this dishonest?" | "The README's first line says it is fake. It is a mock, and it says so." |
| "Why not just use a small local model?" | "Because you want determinism, not quality. A 3B model still flaked your CI at 02:00." |

## 7. One-click release checklist

```bash
npm run typecheck && npm test        # must be green
npm run golden && git diff --stat    # goldens should be unchanged
npm version patch                    # or minor / major
git push --follow-tags               # triggers .github/workflows/release.yml
```

The tag does the rest: tests, npm publish (when `NPM_TOKEN` is set), the Docker image on GHCR and
a GitHub Release with generated notes. Then post using section 3.

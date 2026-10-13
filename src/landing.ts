import type { Ctx } from "./types.ts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STYLE = `
  :root {
    color-scheme: dark;
    --bg: #070b08;
    --panel: #0d1410;
    --line: rgba(110, 231, 135, .16);
    --green: #6ee787;
    --dim: #7c8f82;
    --text: #d8f3de;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    min-height: 100vh;
    background:
      radial-gradient(900px 500px at 12% -10%, rgba(110, 231, 135, .13), transparent 60%),
      radial-gradient(700px 400px at 100% 0%, rgba(56, 189, 248, .07), transparent 55%),
      var(--bg);
    color: var(--text);
    font: 15px/1.65 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    padding: 3.5rem 1.25rem 4rem;
  }
  main { max-width: 60rem; margin: 0 auto; display: grid; gap: 2.25rem; }
  a { color: var(--green); text-decoration: none; border-bottom: 1px solid rgba(110,231,135,.3); }
  a:hover { border-bottom-color: var(--green); }
  h1 { font-size: 1.6rem; letter-spacing: .02em; margin: 0; }
  h2 { font-size: .72rem; letter-spacing: .28em; text-transform: uppercase; color: var(--dim); margin: 0 0 .9rem; font-weight: 600; }
  header { display: grid; gap: .85rem; }
  .brand { display: flex; align-items: center; gap: .75rem; }
  .brand .bird { font-size: 1.9rem; line-height: 1; filter: drop-shadow(0 0 18px rgba(110,231,135,.45)); }
  .tagline { margin: 0; color: var(--dim); max-width: 44rem; }
  .chips { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .35rem; }
  .chip {
    font-size: .72rem; padding: .22rem .6rem; border: 1px solid var(--line);
    border-radius: 999px; color: var(--green); background: rgba(110,231,135,.06);
  }
  .chip.dim { color: var(--dim); border-color: rgba(255,255,255,.08); background: transparent; }
  .panel { border: 1px solid var(--line); border-radius: 16px; background: var(--panel); overflow: hidden; }
  form { display: flex; gap: .5rem; padding: .85rem; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.015); }
  form .prompt { color: var(--green); padding-top: .55rem; }
  input {
    flex: 1; min-width: 0; background: transparent; border: 0; outline: 0;
    color: var(--text); font: inherit; padding: .55rem .2rem;
  }
  input::placeholder { color: rgba(124,143,130,.65); }
  button {
    font: inherit; font-size: .82rem; cursor: pointer; color: #06110a; background: var(--green);
    border: 0; border-radius: 9px; padding: .55rem 1.1rem; font-weight: 600;
  }
  button:disabled { opacity: .45; cursor: progress; }
  .stream { padding: 1.1rem 1.15rem 1.35rem; min-height: 7.5rem; display: grid; gap: 1rem; align-content: start; }
  .empty { color: rgba(124,143,130,.7); }
  .label { font-size: .68rem; letter-spacing: .22em; text-transform: uppercase; color: var(--green); }
  .thinking-text {
    margin-top: .4rem; color: var(--dim); font-style: italic; white-space: pre-wrap; word-break: break-word;
    max-height: 9.5rem; overflow: auto; border-left: 2px solid var(--line); padding-left: .8rem;
  }
  .answer { font-size: 1.05rem; white-space: pre-wrap; word-break: break-word; }
  .caret { display: inline-block; width: .55ch; height: 1.05em; background: var(--green); vertical-align: -.15em; animation: blink 1.05s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  .error { color: #ff8a8a; }
  .grid { display: grid; gap: .6rem; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); }
  .card { border: 1px solid var(--line); border-radius: 13px; padding: .85rem 1rem; background: rgba(255,255,255,.012); }
  .card b { color: var(--green); font-weight: 600; font-size: .82rem; }
  .card code { display: block; margin-top: .45rem; color: var(--dim); font-size: .74rem; line-height: 1.75; word-break: break-all; }
  pre { margin: 0; padding: 1rem 1.15rem; overflow-x: auto; font-size: .78rem; color: #bfe9c9; }
  pre .c { color: rgba(124,143,130,.75); }
  footer { color: rgba(124,143,130,.75); font-size: .78rem; display: flex; flex-wrap: wrap; gap: .35rem 1rem; }
`;

export function landingPage(ctx: Ctx): Response {
  const cfg = ctx.cfg;
  const models = cfg.models.map((id) => `<span class="chip dim">${escapeHtml(id)}</span>`).join("");
  const modeChip = `<span class="chip">mode: ${escapeHtml(cfg.mode)}</span>`;
  const tpsChip = `<span class="chip">${cfg.tps} tps</span>`;
  const thinkingChip = cfg.thinking.length > 0
    ? `<span class="chip">thinking: ${cfg.thinking.length} template${cfg.thinking.length === 1 ? "" : "s"}</span>`
    : `<span class="chip dim">thinking: off</span>`;
  const textChip = cfg.mode === "fixed" ? `<span class="chip dim">text: ${escapeHtml(cfg.text)}</span>` : "";
  const logChip = cfg.log === "off" ? "" : `<span class="chip dim">log: ${escapeHtml(cfg.log)}</span>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>npc-llm — it says whatever you said</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <header>
    <div class="brand">
      <span class="bird">🧍</span>
      <h1>npc-llm</h1>
    </div>
    <p class="tagline">It says whatever you said — after thinking about it. No model, no weights, no GPU: one template, four protocols, byte-exact streaming.</p>
    <div class="chips">${modeChip}${tpsChip}${thinkingChip}${textChip}${logChip}</div>
  </header>

  <section>
    <h2>Try it — this really calls the API</h2>
    <div class="panel">
      <form id="ask" autocomplete="off">
        <span class="prompt">❯</span>
        <input id="prompt" value="hello" spellcheck="false" aria-label="Your message">
        <button id="send" type="submit">send</button>
      </form>
      <div class="stream" id="stream">
        <div class="empty">Type anything. It will think about it, then say it back.</div>
      </div>
    </div>
  </section>

  <section>
    <h2>Protocols</h2>
    <div class="grid">
      <div class="card"><b>OpenAI</b><code>POST /v1/chat/completions<br>POST /v1/responses<br>POST /v1/embeddings<br>GET&nbsp; /v1/models</code></div>
      <div class="card"><b>Anthropic</b><code>POST /v1/messages<br>POST /v1/messages/count_tokens</code></div>
      <div class="card"><b>Gemini</b><code>POST /v1beta/models/{model}<br>&nbsp;&nbsp;&nbsp;&nbsp;:generateContent<br>&nbsp;&nbsp;&nbsp;&nbsp;:streamGenerateContent</code></div>
      <div class="card"><b>Ollama</b><code>POST /api/chat<br>POST /api/generate<br>GET&nbsp; /api/tags</code></div>
    </div>
  </section>

  <section>
    <h2>Point anything at this origin</h2>
    <div class="panel">
<pre><span class="c"># OpenAI SDK</span>
export OPENAI_BASE_URL=<span class="c">${escapeHtml(new URL(ctx.url).origin)}</span>/v1
export OPENAI_API_KEY=sk-npc

<span class="c"># Anthropic SDK</span>
export ANTHROPIC_BASE_URL=${escapeHtml(new URL(ctx.url).origin)}
export ANTHROPIC_API_KEY=sk-npc

<span class="c"># curl — watch it think, then repeat you</span>
curl -N ${escapeHtml(new URL(ctx.url).origin)}/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{"model":"${escapeHtml(cfg.models[0] ?? "npc-1")}","stream":true,
       "messages":[{"role":"user","content":"hello"}]}'</pre>
    </div>
  </section>

  <section>
    <h2>Models</h2>
    <div class="chips">${models}</div>
  </section>

  <footer>
    <span>MIT licensed</span>
    <span>·</span>
    <a href="https://github.com/lco117/npc-llm">github.com/lco117/npc-llm</a>
    <span>·</span>
    <span>GET /healthz</span>
  </footer>
</main>
<script>
(function () {
  var form = document.getElementById("ask");
  var input = document.getElementById("prompt");
  var button = document.getElementById("send");
  var stream = document.getElementById("stream");

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function render(prompt) {
    stream.textContent = "";
    var thinkWrap = el("div", "thinking");
    thinkWrap.appendChild(el("div", "label", "thinking"));
    var thinkText = el("div", "thinking-text");
    thinkWrap.appendChild(thinkText);
    var answer = el("div", "answer");
    var answerText = el("span", "answer-text");
    var caret = el("span", "caret");
    answer.appendChild(answerText);
    answer.appendChild(caret);
    stream.appendChild(thinkWrap);
    stream.appendChild(answer);
    return { thinkWrap: thinkWrap, thinkText: thinkText, answerText: answerText, caret: caret };
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var prompt = (input.value || "").trim() || "hello";
    var ui = render(prompt);
    button.disabled = true;

    try {
      var res = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "${escapeHtml(cfg.models[0] ?? "npc-1")}", stream: true, messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok || !res.body) {
        ui.thinkWrap.remove();
        ui.answerText.textContent = "HTTP " + res.status + " — check NPC_API_KEY";
        ui.answerText.className = "error";
        ui.caret.remove();
        return;
      }
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";
      while (true) {
        var step = await reader.read();
        if (step.done) break;
        buffer += decoder.decode(step.value, { stream: true });
        var frames = buffer.split("\\n\\n");
        buffer = frames.pop() || "";
        for (var i = 0; i < frames.length; i++) {
          var line = frames[i].split("\\n").filter(function (l) { return l.indexOf("data: ") === 0; })[0];
          if (!line) continue;
          var payload = line.slice(6);
          if (payload === "[DONE]") continue;
          var chunk;
          try { chunk = JSON.parse(payload); } catch (error) { continue; }
          var delta = (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) || {};
          if (typeof delta.reasoning_content === "string") {
            ui.thinkText.textContent += delta.reasoning_content;
            ui.thinkText.scrollTop = ui.thinkText.scrollHeight;
          }
          if (typeof delta.content === "string") ui.answerText.textContent += delta.content;
        }
      }
      if (ui.thinkText.textContent === "") ui.thinkWrap.remove();
      ui.caret.remove();
    } catch (error) {
      ui.answerText.textContent = String(error);
      ui.answerText.className = "error";
      ui.caret.remove();
    } finally {
      button.disabled = false;
    }
  });
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

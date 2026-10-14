import { describeReply } from "./engine.ts";
import { helpHtml } from "./help.ts";
import { langSwitch, resolveLang, t, type Lang } from "./i18n.ts";
import { BASE_CSS, escapeHtml } from "./ui.ts";
import type { Ctx } from "./types.ts";

const LANDING_CSS = `
  .ask { display: flex; align-items: center; gap: .5rem; padding: .7rem .9rem; border-bottom: 1px solid var(--line); }
  .ask .p { color: var(--teal); font-family: var(--mono); }
  .ask input { flex: 1; border: 0; background: transparent; padding: .4rem .1rem; }
  .ask input:focus { outline: none; }
  details.editor { border-bottom: 1px solid var(--line); }
  details.editor > summary { cursor: pointer; padding: .7rem 1rem; color: var(--muted); font-size: .8rem; font-family: var(--mono); }
  details.editor > summary:hover { color: var(--text); }
  details.editor > summary::marker { color: var(--accent); }
  .editor-body { padding: 0 1rem 1rem; display: grid; gap: .55rem; }
  details.format { border-top: 1px solid var(--line); margin-top: .2rem; }
  details.format > summary { cursor: pointer; padding: .55rem 0 .3rem; color: var(--muted); font-size: .78rem; font-family: var(--mono); }
  details.format > summary::marker { color: var(--accent); }
  .stream { padding: 1.1rem 1rem 1.35rem; min-height: 6.5rem; display: grid; gap: .9rem; align-content: start; }
  .stream .label { font-family: var(--mono); font-size: .66rem; letter-spacing: .2em; text-transform: uppercase; color: var(--accent-hi); }
  .thinking-text { margin-top: .35rem; color: var(--muted); font-style: italic; white-space: pre-wrap; word-break: break-word; border-left: 2px solid var(--line); padding-left: .8rem; max-height: 9rem; overflow: auto; }
  .answer { font-size: 1.02rem; white-space: pre-wrap; word-break: break-word; margin-top: .3rem; }
  .caret { display: inline-block; width: .55ch; height: 1em; background: var(--accent); vertical-align: -.14em; animation: blink 1.05s steps(1) infinite; }
  .visitor { color: var(--warn); font-size: .78rem; margin: 0; }
  .error { color: var(--bad); }
  .empty { color: var(--faint); }
  .cmd-head { display: flex; align-items: center; gap: .5rem; padding: .55rem .7rem .55rem .95rem; border-bottom: 1px solid var(--line); }
  .cmd-head .spacer { flex: 1; }
  .cmd-head .copy { font: inherit; font-family: var(--mono); font-size: .7rem; color: var(--muted); background: transparent; border: 0; cursor: pointer; }
  .cmd-head .copy:hover { color: var(--text); }
  .endpoint-note { margin-top: 1rem; }
`;

interface Run {
  id: string;
  label: string;
  lines: string[];
  note: string;
}

function runs(lang: Lang): Run[] {
  return [
    {
      id: "curl",
      label: "curl",
      lines: ["git clone https://github.com/lco117/dummy-llm && cd dummy-llm", "npm install && npm run dev"],
      note: t(lang, "install.curl.note"),
    },
    {
      id: "npm",
      label: "npm",
      lines: ["npx dummy-llm --port 8080"],
      note: t(lang, "install.npm.note"),
    },
    {
      id: "docker",
      label: "docker",
      lines: ["docker build -t dummy-llm https://github.com/lco117/dummy-llm.git", "docker run --rm -p 8080:8080 dummy-llm"],
      note: t(lang, "install.docker.note"),
    },
    {
      id: "workers",
      label: "Workers",
      lines: ["npx wrangler deploy --domain your.example.com"],
      note: t(lang, "install.workers.note"),
    },
  ];
}

function protocolRows(lang: Lang): Array<[string, string, string]> {
  return [
    ["OpenAI", "POST /v1/chat/completions<br>POST /v1/completions<br>POST /v1/responses<br>POST /v1/embeddings<br>GET /v1/models", t(lang, "proto.openai.note")],
    ["Anthropic", "POST /v1/messages<br>POST /v1/messages/count_tokens", t(lang, "proto.anthropic.note")],
    ["Gemini", "POST /v1beta/models/{model}:generateContent<br>POST /v1beta/models/{model}:streamGenerateContent", t(lang, "proto.gemini.note")],
    ["Ollama", "POST /api/chat<br>POST /api/generate<br>GET /api/tags", t(lang, "proto.ollama.note")],
    ["—", "GET /healthz<br>GET /admin", t(lang, "proto.other.note")],
  ];
}

export function landingPage(ctx: Ctx, request: Request): Response {
  const cfg = ctx.cfg;
  const lang = resolveLang(request, ctx.url);
  const origin = escapeHtml(new URL(ctx.url).origin);
  const first = cfg.models[0] ?? "dummy-echo-1";

  const commandTabs = runs(lang)
    .map((run, index) => '<button class="cmd-tab" type="button" role="tab" data-tab="' + run.id + '" aria-selected="' + (index === 0 ? "true" : "false") + '">' + run.label + "</button>")
    .join("");

  const commandPanels = runs(lang)
    .map((run, index) => {
      const lines = run.lines.map((line) => '<span class="p">$</span> ' + escapeHtml(line)).join("\n");
      return (
        '<div class="cmd-panel" data-tab="' + run.id + '"' + (index === 0 ? " data-on" : "") + ">" +
        '<pre>' + lines + "</pre>" +
        '<p class="hint">' + escapeHtml(run.note) + "</p>" +
        "</div>"
      );
    })
    .join("");

  const protocols = protocolRows(lang)
    .map(([name, endpoints, note]) =>
      "<tr><td class=\"k\">" + escapeHtml(name) + '</td><td class="m">' + endpoints + '</td><td class="note">' + escapeHtml(note) + "</td></tr>",
    )
    .join("");

  const models = cfg.models
    .map((id) => {
      const persona = cfg.personas[id];
      const behaviour = persona?.description ?? "reply: " + describeReply(persona?.reply ?? cfg.reply);
      return '<tr><td class="k">' + escapeHtml(id) + '</td><td class="note">' + escapeHtml(behaviour) + "</td></tr>";
    })
    .join("");

  const chips = [
    '<span class="chip on">' + t(lang, "hero.chip.protocols") + "</span>",
    '<span class="chip">' + t(lang, "hero.chip.deps") + "</span>",
    '<span class="chip">' + t(lang, "hero.chip.deterministic") + "</span>",
    '<span class="chip">' + cfg.tps + " tps</span>",
    cfg.thinking.length > 0
      ? '<span class="chip">thinking × ' + cfg.thinking.length + "</span>"
      : '<span class="chip">thinking off</span>',
  ].join("");

  const clientStrings = JSON.stringify({
    thinking: t(lang, "demo.thinking"),
    answer: t(lang, "demo.answer"),
    visitor: t(lang, "demo.visitor"),
    httpError: t(lang, "demo.httpError"),
    networkError: t(lang, "demo.networkError"),
    copy: t(lang, "demo.copy"),
    copied: t(lang, "demo.copied"),
    empty: t(lang, "demo.empty"),
  }).replace(/</g, "\\u003c");

  const html = `<!doctype html>
<html lang="${lang === "zh" ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<link rel="icon" type="image/svg+xml" href="/logo.svg">
<title>dummy-llm — ${escapeHtml(t(lang, "hero.chip.protocols"))}</title>
<style>${BASE_CSS}${LANDING_CSS}</style>
</head>
<body>
<div class="doc">
  <header class="top">
    <a class="brand" href="/"><strong>dummy-llm</strong><span class="cursor"></span></a>
    <nav class="nav">
      <a href="#run">${t(lang, "install.title")}</a>
      <a href="#demo">${t(lang, "nav.demo")}</a>
      <a href="#protocols">${t(lang, "nav.protocols")}</a>
      <a href="#models">${t(lang, "nav.models")}</a>
      <a href="/admin">${t(lang, "nav.admin")}</a>
    </nav>
    ${langSwitch(lang, "/")}
  </header>

  <section class="hero">
    <h1>dummy-llm<span class="cursor"></span></h1>
    <p class="lede">${escapeHtml(t(lang, "hero.tagline"))}</p>
    <p class="lede-sub">${escapeHtml(t(lang, "hero.sub"))}</p>
    <div class="chips">${chips}</div>
  </section>

  <section class="sec" id="run">
    <h2>${t(lang, "install.title")}</h2>
    <p class="sub">${escapeHtml(t(lang, "install.sub"))}</p>
    <div class="cmd">
      <div class="cmd-tabs" role="tablist">${commandTabs}</div>
      ${commandPanels}
    </div>
  </section>

  <section class="sec" id="demo">
    <h2>${t(lang, "demo.title")}</h2>
    <p class="sub">${escapeHtml(t(lang, "demo.sub"))}</p>
    <div class="panel">
      <details class="editor" id="editor"${cfg.playground ? "" : " hidden"}>
        <summary>${t(lang, "demo.editor")}</summary>
        <div class="editor-body">
          <textarea id="template" rows="3" spellcheck="false" placeholder="{input}"></textarea>
          <p class="hint">${escapeHtml(t(lang, "demo.editorHint"))} ${escapeHtml(t(lang, "demo.limits"))}</p>
          <details class="format">
            <summary>${t(lang, "demo.format")}</summary>
            ${helpHtml(lang)}
          </details>
        </div>
      </details>
      <form class="ask" id="ask" autocomplete="off">
        <span class="p">❯</span>
        <input id="prompt" value="hello" spellcheck="false" aria-label="${escapeHtml(t(lang, "demo.input"))}">
        <button class="btn primary" id="send" type="submit">${t(lang, "demo.send")}</button>
      </form>
      <div class="stream" id="stream"><div class="empty" id="empty">${escapeHtml(t(lang, "demo.empty"))}</div></div>
    </div>
  </section>

  <section class="sec" id="protocols">
    <h2>${t(lang, "proto.title")}</h2>
    <p class="sub">${escapeHtml(t(lang, "proto.sub"))}</p>
    <table class="tbl">
      <thead><tr><th>${t(lang, "proto.col.protocol")}</th><th>${t(lang, "proto.col.endpoint")}</th><th>${t(lang, "proto.col.note")}</th></tr></thead>
      <tbody>${protocols}</tbody>
    </table>
    <div class="cmd endpoint-note">
      <div class="cmd-head"><span class="hint mono">curl -N ${origin}/v1/chat/completions</span><span class="spacer"></span><button class="copy" type="button">${t(lang, "demo.copy")}</button></div>
      <div class="cmd-panel" data-on data-tab="curl-example">
<pre><span class="p">$</span> curl -N ${origin}/v1/chat/completions \\
    -H 'content-type: application/json' \\
    -d '{"model":"${escapeHtml(first)}","stream":true,"messages":[{"role":"user","content":"hello"}]}'</pre>
      </div>
    </div>
  </section>

  <section class="sec" id="models">
    <h2>${t(lang, "models.title")}</h2>
    <p class="sub">${escapeHtml(t(lang, "models.sub"))}</p>
    <table class="tbl">
      <thead><tr><th>${t(lang, "models.col.id")}</th><th>${t(lang, "models.col.behaviour")}</th></tr></thead>
      <tbody>${models}</tbody>
    </table>
  </section>

  <footer class="foot">
    <span>${t(lang, "foot.license")}</span>
    <span>·</span>
    <a href="https://github.com/lco117/dummy-llm">github.com/lco117/dummy-llm</a>
    <span>·</span>
    <a href="https://github.com/lco117/dummy-llm/blob/main/docs/security.md">${t(lang, "foot.security")}</a>
    <span class="grow"></span>
    <span>GET /healthz</span>
  </footer>
</div>
<script type="application/json" id="page-i18n">${clientStrings}</script>
<script>
(function () {
  var strings = {};
  try { strings = JSON.parse(document.getElementById("page-i18n").textContent); } catch (error) {}
  function fill(text, vars) {
    var out = text || "";
    for (var key in vars) out = out.replace("{" + key + "}", vars[key]);
    return out;
  }

  var tabs = document.querySelectorAll(".cmd-tab");
  function select(el) {
    var id = el.getAttribute("data-tab");
    for (var i = 0; i < tabs.length; i++) tabs[i].setAttribute("aria-selected", tabs[i] === el ? "true" : "false");
    var panels = document.querySelectorAll(".cmd-panel[data-tab]");
    for (var j = 0; j < panels.length; j++) {
      if (panels[j].getAttribute("data-tab") === id) panels[j].setAttribute("data-on", "");
      else panels[j].removeAttribute("data-on");
    }
  }
  for (var t = 0; t < tabs.length; t++) tabs[t].addEventListener("click", function (event) { select(event.currentTarget); });

  var copies = document.querySelectorAll("button.copy");
  for (var c = 0; c < copies.length; c++) {
    copies[c].addEventListener("click", function (event) {
      var button = event.currentTarget;
      var box = button.closest(".cmd");
      var text = box ? box.querySelector("pre").textContent.replace(/^\\$ /gm, "") : "";
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(function () {
        button.textContent = strings.copied || "Copied";
        setTimeout(function () { button.textContent = strings.copy || "Copy"; }, 1400);
      });
    });
  }

  var form = document.getElementById("ask");
  var input = document.getElementById("prompt");
  var button = document.getElementById("send");
  var stream = document.getElementById("stream");
  var editor = document.getElementById("template");
  var playground = ${cfg.playground ? "true" : "false"};

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function currentTemplate() { return playground && editor ? editor.value.trim() : ""; }
  if (playground && editor) {
    var initial = new URLSearchParams(location.search).get("t");
    if (initial) editor.value = initial;
    editor.addEventListener("input", function () {
      var url = new URL(location.href);
      var value = editor.value.trim();
      if (value) url.searchParams.set("t", value); else url.searchParams.delete("t");
      history.replaceState(null, "", url);
    });
  }

  function render() {
    stream.textContent = "";
    if (currentTemplate()) stream.appendChild(el("p", "visitor", strings.visitor || ""));
    var thinking = el("div");
    thinking.appendChild(el("div", "label", strings.thinking || "thinking"));
    var thinkingText = el("div", "thinking-text");
    thinking.appendChild(thinkingText);
    var answer = el("div");
    answer.appendChild(el("div", "label", strings.answer || "answer"));
    var answerText = el("div", "answer");
    var caret = el("span", "caret");
    answerText.appendChild(caret);
    answer.appendChild(answerText);
    stream.appendChild(thinking);
    stream.appendChild(answer);
    return { thinking: thinking, thinkingText: thinkingText, answerText: answerText, caret: caret };
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var prompt = (input.value || "").trim() || "hello";
    var ui = render();
    button.disabled = true;
    try {
      var template = currentTemplate();
      var endpoint = "/v1/chat/completions" + (template ? "?t=" + encodeURIComponent(template) : "");
      var response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "${escapeHtml(first)}", stream: true, messages: [{ role: "user", content: prompt }] }),
      });
      if (!response.ok || !response.body) {
        ui.thinking.remove();
        ui.answerText.textContent = fill(strings.httpError, { status: response.status });
        ui.answerText.className = "answer error";
        ui.caret.remove();
        return;
      }
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";
      while (true) {
        var step = await reader.read();
        if (step.done) break;
        buffer += decoder.decode(step.value, { stream: true });
        var frames = buffer.split("\\n\\n");
        buffer = frames.pop() || "";
        for (var i = 0; i < frames.length; i++) {
          var line = frames[i].split("\\n").filter(function (part) { return part.indexOf("data: ") === 0; })[0];
          if (!line) continue;
          var payload = line.slice(6);
          if (payload === "[DONE]") continue;
          var chunk;
          try { chunk = JSON.parse(payload); } catch (error) { continue; }
          var delta = (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) || {};
          if (typeof delta.reasoning_content === "string") {
            ui.thinkingText.textContent += delta.reasoning_content;
            ui.thinkingText.scrollTop = ui.thinkingText.scrollHeight;
          }
          if (typeof delta.content === "string") {
            ui.caret.remove();
            ui.answerText.textContent += delta.content;
            ui.answerText.appendChild(ui.caret);
          }
        }
      }
      if (ui.thinkingText.textContent === "") ui.thinking.remove();
      ui.caret.remove();
    } catch (error) {
      ui.answerText.textContent = strings.networkError || String(error);
      ui.answerText.className = "answer error";
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

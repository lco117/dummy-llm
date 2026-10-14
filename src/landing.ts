import { describeReply } from "./engine.ts";
import { helpHtml } from "./help.ts";
import { langSwitch, resolveLang, t, type Lang } from "./i18n.ts";
import { LOGO_SVG } from "./logo.ts";
import { BASE_CSS, escapeHtml } from "./ui.ts";
import type { Ctx } from "./types.ts";

const LANDING_CSS = `
  .hero-top { display: flex; align-items: center; gap: 1.15rem; }
  .hero-top .mark { width: 4.8rem; height: 4.8rem; flex: 0 0 auto; filter: drop-shadow(0 12px 32px rgba(56,168,248,.26)); }
  .hero-top .mark svg { width: 100%; height: 100%; display: block; }

  .term-bar { display: flex; align-items: center; gap: .25rem; padding: .5rem .6rem .1rem; }
  .term-bar .term-btn { font: inherit; font-family: var(--mono); font-size: .72rem; color: var(--faint); background: none; border: 0; border-radius: 999px; padding: .18rem .55rem; cursor: pointer; }
  .term-bar .term-btn:hover { color: var(--text); }
  .term-bar .term-btn[aria-selected="true"] { color: var(--text); background: rgba(255,255,255,.06); }
  .term-bar .spacer { flex: 1; }

  .stream .label { font-family: var(--mono); font-size: .66rem; letter-spacing: .2em; text-transform: uppercase; color: var(--accent-hi); }
  .thinking-text { margin-top: .35rem; color: var(--muted); font-style: italic; white-space: pre-wrap; word-break: break-word; border-left: 2px solid var(--line); padding-left: .8rem; max-height: 9rem; overflow: auto; }
  .answer { font-size: 1.06rem; white-space: pre-wrap; word-break: break-word; margin-top: .3rem; }
  .caret { display: inline-block; width: .55ch; height: 1em; background: var(--accent); vertical-align: -.14em; animation: blink 1.05s steps(1) infinite; }
  .visitor { color: var(--warn); font-size: .8rem; margin: 0; }
  .error { color: var(--bad); }
  .empty { color: var(--faint); }

  details.editor { border-top: 1px solid var(--line); }
  details.editor > summary { cursor: pointer; padding: .7rem 1rem; color: var(--muted); font-size: .8rem; font-family: var(--mono); }
  details.editor > summary:hover { color: var(--text); }
  details.editor > summary::marker { color: var(--accent); }
  .editor-body { padding: 0 1rem 1rem; display: grid; gap: .55rem; }
  details.format { border-top: 1px solid var(--line); margin-top: .2rem; }
  details.format > summary { cursor: pointer; padding: .55rem 0 .3rem; color: var(--muted); font-size: .78rem; font-family: var(--mono); }
  details.format > summary::marker { color: var(--accent); }
  .endpoint-note { margin-top: 1.1rem; }
`;

interface Run {
  id: string;
  label: string;
  bash: string[];
  pwsh: string[];
  note: string;
}

function runs(lang: Lang): Run[] {
  return [
    {
      id: "curl",
      label: "curl",
      bash: ["git clone https://github.com/lco117/dummy-llm && cd dummy-llm", "npm install && npm run dev"],
      pwsh: ["git clone https://github.com/lco117/dummy-llm; cd dummy-llm", "npm install; npm run dev"],
      note: t(lang, "install.curl.note"),
    },
    {
      id: "npm",
      label: "npm",
      bash: ["npx dummy-llm --port 8080"],
      pwsh: ["npx dummy-llm --port 8080"],
      note: t(lang, "install.npm.note"),
    },
    {
      id: "docker",
      label: "docker",
      bash: ["docker build -t dummy-llm https://github.com/lco117/dummy-llm.git", "docker run --rm -p 8080:8080 dummy-llm"],
      pwsh: ["docker build -t dummy-llm https://github.com/lco117/dummy-llm.git", "docker run --rm -p 8080:8080 dummy-llm"],
      note: t(lang, "install.docker.note"),
    },
    {
      id: "workers",
      label: "Workers",
      bash: ["npx wrangler deploy --domain your.example.com"],
      pwsh: ["npx wrangler deploy --domain your.example.com"],
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

/** A command block: bash/PowerShell switch on the left, copy on the right. */
function commandBlock(id: string, lang: Lang, bash: string[], pwsh: string[], note: string, on: boolean): string {
  const lines = (list: string[]) => list.map((line) => '<span class="p">$</span> ' + escapeHtml(line)).join("\n");
  return [
    '<div class="cmd-panel" data-tab="' + id + '"' + (on ? " data-on" : "") + ">",
    '<div class="term-bar">',
    '<button class="term-btn" type="button" data-term-btn="bash" aria-selected="true">bash</button>',
    '<button class="term-btn" type="button" data-term-btn="pwsh" aria-selected="false">PowerShell</button>',
    '<span class="spacer"></span>',
    '<button class="copy" type="button">' + t(lang, "demo.copy") + "</button>",
    "</div>",
    '<pre data-term-panel="bash">' + lines(bash) + "</pre>",
    '<pre data-term-panel="pwsh" hidden>' + lines(pwsh) + "</pre>",
    note ? '<p class="hint">' + escapeHtml(note) + "</p>" : "",
    "</div>",
  ].join("");
}

/** Every string the client script prints. Served as the prelude of /app.js, so there is one copy. */
export function landingStrings(lang: Lang): string {
  return JSON.stringify({
    thinking: t(lang, "demo.thinking"),
    answer: t(lang, "demo.answer"),
    visitor: t(lang, "demo.visitor"),
    httpError: t(lang, "demo.httpError"),
    networkError: t(lang, "demo.networkError"),
    copy: t(lang, "demo.copy"),
    copied: t(lang, "demo.copied"),
    statsPrompt: t(lang, "demo.stats.prompt"),
    statsAfter: t(lang, "demo.stats.after"),
    templateWins: t(lang, "demo.templateWins"),
  }).replace(/</g, "\\u003c");
}

export function landingPage(ctx: Ctx, request: Request): Response {
  const cfg = ctx.cfg;
  const lang = resolveLang(request, ctx.url);
  const origin = escapeHtml(new URL(ctx.url).origin);
  const first = cfg.models[0] ?? "dummy-echo-1";
  const body = '{"model":"' + escapeHtml(first) + '","stream":true,"messages":[{"role":"user","content":"hello"}]}';

  const commandTabs = runs(lang)
    .map((run, index) => '<button class="cmd-tab" type="button" role="tab" data-tab="' + run.id + '" aria-selected="' + (index === 0 ? "true" : "false") + '">' + run.label + "</button>")
    .join("");

  const commandPanels = runs(lang)
    .map((run, index) => commandBlock(run.id, lang, run.bash, run.pwsh, run.note, index === 0))
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
    '<span class="chip">' + t(lang, "hero.chip.sse") + "</span>",
    '<span class="chip">' + t(lang, "hero.chip.offline") + "</span>",
  ].join("");

  const modelMenu = cfg.models
    .map((id) => {
      const desc = cfg.personas[id]?.description ?? "";
      return (
        '<li role="option"><button type="button" data-model="' + escapeHtml(id) + '">' +
        '<span class="name">' + escapeHtml(id) + "</span>" +
        (desc ? '<span class="desc">' + escapeHtml(desc) + "</span>" : "") +
        "</button></li>"
      );
    })
    .join("");

  const curlExample = commandBlock(
    "curl-example",
    lang,
    ["curl -N " + origin + "/v1/chat/completions \\", "  -H 'content-type: application/json' \\", "  -d '" + body + "'"],
    ["curl.exe -sN " + origin + "/v1/chat/completions " + "\u0060", "  -H 'content-type: application/json' " + "\u0060", "  -d '" + body + "'"],
    "",
    true,
  );

  const html = `<!doctype html>
<html lang="${lang === "zh" ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<link rel="icon" type="image/svg+xml" href="/logo.svg">
<title>dummy-llm</title>
<style>${BASE_CSS}${LANDING_CSS}</style>
</head>
<body>
<div class="shapes" aria-hidden="true"><i></i><i class="b"></i><i class="c"></i><i class="b"></i></div>
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
    <div class="hero-top">
      <span class="mark">${LOGO_SVG}</span>
      <h1>dummy-llm<span class="cursor"></span></h1>
    </div>
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
    <div class="panel chat">
      <div class="stream" id="stream"><div class="empty" id="empty">${escapeHtml(t(lang, "demo.empty"))}</div></div>
      <form class="composer" id="ask" data-playground="${cfg.playground ? "1" : "0"}" autocomplete="off">
        <div class="row-in">
          <span class="p">❯</span>
          <input id="prompt" value="hello" spellcheck="false" aria-label="${escapeHtml(t(lang, "demo.input"))}">
        </div>
        <div class="foot">
          <div class="pick">
            <button class="pick-btn" id="model-pick" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="${escapeHtml(t(lang, "demo.model"))}">
              <span class="name" id="model-name">${escapeHtml(first)}</span><span class="chev">⌄</span>
            </button>
            <ul class="pick-menu" id="model-menu" role="listbox" hidden>${modelMenu}</ul>
          </div>
          <span class="stats" id="stats"></span>
          <button class="send" id="send" type="submit" aria-label="${escapeHtml(t(lang, "demo.send"))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
          </button>
        </div>
      </form>
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
    </div>
  </section>

  <section class="sec" id="protocols">
    <h2>${t(lang, "proto.title")}</h2>
    <p class="sub">${escapeHtml(t(lang, "proto.sub"))}</p>
    <table class="tbl">
      <thead><tr><th>${t(lang, "proto.col.protocol")}</th><th>${t(lang, "proto.col.endpoint")}</th><th>${t(lang, "proto.col.note")}</th></tr></thead>
      <tbody>${protocols}</tbody>
    </table>
    <div class="cmd endpoint-note">${curlExample}</div>
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
<script src="/app.js?lang=${lang}"></script>
</body>
</html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
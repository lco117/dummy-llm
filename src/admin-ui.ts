import { ADMIN_JS } from "./admin-client.ts";
import { helpHtml } from "./help.ts";
import { LOGO_SVG } from "./logo.ts";
import * as db from "./packs.ts";
import { langSwitch, t, type Lang } from "./i18n.ts";
import { themeSwitch, type Theme } from "./theme.ts";
import { BASE_CSS, escapeHtml } from "./ui.ts";

/**
 * The admin pages: the app, the login form and the "Access required" notice.
 *
 * The only interpolation is authored text from src/i18n.ts. Personas, templates, store values and
 * anything else that comes from a request are never interpolated: the client writes those with
 * textContent. Add one innerHTML and the strict-CSP XSS story is gone.
 *
 * The client script is a static asset (src/admin-client.ts). The strings it needs travel in a JSON
 * block, which is why the language switch has one implementation rather than two.
 */

export { ADMIN_JS };

export const ADMIN_CSS = BASE_CSS + `  .who { font-family: var(--mono); font-size: .9rem; color: var(--faint); }
  .brand { align-items: center; }
  .brand .mark { width: 1.7rem; height: 1.7rem; display: block; }
  .brand .mark svg { width: 100%; height: 100%; display: block; }
  .top .chips { margin-left: .3rem; }
  .top form.inline-form { margin-left: auto; }
  .admin-grid { display: grid; gap: 1rem; grid-template-columns: minmax(13rem, 17rem) 1fr; margin-top: 1.6rem; }
  @media (max-width: 58rem) { .admin-grid { grid-template-columns: 1fr; } }
  .panel h2 { font-family: var(--mono); font-size: 1.05rem; font-weight: 650; letter-spacing: -.01em; color: var(--text); margin-bottom: .9rem; }
  ul.personas { list-style: none; margin: 0 0 .7rem; padding: 0; display: grid; gap: .2rem; max-height: 24rem; overflow: auto; }
  ul.personas li { display: flex; align-items: baseline; gap: .5rem; padding: .34rem .5rem; border: 1px solid transparent; border-radius: var(--radius-sm); cursor: pointer; }
  ul.personas li:hover { background: rgba(255,255,255,.04); }
  ul.personas li.active { border-color: var(--line-strong); background: rgba(77,107,254,.10); }
  ul.personas li .id { flex: 1; font-family: var(--mono); font-size: .88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  ul.personas li .tag { font-family: var(--mono); font-size: .7rem; color: var(--faint); border: 1px solid var(--line); border-radius: 999px; padding: 0 .42rem; }
  ul.personas li .tag.on { color: var(--accent-hi); border-color: rgba(77,107,254,.4); }
  ul.personas li .tag.gone { color: var(--bad); border-color: rgba(248,113,113,.3); }
  .row { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
  label.field { display: block; margin-bottom: .6rem; }
  label.field > span { display: block; font-family: var(--mono); font-size: .75rem; letter-spacing: .06em; text-transform: uppercase; color: var(--faint); margin-bottom: .28rem; }
  details.help { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: .5rem .7rem; margin: .2rem 0 .8rem; background: rgba(0,0,0,.16); }
  details.help > summary { cursor: pointer; font-family: var(--mono); font-size: .8rem; color: var(--muted); }
  details.help > summary::marker { color: var(--accent); }
  td.m { max-width: 24rem; white-space: pre-wrap; word-break: break-word; line-height: 1.5; }
  td.ctrl input, td.ctrl select { max-width: 100%; }
  td.ctrl { width: 15rem; }
  td.actions { width: 5rem; text-align: right; }
  td.faint { opacity: .55; }
  .stream { margin-top: .9rem; min-height: 5rem; display: grid; gap: .8rem; align-content: start; }
  .stream .label { font-family: var(--mono); font-size: .72rem; letter-spacing: .2em; text-transform: uppercase; color: var(--accent-hi); }
  .thinking-text { margin-top: .3rem; color: var(--muted); font-style: italic; white-space: pre-wrap; word-break: break-word; border-left: 2px solid var(--line); padding-left: .8rem; max-height: 8rem; overflow: auto; }
  .answer { margin-top: .3rem; white-space: pre-wrap; word-break: break-word; font-size: 1.08rem; }
  .caret { display: inline-block; width: .55ch; height: 1em; background: var(--accent); vertical-align: -.14em; animation: blink 1.05s steps(1) infinite; }
  .error { color: var(--bad); }
  .empty { color: var(--faint); }
  #pack-out { margin: .8rem 0 0; padding: .7rem .85rem; border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: auto; font-size: .86rem; color: #d7dee8; }
  .wide { flex: 1; min-width: 0; }
  .row.spaced { margin-top: .9rem; }
  .panel.spaced { margin-top: 1rem; }
  .row select { width: auto; }
  .boot-title { font-size: 1.6rem; margin-bottom: .8rem; }
  .boot { margin-top: 2.2rem; }
  .boot .btn { margin-top: .4rem; }
`;

interface ClientStrings {
  loading: string;
  loadFailed: string;
  retry: string;
  readonly: string;
  chipAuth: string;
  chipStore: string;
  chipReadonly: string;
  sourceBuiltin: string;
  sourceEnv: string;
  sourceStore: string;
  sourceDeleted: string;
  defaultEntry: string;
  noteDefault: string;
  resetDefault: string;
  defaultReset: string;
  statsPrompt: string;
  statsAfter: string;
  noteBuiltin: string;
  noteStore: string;
  noteDeleted: string;
  reset: string;
  saved: string;
  confirmDelete: string;
  deleted: string;
  nothingChanged: string;
  savedDefaults: string;
  resetOne: string;
  confirmReset: string;
  storeDropped: string;
  badId: string;
  pickPersona: string;
  newPersona: string;
  exported: string;
  packApplied: string;
  packPreview: string;
  fetching: string;
  fetched: string;
  pasteFirst: string;
  confirmApply: string;
  nothingToChange: string;
  packsFetch: string;
  chat: { thinking: string; thought: string; copy: string; copied: string };
  loginBadKey: string;
  loginThrottled: string;
}

/** The served script: the dictionary for this language, then the behaviour. */
export function adminScript(lang: Lang): string {
  return "window.__DUMMY_I18N = " + clientStrings(lang) + ";\n" + ADMIN_JS;
}

function clientStrings(lang: Lang): string {
  const strings: ClientStrings = {
    loading: t(lang, "admin.loading"),
    loadFailed: t(lang, "admin.loadFailed"),
    retry: t(lang, "admin.retry"),
    readonly: t(lang, "admin.readonly"),
    chipAuth: t(lang, "admin.chip.auth"),
    chipStore: t(lang, "admin.chip.store"),
    chipReadonly: t(lang, "admin.readonlyWord"),
    sourceBuiltin: t(lang, "admin.source.builtin"),
    sourceEnv: t(lang, "admin.source.env"),
    sourceStore: t(lang, "admin.source.store"),
    sourceDeleted: t(lang, "admin.source.deleted"),
    defaultEntry: t(lang, "admin.defaultEntry"),
    noteDefault: t(lang, "admin.note.default"),
    resetDefault: t(lang, "admin.resetDefault"),
    defaultReset: t(lang, "msg.defaultReset"),
    statsPrompt: t(lang, "demo.stats.prompt"),
    statsAfter: t(lang, "demo.stats.after"),
    noteBuiltin: t(lang, "admin.note.builtin"),
    noteStore: t(lang, "admin.note.store"),
    noteDeleted: t(lang, "admin.note.deleted"),
    reset: t(lang, "admin.reset"),
    saved: t(lang, "msg.saved"),
    confirmDelete: t(lang, "msg.confirmDelete"),
    deleted: t(lang, "msg.deleted"),
    nothingChanged: t(lang, "msg.nothingChanged"),
    savedDefaults: t(lang, "msg.savedDefaults"),
    resetOne: t(lang, "msg.resetOne"),
    confirmReset: t(lang, "msg.confirmReset"),
    storeDropped: t(lang, "msg.storeDropped"),
    badId: t(lang, "msg.badId"),
    pickPersona: t(lang, "msg.pickPersona"),
    newPersona: t(lang, "msg.newPersona"),
    exported: t(lang, "msg.exported"),
    packApplied: t(lang, "msg.packApplied"),
    packPreview: t(lang, "msg.packPreview"),
    fetching: t(lang, "msg.fetching"),
    fetched: t(lang, "msg.fetched"),
    pasteFirst: t(lang, "msg.pasteFirst"),
    confirmApply: t(lang, "msg.confirmApply"),
    nothingToChange: t(lang, "msg.nothingToChange"),
    packsFetch: t(lang, "admin.packs.fetch"),
    chat: {
      thinking: t(lang, "chat.thinking"),
      thought: t(lang, "chat.thought"),
      copy: t(lang, "demo.copy"),
      copied: t(lang, "demo.copied"),
    },
    loginBadKey: t(lang, "login.badKey"),
    loginThrottled: t(lang, "login.throttled"),
  };
  return JSON.stringify(strings).replace(/</g, "\\u003c");
}

function head(lang: Lang, theme: Theme, title: string, bodyClass: string): string {
  return [
    "<!doctype html>",
    '<html lang="' + (lang === "zh" ? "zh-CN" : "en") + '" data-theme="' + theme + '">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="dark">',
    '<meta name="robots" content="noindex, nofollow">',
    "<title>" + escapeHtml(title) + "</title>",
    '<link rel="icon" type="image/svg+xml" href="/logo.svg">',
    '<link rel="stylesheet" href="/admin/app.css">',
    "</head>",
    '<body class="' + bodyClass + '">',
  ].join("");
}

function topBar(lang: Lang, theme: Theme, signOut: boolean): string {
  return [
    '<header class="top">',
    '<a class="brand" href="/"><span class="mark">' + LOGO_SVG + '</span><strong>dummy-llm</strong><span class="cursor"></span></a>',
    '<span class="who">/ admin</span>',
    '<div class="chips" id="chips"></div>',
    signOut
      ? '<form class="inline-form" method="post" action="/admin/logout"><button class="btn" type="submit">' + t(lang, "admin.signout") + "</button></form>"
      : "",
    themeSwitch(theme, "/admin", lang),
    langSwitch(lang, "/admin"),
    "</header>",
  ].join("");
}

export function adminPage(lang: Lang, theme: Theme): string {
  return [
    head(lang, theme, "dummy-llm admin", "admin"),
    '<div class="doc wide">',
    topBar(lang, theme, true),
    '<div id="boot" class="boot"><p class="hint">' + t(lang, "admin.loading") + "</p></div>",
    '<div id="main" hidden>',
    '<p id="banner" class="callout warn" hidden></p>',
    '<p id="status" class="callout" hidden></p>',

    '<div class="admin-grid">',
    '<section class="panel panel-pad">',
    "<h2>" + t(lang, "admin.personas") + "</h2>",
    '<ul class="personas" id="persona-list"></ul>',
    '<form class="row" id="new-persona">',
    '<input id="new-id" class="wide" spellcheck="false" placeholder="' + escapeHtml(t(lang, "admin.newPlaceholder")) + '" aria-label="' + escapeHtml(t(lang, "admin.new")) + '">',
    '<button class="btn" type="submit">' + t(lang, "admin.new") + "</button>",
    "</form>",
    "</section>",

    '<section class="panel panel-pad">',
    "<h2>" + t(lang, "admin.editor") + "</h2>",
    '<label class="field"><span>' + t(lang, "admin.id") + '</span><input id="p-id" spellcheck="false"></label>',
    '<label class="field"><span>' + t(lang, "admin.shape") + '</span><select id="p-shape">',
    '<option value="one">' + t(lang, "admin.shape.one") + "</option>",
    '<option value="pool">' + t(lang, "admin.shape.pool") + "</option>",
    '<option value="keys">' + t(lang, "admin.shape.keys") + "</option>",
    "</select></label>",
    '<label class="field"><span>' + t(lang, "admin.reply") + '</span><textarea id="p-reply" rows="10" spellcheck="false"></textarea></label>',
    "<details class=\"help\"><summary>" + t(lang, "admin.format") + "</summary>" + helpHtml(lang) + "</details>",
    '<label class="field"><span>' + t(lang, "admin.thinking") + '</span><textarea id="p-thinking" rows="6" spellcheck="false"></textarea></label>',
    '<label class="field"><span>' + t(lang, "admin.description") + '</span><input id="p-description" spellcheck="false"></label>',
    '<label class="field"><span>' + t(lang, "admin.tps") + '</span><input id="p-tps" type="number" min="1" step="1" spellcheck="false"></label>',
    '<div class="row">',
    '<button class="btn primary" id="p-save" type="button">' + t(lang, "admin.save") + "</button>",
    '<button class="btn" id="p-revert" type="button">' + t(lang, "admin.revert") + "</button>",
    '<button class="btn danger" id="p-delete" type="button">' + t(lang, "admin.delete") + "</button>",
    "</div>",
    '<p class="hint" id="p-note"></p>',
    "</section>",
    "</div>",

    '<section class="sec"><h2>' + t(lang, "admin.defaults") + '<span class="hint">' + t(lang, "admin.defaults.sub") + "</span></h2>",
    '<table class="tbl"><thead><tr>',
    "<th>" + t(lang, "admin.col.setting") + "</th>",
    "<th>" + t(lang, "admin.col.environment") + "</th>",
    "<th>" + t(lang, "admin.col.stored") + "</th>",
    "<th>" + t(lang, "admin.col.effective") + "</th>",
    "<th>" + t(lang, "admin.col.value") + "</th>",
    "<th></th></tr></thead><tbody id=\"defaults-body\"></tbody></table>",
    '<div class="row spaced">',
    '<button class="btn primary" id="d-save" type="button">' + t(lang, "admin.saveDefaults") + "</button>",
    '<button class="btn danger" id="d-reset" type="button">' + t(lang, "admin.dropStore") + "</button>",
    "</div></section>",

    '<section class="sec"><h2>' + t(lang, "admin.preview") + '<span class="hint">' + t(lang, "admin.preview.sub") + "</span></h2>",
    '<div class="panel chat">',
    '<div class="stream" id="preview-stream"><div class="empty">' + t(lang, "admin.preview.empty") + "</div></div>",
    '<form class="composer" id="preview-form">',
    '<div class="row-in"><span class="p">❯</span>',
    '<input id="preview-input" class="wide" value="hello" spellcheck="false" aria-label="' + escapeHtml(t(lang, "admin.preview.input")) + '">',
    "</div>",
    '<div class="foot">',
    '<span class="stats" id="preview-stats"></span>',
    '<div class="pick">',
    '<button class="pick-btn" id="preview-pick" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="' + escapeHtml(t(lang, "admin.preview.model")) + '">',
    '<span class="name" id="preview-name">' + escapeHtml(t(lang, "admin.preview.defaults")) + '</span><span class="chev">⌄</span>',
    "</button>",
    '<ul class="pick-menu" id="preview-menu" role="listbox" hidden></ul>',
    "</div>",
    '<button class="send" type="submit" aria-label="' + escapeHtml(t(lang, "admin.preview.run")) + '">',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>',
    "</button>",
    "</div>",
    "</form>",
    "</div>",
    "</section>",

    '<section class="sec"><h2>' + t(lang, "admin.packs")
      + '<span class="tip" tabindex="0" role="note" aria-label="' + escapeHtml(t(lang, "admin.packs.about")) + '">i<span class="tip-body">' + escapeHtml(t(lang, "admin.packs.about")) + "</span></span>"
      + '<span class="hint">' + t(lang, "admin.packs.sub") + "</span></h2>",
    '<div id="pack-index">' + db.PACK_INDEX.map((pack) =>
      '<div class="row"><button class="btn" type="button" data-pack-url="' + escapeHtml(pack.url) + '" title="'
        + escapeHtml(t(lang, "admin.packs.fetchTitle").split("{file}").join(pack.file)) + '">' + escapeHtml(t(lang, pack.titleKey)) + "</button>"
        + '<span class="hint">' + escapeHtml(t(lang, pack.descKey)) + "</span></div>",
    ).join("") + "</div>",
    '<p class="hint">' + t(lang, "admin.packs.url") + "</p>",
    '<form class="row" id="pack-fetch-form">',
    '<input id="pack-url" class="wide" spellcheck="false" placeholder="https://gist.githubusercontent.com/.../pack.json">',
    '<button class="btn" type="submit">' + t(lang, "admin.packs.fetch") + "</button>",
    "</form>",
    '<p class="hint">' + t(lang, "admin.packs.json") + "</p>",
    '<textarea id="pack-json" rows="4" spellcheck="false" placeholder="{&quot;personas&quot;:{&quot;dummy-hello-1&quot;:{&quot;reply&quot;:&quot;hi&quot;}}}"></textarea>',
    '<div class="row spaced">',
    '<button class="btn" id="pack-diff" type="button">' + t(lang, "admin.packs.diff") + "</button>",
    '<button class="btn primary" id="pack-apply" type="button">' + t(lang, "admin.packs.apply") + "</button>",
    '<button class="btn" id="pack-export" type="button">' + t(lang, "admin.packs.export") + "</button>",
    "</div>",
    '<pre id="pack-out" hidden></pre>',
    "</section>",

    '<footer class="foot"><a href="/">' + t(lang, "admin.publicPage") + '</a><span class="grow"></span><span>' + t(lang, "admin.foot") + "</span></footer>",
    "</div>",
    '<script src="/admin/app.js?lang=' + lang + '"></script>',
    "</body></html>",
  ].join("");
}

export function loginPage(lang: Lang, theme: Theme): string {
  return [
    head(lang, theme, "dummy-llm admin", "login"),
    '<div class="doc">',
    topBar(lang, theme, false),
    '<div class="boot"><h1 class="boot-title">dummy-llm <span class="who">/ admin</span></h1>',
    '<p class="hint">' + t(lang, "login.intro") + "</p>",
    '<p id="error" class="callout bad" hidden></p>',
    '<div class="panel panel-pad spaced">',
    '<form method="post" action="/admin/login" autocomplete="off">',
    '<label class="field" for="key"><span>' + t(lang, "login.key") + '</span></label>',
    '<input id="key" name="key" type="password" required autofocus autocomplete="current-password">',
    '<div class="row spaced"><button class="btn primary" type="submit">' + t(lang, "login.submit") + "</button></div>",
    "</form></div>",
    '<p class="hint">' + t(lang, "login.note") + "</p>",
    "</div></div>",
    '<script src="/admin/app.js?lang=' + lang + '"></script>',
    "</body></html>",
  ].join("");
}

export function accessDeniedPage(lang: Lang, theme: Theme): string {
  return [
    head(lang, theme, "dummy-llm admin", "login"),
    '<div class="doc">',
    topBar(lang, theme, false),
    '<div class="boot"><h1 class="boot-title">' + t(lang, "denied.title") + "</h1>",
    '<p class="callout bad">' + t(lang, "denied.body") + "</p>",
    '<p class="hint">' + t(lang, "denied.hint") + "</p>",
    "</div></div>",
    "</body></html>",
  ].join("");
}

/*
 * The admin page: static HTML, one stylesheet, one script. Nothing here is built from server data.
 *
 * That is the XSS story, and it is worth stating plainly: the HTML contains no interpolation at all,
 * the client fetches /admin/api/state and writes every value with textContent or .value, and the CSP
 * is default-src 'none'; script-src 'self'; style-src 'self'. There is no innerHTML in this file, and
 * adding one would be the bug.
 */

export const ADMIN_CSS = `:root {
  color-scheme: dark;
  --bg: #070b08;
  --panel: #0d1410;
  --line: rgba(110, 231, 135, .16);
  --green: #6ee787;
  --dim: #7c8f82;
  --text: #d8f3de;
  --red: #ff8a8a;
  --amber: #ffd479;
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  background: radial-gradient(900px 500px at 12% -10%, rgba(110,231,135,.13), transparent 60%), var(--bg);
  color: var(--text);
  font: 14px/1.6 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  padding: 2.5rem 1.25rem 4rem;
}
body.login { display: grid; place-items: center; min-height: 100vh; padding: 2rem 1.25rem; }
main { max-width: 76rem; margin: 0 auto; display: grid; gap: 1.5rem; }
body.login main { width: min(26rem, 100%); }
h1 { font-size: 1.25rem; margin: 0; }
h2 { font-size: .7rem; letter-spacing: .26em; text-transform: uppercase; color: var(--dim); margin: 0 0 .9rem; font-weight: 600; }
a { color: var(--green); }
code { color: var(--green); }
header { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem 1rem; }
header .grow { flex: 1; }
.chips { display: flex; flex-wrap: wrap; gap: .4rem; }
.chip { font-size: .7rem; padding: .18rem .55rem; border: 1px solid var(--line); border-radius: 999px; color: var(--green); background: rgba(110,231,135,.06); }
.chip.dim, .chip.off { color: var(--dim); border-color: rgba(255,255,255,.08); background: transparent; }
.panel { border: 1px solid var(--line); border-radius: 14px; background: var(--panel); padding: 1.1rem 1.15rem; }
.columns { display: grid; gap: 1.5rem; grid-template-columns: minmax(14rem, 18rem) 1fr; }
@media (max-width: 62rem) { .columns { grid-template-columns: 1fr; } }
ul.personas { list-style: none; margin: 0 0 .75rem; padding: 0; display: grid; gap: .3rem; max-height: 26rem; overflow: auto; }
ul.personas li { border: 1px solid transparent; border-radius: 9px; padding: .35rem .5rem; cursor: pointer; display: flex; gap: .5rem; align-items: baseline; }
ul.personas li:hover { background: rgba(255,255,255,.03); }
ul.personas li.active { border-color: var(--line); background: rgba(110,231,135,.07); }
ul.personas li .id { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
ul.personas li .tag { font-size: .62rem; color: var(--dim); border: 1px solid rgba(255,255,255,.08); border-radius: 999px; padding: 0 .4rem; }
ul.personas li .tag.store { color: var(--green); border-color: var(--line); }
ul.personas li .tag.gone { color: var(--red); border-color: rgba(255,138,138,.3); }
label { display: block; font-size: .72rem; color: var(--dim); letter-spacing: .04em; margin-bottom: .5rem; }
label > span { display: block; margin-bottom: .18rem; }
input, select, textarea, button { font: inherit; }
input:not([type=checkbox]), select, textarea {
  width: 100%; background: rgba(0,0,0,.28); color: var(--text);
  border: 1px solid var(--line); border-radius: 9px; padding: .45rem .6rem;
}
input[type=checkbox] { width: auto; }
textarea { resize: vertical; font-size: .8rem; }
input:focus, select:focus, textarea:focus { outline: 1px solid var(--green); border-color: transparent; }
button { cursor: pointer; border: 1px solid var(--line); background: rgba(255,255,255,.03); color: var(--text); border-radius: 9px; padding: .42rem .9rem; }
button.primary { background: var(--green); color: #06110a; border-color: transparent; font-weight: 600; }
button.danger { color: var(--red); border-color: rgba(255,138,138,.3); }
button:disabled { opacity: .4; cursor: not-allowed; }
.row { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .75rem; align-items: center; }
.hint { color: var(--dim); font-size: .72rem; font-weight: 400; letter-spacing: 0; text-transform: none; }
.banner { margin: 0; padding: .65rem .85rem; border-radius: 10px; border: 1px solid var(--line); background: rgba(110,231,135,.06); font-size: .78rem; }
.banner.warn { color: var(--amber); border-color: rgba(255,212,121,.3); background: rgba(255,212,121,.06); }
.banner.bad { color: var(--red); border-color: rgba(255,138,138,.3); background: rgba(255,138,138,.06); }
table { width: 100%; border-collapse: collapse; font-size: .76rem; }
th, td { text-align: left; padding: .35rem .4rem; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: top; }
th { color: var(--dim); font-weight: 600; letter-spacing: .04em; }
td.mono { color: var(--dim); max-width: 15rem; overflow-wrap: anywhere; }
td.ctrl { width: 15rem; }
td.actions { width: 5rem; text-align: right; }
.env-only { opacity: .55; }
.stream { margin-top: .9rem; min-height: 5rem; display: grid; gap: .7rem; align-content: start; }
.label { font-size: .64rem; letter-spacing: .2em; text-transform: uppercase; color: var(--green); }
.thinking-text { color: var(--dim); font-style: italic; white-space: pre-wrap; word-break: break-word; border-left: 2px solid var(--line); padding-left: .7rem; max-height: 8rem; overflow: auto; margin-top: .25rem; }
.answer { white-space: pre-wrap; word-break: break-word; font-size: 1rem; margin-top: .25rem; }
.empty, .status { color: var(--dim); }
.error { color: var(--red); }
pre { margin: .75rem 0 0; padding: .75rem .85rem; border: 1px solid var(--line); border-radius: 10px; overflow: auto; font-size: .75rem; color: #bfe9c9; }
form.inline { display: flex; gap: .4rem; margin-top: .4rem; margin-bottom: .8rem; }
form.inline input { flex: 1; }
footer { color: var(--dim); font-size: .72rem; }`;

export const LOGIN_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="robots" content="noindex, nofollow">
<title>dummy-llm admin</title>
<link rel="stylesheet" href="/admin/app.css">
</head>
<body class="login">
<main>
  <h1>dummy-llm admin</h1>
  <p class="hint">This deployment exposes a private configuration page. Sign in with the admin key. The key is compared in constant time and never stored in the browser: what comes back is a signed session cookie carrying only an expiry and an HMAC.</p>
  <p id="error" class="banner bad" hidden></p>
  <div class="panel">
    <form method="post" action="/admin/login" autocomplete="off">
      <label for="key"><span>Admin key</span></label>
      <input id="key" name="key" type="password" required autofocus autocomplete="current-password">
      <div class="row"><button class="primary" type="submit">Sign in</button></div>
    </form>
  </div>
  <p class="hint">This form works without JavaScript. Failed attempts are throttled per address.</p>
</main>
<script src="/admin/app.js"></script>
</body>
</html>`;

export const ACCESS_DENIED_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="robots" content="noindex, nofollow">
<title>dummy-llm admin</title>
<link rel="stylesheet" href="/admin/app.css">
</head>
<body class="login">
<main>
  <h1>Access required</h1>
  <p class="banner bad">This deployment authenticates the admin page with Cloudflare Access, and this request did not arrive with a valid Access identity.</p>
  <p class="hint">If you are the operator: sign in through the Access application (a fresh navigation normally redirects you there), then reload this page. If the Worker is also reachable through a route that does not pass through Access, use DUMMY_ADMIN_AUTH=access-jwt so the token is verified instead of trusted.</p>
</main>
</body>
</html>`;

export const ADMIN_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="robots" content="noindex, nofollow">
<title>dummy-llm admin</title>
<link rel="stylesheet" href="/admin/app.css">
</head>
<body>
<main>
  <header>
    <h1>dummy-llm admin</h1>
    <div class="chips">
      <span class="chip" id="chip-auth">auth</span>
      <span class="chip" id="chip-store">store</span>
      <span class="chip dim" id="chip-version"></span>
    </div>
    <span class="grow"></span>
    <form method="post" action="/admin/logout"><button type="submit">Sign out</button></form>
  </header>

  <p id="banner" class="banner" hidden></p>
  <p id="status" class="status" hidden></p>

  <div class="columns">
    <section class="panel">
      <h2>Personas</h2>
      <ul class="personas" id="persona-list"></ul>
      <form class="inline" id="new-persona">
        <input id="new-id" placeholder="dummy-new-1" spellcheck="false" aria-label="New persona id">
        <button type="submit">New</button>
      </form>
    </section>

    <section class="panel">
      <h2>Persona editor</h2>
      <div>
        <label><span>id</span><input id="p-id" spellcheck="false"></label>
        <label><span>reply shape — the shape is the behaviour</span>
          <select id="p-shape">
            <option value="one">one template</option>
            <option value="pool">a pool, one entry per line</option>
            <option value="keys">keyword map, "key = template" per line</option>
          </select>
        </label>
        <label><span>reply</span><textarea id="p-reply" rows="5" spellcheck="false"></textarea></label>
        <label><span>thinking — one per line, empty means no reasoning channel</span><textarea id="p-thinking" rows="3" spellcheck="false"></textarea></label>
        <label><span>description</span><input id="p-description" spellcheck="false"></label>
        <div class="row">
          <button class="primary" id="p-save" type="button">Save persona</button>
          <button id="p-revert" type="button">Revert</button>
          <button class="danger" id="p-delete" type="button">Delete</button>
        </div>
        <p class="hint" id="p-note"></p>
      </div>
    </section>
  </div>

  <section class="panel">
    <h2>Defaults <span class="hint">resolved as store &gt; environment &gt; built-in</span></h2>
    <table>
      <thead><tr><th>setting</th><th>environment</th><th>stored</th><th>effective</th><th>value</th><th></th></tr></thead>
      <tbody id="defaults-body"></tbody>
    </table>
    <div class="row">
      <button class="primary" id="d-save" type="button">Save changed defaults</button>
      <button class="danger" id="d-reset" type="button">Drop the whole store</button>
    </div>
  </section>

  <section class="panel">
    <h2>Live preview <span class="hint">this runs the real engine</span></h2>
    <form class="inline" id="preview-form">
      <input id="preview-input" value="hello" spellcheck="false" aria-label="Message to preview">
      <select id="preview-model"></select>
      <button class="primary" type="submit">Run</button>
    </form>
    <div class="stream" id="preview-stream"><div class="empty">Nothing previewed yet.</div></div>
  </section>

  <section class="panel">
    <h2>Packs <span class="hint">install, tweak, export, share</span></h2>
    <div id="pack-index"></div>
    <label><span>or paste a pack URL — the browser fetches it, this server never does</span></label>
    <form class="inline" id="pack-fetch-form">
      <input id="pack-url" placeholder="https://gist.githubusercontent.com/.../pack.json" spellcheck="false">
      <button type="submit">Fetch</button>
    </form>
    <label><span>pack JSON</span><textarea id="pack-json" rows="4" spellcheck="false" placeholder='{"personas":{"dummy-hello-1":{"reply":"hi"}}}'></textarea></label>
    <div class="row">
      <button id="pack-diff" type="button">Preview diff</button>
      <button class="primary" id="pack-apply" type="button">Apply</button>
      <button id="pack-export" type="button">Export store as a pack</button>
    </div>
    <pre id="pack-out" hidden></pre>
  </section>

  <footer>dummy-llm · <a href="/">the public page</a> · the admin edits the store only; the environment and the deployment shape stay with the operator.</footer>
</main>
<script src="/admin/app.js"></script>
</body>
</html>`;

export const ADMIN_JS = `(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function setText(node, value) {
    node.textContent = value === null || value === undefined ? "" : String(value);
  }
  function status(message, kind) {
    var node = $("status");
    if (!message) { node.hidden = true; return; }
    node.className = "banner " + (kind || "");
    setText(node, message);
    node.hidden = false;
  }
  function fail(error) { status(error && error.message ? error.message : String(error), "bad"); }

  if (document.body.className.indexOf("login") !== -1) {
    var messages = { "bad-key": "That key was not correct. Failed attempts are throttled per address." };
    var code = new URLSearchParams(location.search).get("e");
    var box = $("error");
    if (box && code && messages[code]) { setText(box, messages[code]); box.hidden = false; }
    return;
  }

  function request(path, options) {
    var init = { credentials: "same-origin", method: "GET", headers: {} };
    if (options) { for (var key in options) init[key] = options[key]; }
    if (init.body !== undefined) init.headers["content-type"] = "application/json";
    return fetch(path, init).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; }
        catch (error) { data = { error: "the server did not answer with JSON" }; }
        if (!response.ok) throw new Error((data && data.error) || ("HTTP " + response.status));
        return data;
      });
    });
  }
  function post(path, body) { return request(path, { method: "POST", body: JSON.stringify(body || {}) }); }
  function put(path, body) { return request(path, { method: "PUT", body: JSON.stringify(body || {}) }); }
  function del(path) { return request(path, { method: "DELETE" }); }

  function detectShape(reply) {
    if (Array.isArray(reply)) return "pool";
    if (reply && typeof reply === "object") return "keys";
    return "one";
  }
  function replyToText(reply, shape) {
    if (reply === null || reply === undefined) return "";
    if (shape === "pool") return (Array.isArray(reply) ? reply : [String(reply)]).join("\n");
    if (shape === "keys") {
      var map = reply && typeof reply === "object" && !Array.isArray(reply) ? reply : {};
      var lines = [];
      for (var key in map) lines.push(key + " = " + map[key]);
      return lines.join("\n");
    }
    return typeof reply === "string" ? reply : JSON.stringify(reply);
  }
  function textToReply(text, shape) {
    var lines = text.split("\n");
    if (shape === "pool") {
      var items = lines.map(function (line) { return line.trim(); }).filter(Boolean);
      return items.length ? items : "";
    }
    if (shape === "keys") {
      var map = {};
      var count = 0;
      lines.forEach(function (line) {
        var at = line.indexOf("=");
        if (at === -1) {
          var bare = line.trim();
          if (bare) { map["*"] = bare; count = count + 1; }
          return;
        }
        var key = line.slice(0, at).trim();
        var value = line.slice(at + 1).trim();
        if (key) { map[key] = value; count = count + 1; }
      });
      return count ? map : "";
    }
    return text;
  }
  function summarize(value) {
    var text = typeof value === "string" ? value : JSON.stringify(value);
    if (text === undefined || text === null) return "";
    return text.length > 90 ? text.slice(0, 90) + "..." : text;
  }

  var state = null;
  var selected = null;
  var knownId = null;

  function load() {
    return request("/admin/api/state").then(function (data) {
      state = data.state;
      render();
    }).catch(fail);
  }

  function render() {
    setText($("chip-auth"), "auth: " + (state.auth.mode || "off"));
    var storeChip = $("chip-store");
    setText(storeChip, "store: " + state.auth.store + (state.auth.writable ? "" : " — read-only"));
    storeChip.className = "chip" + (state.auth.writable ? "" : " off");
    setText($("chip-version"), "v" + state.version);
    var banner = $("banner");
    if (state.auth.writable) {
      banner.hidden = true;
    } else {
      banner.className = "banner warn";
      setText(banner, "Read-only: this deployment has no store, so nothing here can be saved. Set DUMMY_STORE=kv on Cloudflare (bind a KV namespace as DUMMY_ADMIN_KV), or DUMMY_STORE=file:./data on a server, then reload.");
      banner.hidden = false;
    }
    renderPersonas();
    renderDefaults();
    renderPreviewModels();
    renderPacks();
    disableWrites(!state.auth.writable);
    if (selected) select(selected);
  }

  function disableWrites(readOnly) {
    ["p-save", "p-delete", "d-save", "d-reset", "pack-apply"].forEach(function (id) { $(id).disabled = readOnly; });
    $("new-persona").querySelector("button").disabled = readOnly;
  }

  function renderPersonas() {
    var list = $("persona-list");
    list.textContent = "";
    state.personas.forEach(function (entry) {
      var item = el("li");
      if (entry.id === selected) item.className = "active";
      item.appendChild(el("span", "id", entry.id));
      var tag;
      if (entry.effective === null) tag = el("span", "tag gone", "deleted");
      else if (entry.source === "store") tag = el("span", "tag store", "store");
      else tag = el("span", "tag", entry.source);
      item.appendChild(tag);
      item.addEventListener("click", function () { select(entry.id); });
      list.appendChild(item);
    });
  }

  function entryFor(id) {
    for (var index = 0; index < state.personas.length; index++) {
      if (state.personas[index].id === id) return state.personas[index];
    }
    return null;
  }

  function select(id) {
    var entry = entryFor(id);
    if (!entry) return;
    selected = id;
    knownId = entry.source === "store" ? id : null;
    var draft = entry.stored || entry.effective || {};
    $("p-id").value = id;
    var shape = detectShape(draft.reply);
    $("p-shape").value = shape;
    $("p-reply").value = replyToText(draft.reply, shape);
    $("p-thinking").value = Array.isArray(draft.thinking) ? draft.thinking.join("\n") : "";
    $("p-description").value = draft.description || "";
    if (entry.effective === null && entry.source === "store") {
      setText($("p-note"), "This persona is deleted by the store. Saving it again restores it.");
    } else if (entry.source === "store") {
      setText($("p-note"), "Overridden by the store. Saving writes this draft; the environment copy stays where it is.");
    } else {
      setText($("p-note"), "Coming from the " + entry.source + " layer. Saving writes an override into the store; the original stays untouched.");
    }
    renderPersonas();
  }

  function personaDraft() {
    var thinking = $("p-thinking").value.split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
    var description = $("p-description").value.trim();
    var persona = { reply: textToReply($("p-reply").value, $("p-shape").value), thinking: thinking };
    if (description) persona.description = description;
    return persona;
  }

  $("p-shape").addEventListener("change", function () {
    $("p-reply").value = replyToText(textToReply($("p-reply").value, "one"), $("p-shape").value);
  });
  $("p-save").addEventListener("click", function () {
    if (!selected) { status("Pick a persona first.", "warn"); return; }
    var id = $("p-id").value.trim();
    if (!/^[A-Za-z0-9._-]{1,120}$/.test(id)) { status("A persona id may use letters, digits, dot, dash and underscore.", "bad"); return; }
    put("/admin/api/personas/" + encodeURIComponent(id), personaDraft()).then(function () {
      if (knownId && knownId !== id) return del("/admin/api/personas/" + encodeURIComponent(knownId));
    }).then(function () {
      knownId = id;
      return load();
    }).then(function () {
      select(id);
      status("Saved " + id + ".", "");
    }).catch(fail);
  });
  $("p-revert").addEventListener("click", function () { if (selected) select(selected); });
  $("p-delete").addEventListener("click", function () {
    if (!selected) return;
    if (!window.confirm("Delete " + selected + "? A built-in persona is hidden with a tombstone; the environment copy stays where it is.")) return;
    del("/admin/api/personas/" + encodeURIComponent(selected)).then(function () { return load(); }).then(function () {
      status("Deleted " + selected + ".", "");
    }).catch(fail);
  });
  $("new-persona").addEventListener("submit", function (event) {
    event.preventDefault();
    var id = $("new-id").value.trim();
    if (!/^[A-Za-z0-9._-]{1,120}$/.test(id)) { status("A persona id may use letters, digits, dot, dash and underscore.", "bad"); return; }
    $("new-id").value = "";
    selected = id;
    knownId = null;
    $("p-id").value = id;
    $("p-shape").value = "one";
    $("p-reply").value = "{input}";
    $("p-thinking").value = "";
    $("p-description").value = "";
    renderPersonas();
    status("New persona " + id + " — edit it and press Save persona.", "");
  });

  var DEFAULT_ROWS = ["reply", "thinking", "tps", "chunk", "delayMs", "ttftMs", "log", "playground", "maxReplyChars", "models"];

  function controlFor(key, value) {
    var input;
    if (key === "thinking") {
      input = el("textarea");
      input.rows = 2;
      input.spellcheck = false;
      input.value = Array.isArray(value) ? value.join("\n") : "";
      return input;
    }
    if (key === "log") {
      input = el("select");
      ["off", "summary", "full"].forEach(function (option) {
        var node = el("option", null, option);
        node.value = option;
        input.appendChild(node);
      });
      input.value = value;
      return input;
    }
    if (key === "playground") {
      input = el("input");
      input.type = "checkbox";
      input.checked = value === true;
      return input;
    }
    input = el("input");
    input.spellcheck = false;
    if (typeof value === "number") input.type = "number";
    if (Array.isArray(value)) input.value = value.join(", ");
    else if (key === "reply" && typeof value !== "string") input.value = JSON.stringify(value);
    else input.value = value === null || value === undefined ? "" : String(value);
    return input;
  }

  function readControl(key, input) {
    if (key === "playground") return input.checked;
    if (key === "thinking") return input.value.split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
    if (key === "reply") {
      var text = input.value;
      try {
        var parsed = JSON.parse(text);
        if (typeof parsed === "string") return parsed;
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        if (parsed && typeof parsed === "object") {
          var map = {};
          for (var name in parsed) map[name] = String(parsed[name]);
          return map;
        }
      } catch (error) { /* not JSON, so it is one template */ }
      return text;
    }
    if (key === "models") return input.value.split(",").map(function (item) { return item.trim(); }).filter(Boolean);
    if (key === "chunk") return /^[0-9]+$/.test(input.value.trim()) ? Number(input.value.trim()) : input.value.trim();
    var number = Number(input.value);
    return Number.isFinite(number) ? number : undefined;
  }

  function renderDefaults() {
    var body = $("defaults-body");
    body.textContent = "";
    DEFAULT_ROWS.forEach(function (key) {
      var entry = state.defaults[key];
      var row = el("tr");
      row.appendChild(el("td", null, key));
      row.appendChild(el("td", "mono", summarize(entry.env)));
      row.appendChild(el("td", "mono" + (entry.stored === null ? " env-only" : ""), entry.stored === null ? "—" : summarize(entry.stored)));
      row.appendChild(el("td", "mono", summarize(entry.effective)));
      var control = el("td", "ctrl");
      var input = controlFor(key, entry.stored === null ? entry.effective : entry.stored);
      input.id = "d-" + key;
      control.appendChild(input);
      row.appendChild(control);
      var actions = el("td", "actions");
      var reset = el("button", null, "Reset");
      reset.type = "button";
      reset.disabled = entry.stored === null || !state.auth.writable;
      reset.addEventListener("click", function () {
        del("/admin/api/defaults/" + key).then(function () { return load(); }).then(function () {
          status("Reset " + key + " to the environment value.", "");
        }).catch(fail);
      });
      actions.appendChild(reset);
      row.appendChild(actions);
      body.appendChild(row);
    });
  }

  $("d-save").addEventListener("click", function () {
    var patch = {};
    var changed = 0;
    DEFAULT_ROWS.forEach(function (key) {
      var input = $("d-" + key);
      if (!input) return;
      var value = readControl(key, input);
      if (value === undefined) return;
      if (JSON.stringify(value) === JSON.stringify(state.defaults[key].effective)) return;
      patch[key] = value;
      changed = changed + 1;
    });
    if (changed === 0) { status("Nothing changed.", ""); return; }
    put("/admin/api/defaults", patch).then(function () { return load(); }).then(function () {
      status("Saved " + changed + " default(s). Only the fields you changed were written.", "");
    }).catch(fail);
  });

  $("d-reset").addEventListener("click", function () {
    if (!window.confirm("Drop the whole stored document? Personas and defaults go back to the environment.")) return;
    post("/admin/api/reset", {}).then(function () { return load(); }).then(function () {
      status("The store is empty again.", "");
    }).catch(fail);
  });

  function renderPreviewModels() {
    var select = $("preview-model");
    var previous = select.value;
    select.textContent = "";
    var fallback = el("option", null, "defaults (an unknown model id)");
    fallback.value = "";
    select.appendChild(fallback);
    state.models.forEach(function (id) {
      var option = el("option", null, id);
      option.value = id;
      select.appendChild(option);
    });
    if (previous && state.models.indexOf(previous) !== -1) select.value = previous;
    else select.value = state.models.length ? state.models[0] : "";
  }

  $("preview-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var input = $("preview-input").value || "hello";
    var model = $("preview-model").value;
    var stream = $("preview-stream");
    stream.textContent = "";
    var thinking = el("div");
    thinking.appendChild(el("div", "label", "thinking"));
    var thinkingText = el("div", "thinking-text");
    thinking.appendChild(thinkingText);
    var answer = el("div");
    answer.appendChild(el("div", "label", "answer"));
    var answerText = el("div", "answer");
    var caret = el("span", "caret", "|");
    answerText.appendChild(caret);
    answer.appendChild(answerText);
    stream.appendChild(thinking);
    stream.appendChild(answer);
    var button = $("preview-form").querySelector("button");
    button.disabled = true;

    fetch("/admin/api/preview", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: input, model: model, patch: personaDraft() }),
    }).then(function (response) {
      if (!response.ok || !response.body) {
        return response.text().then(function (text) {
          thinking.remove();
          caret.remove();
          setText(answerText, "HTTP " + response.status + " " + text);
          answerText.className = "answer error";
        });
      }
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";
      function pump() {
        return reader.read().then(function (step) {
          if (step.done) return;
          buffer += decoder.decode(step.value, { stream: true });
          var frames = buffer.split("\n\n");
          buffer = frames.pop() || "";
          frames.forEach(function (frame) {
            var line = null;
            frame.split("\n").forEach(function (part) { if (line === null && part.indexOf("data: ") === 0) line = part.slice(6); });
            if (!line || line === "[DONE]") return;
            var chunk = null;
            try { chunk = JSON.parse(line); } catch (error) { return; }
            var delta = (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) || {};
            if (typeof delta.reasoning_content === "string") {
              thinkingText.textContent += delta.reasoning_content;
              thinkingText.scrollTop = thinkingText.scrollHeight;
            }
            if (typeof delta.content === "string") {
              caret.remove();
              answerText.textContent += delta.content;
              answerText.appendChild(caret);
            }
          });
          return pump();
        });
      }
      return pump().then(function () {
        if (!thinkingText.textContent) thinking.remove();
        caret.remove();
      });
    }).catch(function (error) {
      thinking.remove();
      caret.remove();
      setText(answerText, String(error));
      answerText.className = "answer error";
    }).then(function () { button.disabled = false; });
  });

  function renderPacks() {
    var index = $("pack-index");
    index.textContent = "";
    (state.packs || []).forEach(function (pack) {
      var row = el("div", "row");
      var button = el("button", null, "Fetch " + pack.name);
      button.type = "button";
      button.addEventListener("click", function () { fetchPack(pack.url); });
      row.appendChild(button);
      row.appendChild(el("span", "hint", pack.description));
      index.appendChild(row);
    });
  }

  function fetchPack(url) {
    status("Fetching " + url + " ...", "");
    fetch(url, { credentials: "omit" }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status + " from " + url);
      return response.text();
    }).then(function (text) {
      JSON.parse(text);
      $("pack-json").value = text;
      status("Fetched. Press Preview diff to see what it would change.", "");
    }).catch(function (error) { fail(error); });
  }

  $("pack-fetch-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var url = $("pack-url").value.trim();
    if (url) fetchPack(url);
  });

  function packBody() {
    var text = $("pack-json").value.trim();
    if (!text) throw new Error("paste a pack first, or fetch one from the list");
    return JSON.parse(text);
  }

  function showDiff(diff) {
    var lines = [];
    (diff.personas.added || []).forEach(function (id) { lines.push("+ persona " + id); });
    (diff.personas.changed || []).forEach(function (id) { lines.push("~ persona " + id); });
    (diff.personas.removed || []).forEach(function (id) { lines.push("- persona " + id); });
    (diff.defaults || []).forEach(function (entry) { lines.push("= " + entry.key + ": " + summarize(entry.from) + " -> " + summarize(entry.to)); });
    if (diff.models) lines.push("= models: " + summarize(diff.models.from) + " -> " + summarize(diff.models.to));
    if (!lines.length) lines.push("nothing would change");
    var out = $("pack-out");
    setText(out, lines.join("\n"));
    out.hidden = false;
  }

  $("pack-diff").addEventListener("click", function () {
    var pack;
    try { pack = packBody(); } catch (error) { fail(error); return; }
    post("/admin/api/import", { pack: pack, apply: false }).then(function (data) {
      showDiff(data.diff);
      status("Preview only — nothing was written.", "");
    }).catch(fail);
  });

  $("pack-apply").addEventListener("click", function () {
    var pack;
    try { pack = packBody(); } catch (error) { fail(error); return; }
    if (!window.confirm("Apply this pack to the store?")) return;
    post("/admin/api/import", { pack: pack, apply: true }).then(function (data) {
      showDiff(data.diff);
      return load();
    }).then(function () { status("Pack applied.", ""); }).catch(fail);
  });

  $("pack-export").addEventListener("click", function () {
    post("/admin/api/export", { source: "store" }).then(function (data) {
      $("pack-json").value = JSON.stringify(data.pack, null, 2);
      status("Exported the stored document into the box above.", "");
    }).catch(fail);
  });

  load();
})();`;

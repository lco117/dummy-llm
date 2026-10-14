export const ADMIN_JS = `/**
 * The admin page's behaviour. Served as a static asset; every string it shows comes from the i18n
 * dictionary the server embedded in the page, so the language switch needs no second implementation.
 *
 * It never builds markup: values are written with textContent, ids and classes are set through the DOM.
 * That is the XSS story the strict CSP depends on.
 */
(function () {
  "use strict";

  var S = window.__DUMMY_I18N || {};
  function fill(text, vars) {
    var out = text || "";
    for (var key in vars) out = out.replace("{" + key + "}", vars[key]);
    return out;
  }
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

  /* ---- login and denied pages: no state to fetch ---- */
  if (document.body.className.indexOf("login") !== -1) {
    var codes = { "bad-key": S.loginBadKey, "throttled": S.loginThrottled };
    var box = $("error");
    var code = new URLSearchParams(location.search).get("e");
    if (box && code && codes[code]) { setText(box, codes[code]); box.hidden = false; }
    return;
  }

  /* ---- the app page ---- */
  var state = null;
  var selected = null;
  var knownId = null;

  function status(message, kind) {
    var node = $("status");
    if (!message) { node.hidden = true; return; }
    node.className = "callout" + (kind ? " " + kind : "");
    setText(node, message);
    node.hidden = false;
  }
  function fail(error) { status(error && error.message ? error.message : String(error), "bad"); }

  function request(path, options) {
    var init = { credentials: "same-origin", method: "GET", headers: {} };
    if (options) { for (var key in options) init[key] = options[key]; }
    if (init.body !== undefined) init.headers["content-type"] = "application/json";
    return fetch(path, init).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; }
        catch (error) { data = { error: "HTTP " + response.status + ": the server did not answer with JSON" }; }
        if (!response.ok) throw new Error((data && data.error) || ("HTTP " + response.status));
        return data;
      });
    });
  }
  function post(path, body) { return request(path, { method: "POST", body: JSON.stringify(body || {}) }); }
  function put(path, body) { return request(path, { method: "PUT", body: JSON.stringify(body || {}) }); }
  function del(path) { return request(path, { method: "DELETE" }); }

  /* ---- boot: loading, failure and retry are visible states, never an empty page ---- */
  function showLoading() {
    var boot = $("boot");
    boot.hidden = false;
    boot.textContent = "";
    boot.appendChild(el("p", "hint", S.loading || "Loading…"));
    $("main").hidden = true;
  }
  function showBootError(error) {
    var boot = $("boot");
    boot.hidden = false;
    boot.textContent = "";
    var callout = el("div", "callout bad");
    callout.appendChild(el("p", null, S.loadFailed || "Could not load the configuration."));
    callout.appendChild(el("p", "hint", error && error.message ? error.message : String(error)));
    var retry = el("button", "btn", S.retry || "Retry");
    retry.type = "button";
    retry.addEventListener("click", function () { load(); });
    callout.appendChild(retry);
    boot.appendChild(callout);
    $("main").hidden = true;
  }

  function load() {
    showLoading();
    return request("/admin/api/state").then(function (data) {
      state = data.state;
      $("boot").hidden = true;
      $("main").hidden = false;
      render();
    }).catch(showBootError);
  }

  /* ---- reply shapes ---- */
  function detectShape(reply) {
    if (Array.isArray(reply)) return "pool";
    if (reply && typeof reply === "object") return "keys";
    return "one";
  }
  function replyToText(reply, shape) {
    if (reply === null || reply === undefined) return "";
    if (shape === "pool") return (Array.isArray(reply) ? reply : [String(reply)]).join("\\n");
    if (shape === "keys") {
      var map = reply && typeof reply === "object" && !Array.isArray(reply) ? reply : {};
      var lines = [];
      for (var key in map) lines.push(key + " = " + map[key]);
      return lines.join("\\n");
    }
    return typeof reply === "string" ? reply : JSON.stringify(reply);
  }
  function textToReply(text, shape) {
    var lines = text.split("\\n");
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

  function sourceLabel(entry) {
    if (entry.effective === null) return S.sourceDeleted || "deleted";
    return S["source" + entry.source.charAt(0).toUpperCase() + entry.source.slice(1)] || entry.source;
  }

  /* ---- render ---- */
  function render() {
    var chips = $("chips");
    chips.textContent = "";
    chips.appendChild(el("span", "chip on", (S.chipAuth || "auth") + ": " + (state.auth.mode || "off")));
    var storeChip = el("span", "chip" + (state.auth.writable ? "" : " off"), (S.chipStore || "store") + ": " + state.auth.store + (state.auth.writable ? "" : " — " + (S.chipReadonly || "read-only")));
    chips.appendChild(storeChip);
    chips.appendChild(el("span", "chip", "v" + state.version));

    var banner = $("banner");
    if (state.auth.writable) banner.hidden = true;
    else { banner.className = "callout warn"; setText(banner, S.readonly || ""); banner.hidden = false; }

    renderPersonas();
    renderDefaults();
    renderPreviewModels();
    renderPacks();
    disableWrites(!state.auth.writable);
    if (selected) select(selected);
    else if (state.personas.length) select(state.personas[0].id);
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
      var tag = el("span", "tag");
      setText(tag, sourceLabel(entry));
      if (entry.effective === null) tag.className = "tag gone";
      else if (entry.source === "store") tag.className = "tag on";
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
    $("p-thinking").value = Array.isArray(draft.thinking) ? draft.thinking.join("\\n") : "";
    $("p-description").value = draft.description || "";
    if (entry.effective === null && entry.source === "store") setText($("p-note"), S.noteDeleted || "");
    else if (entry.source === "store") setText($("p-note"), S.noteStore || "");
    else setText($("p-note"), fill(S.noteBuiltin || "", { source: sourceLabel(entry) }));
    renderPersonas();
  }

  function personaDraft() {
    var thinking = $("p-thinking").value.split("\\n").map(function (line) { return line.trim(); }).filter(Boolean);
    var description = $("p-description").value.trim();
    var persona = { reply: textToReply($("p-reply").value, $("p-shape").value), thinking: thinking };
    if (description) persona.description = description;
    return persona;
  }

  $("p-shape").addEventListener("change", function () {
    $("p-reply").value = replyToText(textToReply($("p-reply").value, "one"), $("p-shape").value);
  });
  $("p-save").addEventListener("click", function () {
    if (!selected) { status(S.pickPersona || "", "warn"); return; }
    var id = $("p-id").value.trim();
    if (!/^[A-Za-z0-9._-]{1,120}$/.test(id)) { status(S.badId || "", "bad"); return; }
    put("/admin/api/personas/" + encodeURIComponent(id), personaDraft()).then(function () {
      if (knownId && knownId !== id) return del("/admin/api/personas/" + encodeURIComponent(knownId));
    }).then(function () {
      knownId = id;
      return load();
    }).then(function () {
      select(id);
      status(fill(S.saved || "", { id: id }), "");
    }).catch(fail);
  });
  $("p-revert").addEventListener("click", function () { if (selected) select(selected); });
  $("p-delete").addEventListener("click", function () {
    if (!selected) return;
    if (!window.confirm(fill(S.confirmDelete || "", { id: selected }))) return;
    del("/admin/api/personas/" + encodeURIComponent(selected)).then(function () { return load(); }).then(function () {
      status(fill(S.deleted || "", { id: selected }), "");
    }).catch(fail);
  });
  $("new-persona").addEventListener("submit", function (event) {
    event.preventDefault();
    var id = $("new-id").value.trim();
    if (!/^[A-Za-z0-9._-]{1,120}$/.test(id)) { status(S.badId || "", "bad"); return; }
    $("new-id").value = "";
    selected = id;
    knownId = null;
    $("p-id").value = id;
    $("p-shape").value = "one";
    $("p-reply").value = "{input}";
    $("p-thinking").value = "";
    $("p-description").value = "";
    renderPersonas();
    status(fill(S.newPersona || "", { id: id }), "");
  });

  /* ---- defaults ---- */
  var DEFAULT_ROWS = ["reply", "thinking", "tps", "chunk", "delayMs", "ttftMs", "log", "playground", "maxReplyChars", "models"];

  function controlFor(key, value) {
    var input;
    if (key === "thinking") {
      input = el("textarea");
      input.rows = 2;
      input.spellcheck = false;
      input.value = Array.isArray(value) ? value.join("\\n") : "";
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
    if (key === "reply") input.placeholder = "{input|upper} — or a JSON pool or keyword map";
    if (typeof value === "number") input.type = "number";
    if (Array.isArray(value)) input.value = value.join(", ");
    else if (key === "reply" && typeof value !== "string") input.value = JSON.stringify(value);
    else input.value = value === null || value === undefined ? "" : String(value);
    return input;
  }

  function readControl(key, input) {
    if (key === "playground") return input.checked;
    if (key === "thinking") return input.value.split("\\n").map(function (line) { return line.trim(); }).filter(Boolean);
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
      } catch (error) { /* not JSON, so it is a template */ }
      return text;
    }
    if (key === "models") return input.value.split(",").map(function (item) { return item.trim(); }).filter(Boolean);
    if (key === "chunk") return /^[0-9]+$/.test(input.value.trim()) ? Number(input.value.trim()) : input.value.trim();
    var number = Number(input.value);
    return Number.isFinite(number) ? number : undefined;
  }

  function monoCell(value, faint) {
    var text = summarize(value);
    var cell = el("td", "m" + (faint ? " faint" : ""), faint ? "—" : text);
    cell.title = typeof value === "string" ? value : JSON.stringify(value);
    return cell;
  }

  function renderDefaults() {
    var body = $("defaults-body");
    body.textContent = "";
    DEFAULT_ROWS.forEach(function (key) {
      var entry = state.defaults[key];
      var row = el("tr");
      row.appendChild(el("td", "k", key));
      row.appendChild(monoCell(entry.env));
      row.appendChild(monoCell(entry.stored, entry.stored === null));
      row.appendChild(monoCell(entry.effective));
      var control = el("td", "ctrl");
      var input = controlFor(key, entry.stored === null ? entry.effective : entry.stored);
      input.id = "d-" + key;
      control.appendChild(input);
      row.appendChild(control);
      var actions = el("td", "actions");
      var reset = el("button", "btn", S.reset || "Reset");
      reset.type = "button";
      reset.disabled = entry.stored === null || !state.auth.writable;
      reset.addEventListener("click", function () {
        del("/admin/api/defaults/" + key).then(function () { return load(); }).then(function () {
          status(fill(S.resetOne || "", { key: key }), "");
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
    if (changed === 0) { status(S.nothingChanged || "", ""); return; }
    put("/admin/api/defaults", patch).then(function () { return load(); }).then(function () {
      status(fill(S.savedDefaults || "", { count: changed }), "");
    }).catch(fail);
  });

  $("d-reset").addEventListener("click", function () {
    if (!window.confirm(S.confirmReset || "")) return;
    post("/admin/api/reset", {}).then(function () { return load(); }).then(function () {
      status(S.storeDropped || "", "");
    }).catch(fail);
  });

  /* ---- preview ---- */
  function renderPreviewModels() {
    var select = $("preview-model");
    var previous = select.value;
    select.textContent = "";
    var fallback = el("option", null, S.previewDefaults || "defaults");
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
    thinking.appendChild(el("div", "label", S.thinkingLabel || "thinking"));
    var thinkingText = el("div", "thinking-text");
    thinking.appendChild(thinkingText);
    var answer = el("div");
    answer.appendChild(el("div", "label", S.answerLabel || "answer"));
    var answerText = el("div", "answer");
    var caret = el("span", "caret");
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
          var frames = buffer.split("\\n\\n");
          buffer = frames.pop() || "";
          frames.forEach(function (frame) {
            var line = null;
            frame.split("\\n").forEach(function (part) { if (line === null && part.indexOf("data: ") === 0) line = part.slice(6); });
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

  /* ---- packs ---- */
  function renderPacks() {
    var index = $("pack-index");
    index.textContent = "";
    (state.packs || []).forEach(function (pack) {
      var row = el("div", "row");
      var button = el("button", "btn", (S.packsFetch || "Fetch") + " " + pack.name);
      button.type = "button";
      button.addEventListener("click", function () { fetchPack(pack.url); });
      row.appendChild(button);
      row.appendChild(el("span", "hint", pack.description));
      index.appendChild(row);
    });
  }

  function fetchPack(url) {
    status(fill(S.fetching || "", { url: url }), "");
    fetch(url, { credentials: "omit" }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status + " from " + url);
      return response.text();
    }).then(function (text) {
      JSON.parse(text);
      $("pack-json").value = text;
      status(S.fetched || "", "");
    }).catch(fail);
  }

  $("pack-fetch-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var url = $("pack-url").value.trim();
    if (url) fetchPack(url);
  });

  function packBody() {
    var text = $("pack-json").value.trim();
    if (!text) throw new Error(S.pasteFirst || "");
    return JSON.parse(text);
  }

  function showDiff(diff) {
    var lines = [];
    (diff.personas.added || []).forEach(function (id) { lines.push("+ persona " + id); });
    (diff.personas.changed || []).forEach(function (id) { lines.push("~ persona " + id); });
    (diff.personas.removed || []).forEach(function (id) { lines.push("- persona " + id); });
    (diff.defaults || []).forEach(function (entry) { lines.push("= " + entry.key + ": " + summarize(entry.from) + " -> " + summarize(entry.to)); });
    if (diff.models) lines.push("= models: " + summarize(diff.models.from) + " -> " + summarize(diff.models.to));
    if (!lines.length) lines.push(S.nothingToChange || "nothing would change");
    var out = $("pack-out");
    setText(out, lines.join("\\n"));
    out.hidden = false;
  }

  $("pack-diff").addEventListener("click", function () {
    var pack;
    try { pack = packBody(); } catch (error) { fail(error); return; }
    post("/admin/api/import", { pack: pack, apply: false }).then(function (data) {
      showDiff(data.diff);
      status(S.packPreview || "", "");
    }).catch(fail);
  });

  $("pack-apply").addEventListener("click", function () {
    var pack;
    try { pack = packBody(); } catch (error) { fail(error); return; }
    if (!window.confirm(S.confirmApply || "")) return;
    post("/admin/api/import", { pack: pack, apply: true }).then(function (data) {
      showDiff(data.diff);
      return load();
    }).then(function () { status(S.packApplied || "", ""); }).catch(fail);
  });

  $("pack-export").addEventListener("click", function () {
    post("/admin/api/export", { source: "store" }).then(function (data) {
      $("pack-json").value = JSON.stringify(data.pack, null, 2);
      status(S.exported || "", "");
    }).catch(fail);
  });

  load();
})();`;

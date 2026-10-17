import { CHAT_JS } from "./chat-client.ts";

export const ADMIN_JS = `(function () {
  "use strict";
${CHAT_JS}
  var S = window.__DUMMY_I18N || {};
  var DEFAULT_ID = "*";
  var deleteLabel = "";

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
  function fill(text, vars) {
    var out = text || "";
    for (var key in vars) out = out.replace("{" + key + "}", vars[key]);
    return out;
  }
  /* The language menu opens without script; the script only adds click-away and Escape. It runs before
     the login early return so the sign-in page, which also carries the menu, gets the same habits. */
  var langs = document.querySelectorAll("details.lang");
  function closeLangs() {
    for (var i = 0; i < langs.length; i++) langs[i].removeAttribute("open");
  }
  document.addEventListener("click", function (event) {
    for (var i = 0; i < langs.length; i++) {
      if (langs[i].hasAttribute("open") && !langs[i].contains(event.target)) langs[i].removeAttribute("open");
    }
  });
  document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeLangs(); });

  if (document.body.className.indexOf("login") !== -1) {
    var codes = { "bad-key": S.loginBadKey, "throttled": S.loginThrottled };
    var box = $("error");
    var code = new URLSearchParams(location.search).get("e");
    if (box && code && codes[code]) { setText(box, codes[code]); box.hidden = false; }
    return;
  }

  var state = null;
  var selected = null;
  var knownId = null;
  var previousShape = "one";
  var draftDescription = "";
  var resettingKey = "";

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

  deleteLabel = $("p-delete") ? $("p-delete").textContent : "Delete";

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

  function detectShape(reply) {
    if (Array.isArray(reply)) return "pool";
    if (reply && typeof reply === "object") return "keys";
    return "one";
  }
  function stringMapValues(map) {
    var values = [];
    for (var key in map) values.push(String(map[key]));
    return values;
  }
  function normaliseReplyRows(shape, data) {
    var rows = [];
    var key;
    if (shape === "one") {
      var single = "";
      if (typeof data === "string") single = data;
      else if (Array.isArray(data)) {
        var parts = [];
        for (var p = 0; p < data.length; p++) parts.push(String(data[p]));
        single = parts.join(String.fromCharCode(10, 10));
      } else if (data && typeof data === "object") {
        single = stringMapValues(data).join(String.fromCharCode(10, 10));
      }
      rows.push({ key: "", value: single });
      return rows;
    }
    if (shape === "pool") {
      if (Array.isArray(data)) {
        for (var i = 0; i < data.length; i++) {
          var item = data[i];
          rows.push({ key: "", value: item && typeof item === "object" ? String(item.value || "") : String(item) });
        }
      } else if (typeof data === "string" && data !== "") {
        rows.push({ key: "", value: data });
      } else if (data && typeof data === "object") {
        var values = stringMapValues(data);
        for (var v = 0; v < values.length; v++) rows.push({ key: "", value: values[v] });
      }
      return rows;
    }
    if (data && typeof data === "object" && !Array.isArray(data)) {
      for (key in data) rows.push({ key: key, value: String(data[key]) });
      return rows;
    }
    if (Array.isArray(data)) {
      for (var j = 0; j < data.length; j++) {
        var entry = data[j];
        if (entry && typeof entry === "object") rows.push({ key: String(entry.key || ""), value: String(entry.value || "") });
        else rows.push({ key: "", value: String(entry) });
      }
      return rows;
    }
    if (typeof data === "string" && data !== "") rows.push({ key: "*", value: data });
    return rows;
  }
  function readReplyRows(shape) {
    var rows = [];
    var nodes = $("p-reply-list").querySelectorAll(".edit-row");
    for (var i = 0; i < nodes.length; i++) {
      var area = nodes[i].querySelector("textarea");
      var keyInput = nodes[i].querySelector(".key-input");
      rows.push({ key: keyInput ? keyInput.value : "", value: area ? area.value : "" });
    }
    return rows;
  }
  function readCotRows(includeEmpty) {
    var values = [];
    var nodes = $("p-cot-list").querySelectorAll(".edit-row textarea");
    for (var i = 0; i < nodes.length; i++) {
      var value = nodes[i].value;
      if (includeEmpty) values.push(value);
      else {
        var trimmed = value.trim();
        if (trimmed) values.push(trimmed);
      }
    }
    return values;
  }
  function smallButton(text, label, disabled, handler, className) {
    var button = el("button", className || "btn mini", text);
    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.disabled = Boolean(disabled);
    button.addEventListener("click", handler);
    return button;
  }
  function addReplyRow(list, shape, index, row, total) {
    var box = el("div", "edit-row");
    var head = el("div", "row-head");
    if (shape === "keys") {
      var keyInput = el("input");
      keyInput.className = "key-input";
      keyInput.spellcheck = false;
      keyInput.value = row.key || "";
      keyInput.placeholder = S.keyPlaceholder || "keyword or *";
      keyInput.setAttribute("aria-label", S.keyPlaceholder || "keyword");
      keyInput.addEventListener("input", syncJson);
      head.appendChild(keyInput);
    } else {
      var label = shape === "one" ? (S.singleTemplate || "") : fill(S.entryLabel || "Entry {n}", { n: index + 1 });
      head.appendChild(el("span", "row-label", label));
    }
    if (shape !== "one") {
      var tools = el("div", "row-tools");
      tools.appendChild(smallButton("↑", S.moveUp || "Move up", index === 0, function () { moveReplyRow(shape, index, -1); }));
      tools.appendChild(smallButton("↓", S.moveDown || "Move down", index === total - 1, function () { moveReplyRow(shape, index, 1); }));
      tools.appendChild(smallButton(S.removeEntry || "Remove", S.removeEntry || "Remove", false, function () { removeReplyRow(shape, index); }, "btn mini danger"));
      head.appendChild(tools);
    }
    box.appendChild(head);
    var area = el("textarea");
    area.rows = 3;
    area.spellcheck = false;
    area.value = row.value || "";
    area.addEventListener("input", syncJson);
    box.appendChild(area);
    list.appendChild(box);
  }
  function renderReplyList(shape, data) {
    var list = $("p-reply-list");
    var add = $("p-reply-add");
    if (!list) return;
    list.textContent = "";
    add.hidden = shape === "one";
    var rows = normaliseReplyRows(shape, data);
    if (shape !== "one" && rows.length === 0) list.appendChild(el("p", "empty-list", S.replyEmpty || ""));
    for (var i = 0; i < rows.length; i++) addReplyRow(list, shape, i, rows[i], rows.length);
    setText($("p-reply-hint"), shape === "one" ? (S.replySingleHint || "") : shape === "pool" ? (S.replyPoolHint || "") : (S.replyKeysHint || ""));
  }
  function moveReplyRow(shape, index, direction) {
    var rows = readReplyRows(shape);
    var next = index + direction;
    if (next < 0 || next >= rows.length) return;
    var swap = rows[index]; rows[index] = rows[next]; rows[next] = swap;
    renderReplyList(shape, rows);
    syncJson();
  }
  function removeReplyRow(shape, index) {
    var rows = readReplyRows(shape);
    rows.splice(index, 1);
    renderReplyList(shape, rows);
    syncJson();
  }
  function addCotRow(list, index, value, total) {
    var box = el("div", "edit-row");
    var head = el("div", "row-head");
    head.appendChild(el("span", "row-label", fill(S.entryLabel || "Entry {n}", { n: index + 1 })));
    var tools = el("div", "row-tools");
    tools.appendChild(smallButton("↑", S.moveUp || "Move up", index === 0, function () { moveCotRow(index, -1); }));
    tools.appendChild(smallButton("↓", S.moveDown || "Move down", index === total - 1, function () { moveCotRow(index, 1); }));
    tools.appendChild(smallButton(S.removeEntry || "Remove", S.removeEntry || "Remove", false, function () { removeCotRow(index); }, "btn mini danger"));
    head.appendChild(tools);
    box.appendChild(head);
    var area = el("textarea");
    area.rows = 3;
    area.spellcheck = false;
    area.value = value;
    area.addEventListener("input", syncJson);
    box.appendChild(area);
    list.appendChild(box);
  }
  function renderCotList(values) {
    var list = $("p-cot-list");
    if (!list) return;
    list.textContent = "";
    var items = Array.isArray(values) ? values : [];
    if (items.length === 0) list.appendChild(el("p", "empty-list", S.cotEmpty || ""));
    for (var i = 0; i < items.length; i++) addCotRow(list, i, String(items[i]), items.length);
    setText($("p-cot-hint"), S.cotHint || "");
  }
  function moveCotRow(index, direction) {
    var values = readCotRows(true);
    var next = index + direction;
    if (next < 0 || next >= values.length) return;
    var swap = values[index]; values[index] = values[next]; values[next] = swap;
    renderCotList(values);
    syncJson();
  }
  function removeCotRow(index) {
    var values = readCotRows(true);
    values.splice(index, 1);
    renderCotList(values);
    syncJson();
  }

  /** The full value, never truncated: an array reads as one entry per line, everything else as JSON. */
  function format(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.length ? value.join("\\n") : "[]";
    return JSON.stringify(value);
  }

  function defaultEntry() {
    return {
      id: DEFAULT_ID,
      source: state.defaults.reply.stored === null && state.defaults.thinking.stored === null ? "builtin" : "store",
      stored: null,
      effective: { reply: state.defaults.reply.effective, thinking: state.defaults.thinking.effective },
      isDefault: true,
    };
  }
  function entries() {
    return [defaultEntry()].concat(state.personas);
  }
  function sourceLabel(entry) {
    if (entry.effective === null) return S.sourceDeleted || "deleted";
    return S["source" + entry.source.charAt(0).toUpperCase() + entry.source.slice(1)] || entry.source;
  }

  function render() {
    var chips = $("chips");
    chips.textContent = "";
    chips.appendChild(el("span", "chip on", (S.chipAuth || "auth") + ": " + (state.auth.mode || "off")));
    chips.appendChild(el("span", "chip" + (state.auth.writable ? "" : " off"), (S.chipStore || "store") + ": " + state.auth.store + (state.auth.writable ? "" : " — " + (S.chipReadonly || "read-only"))));
    chips.appendChild(el("span", "chip", "v" + state.version));

    var banner = $("banner");
    if (state.auth.writable) banner.hidden = true;
    else { banner.className = "callout warn"; setText(banner, S.readonly || ""); banner.hidden = false; }

    renderPersonas();
    renderDefaults();
    renderPreviewModels();
    previewEstimate();
    disableWrites(!state.auth.writable);
    select(selected || DEFAULT_ID);
  }

  function refresh() {
    return request("/admin/api/state").then(function (data) {
      state = data.state;
      renderPersonas();
      renderDefaults();
      renderPreviewModels();
      disableWrites(!state.auth.writable);
    }).catch(fail);
  }

  function disableWrites(readOnly) {
    ["p-save", "p-delete", "d-reset", "pack-apply"].forEach(function (id) {
      var node = $(id);
      if (node) node.disabled = readOnly;
    });
    $("new-persona").querySelector("button").disabled = readOnly;
  }

  function renderPersonas() {
    var list = $("persona-list");
    list.textContent = "";
    entries().forEach(function (entry) {
      var item = el("li");
      if (entry.id === selected) item.className = "active";
      var label = entry.isDefault ? (S.defaultEntry || "default") : entry.id;
      var idNode = el("span", "id", label);
      idNode.title = label;
      item.appendChild(idNode);
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
    var all = entries();
    for (var index = 0; index < all.length; index++) if (all[index].id === id) return all[index];
    return null;
  }

  function select(id) {
    var entry = entryFor(id);
    if (!entry) return;
    selected = id;
    knownId = entry.source === "store" && !entry.isDefault ? id : null;
    var draft = {};
    var key;
    if (entry.effective && typeof entry.effective === "object") {
      for (key in entry.effective) draft[key] = entry.effective[key];
    }
    if (entry.stored && typeof entry.stored === "object") {
      for (key in entry.stored) draft[key] = entry.stored[key];
    }
    $("p-id").value = entry.isDefault ? (S.defaultEntry || "default") : id;
    $("p-id").readOnly = Boolean(entry.isDefault);
    $("p-tps-field").hidden = Boolean(entry.isDefault);
    var shape = detectShape(draft.reply);
    $("p-shape").value = shape;
    previousShape = shape;
    renderReplyList(shape, draft.reply);
    renderCotList(Array.isArray(draft.thinking) ? draft.thinking : []);
    $("p-tps").value = typeof draft.tps === "number" ? draft.tps : "";
    draftDescription = typeof draft.description === "string" ? draft.description.trim() : "";
    $("p-json").value = JSON.stringify(draft, null, 2);
    setText($("p-delete"), entry.isDefault ? (S.reset || "Reset") : deleteLabel);
    if (entry.isDefault) setText($("p-note"), S.noteDefault || "");
    else if (entry.effective === null && entry.source === "store") setText($("p-note"), S.noteDeleted || "");
    else if (entry.source === "store") setText($("p-note"), S.noteStore || "");
    else setText($("p-note"), fill(S.noteBuiltin || "", { source: sourceLabel(entry) }));
    renderPersonas();
  }

  function personaFromForm(strict) {
    var shape = $("p-shape").value;
    var rows = readReplyRows(shape);
    var reply;
    if (shape === "one") {
      reply = rows.length ? rows[0].value : "";
    } else if (shape === "pool") {
      var values = [];
      for (var i = 0; i < rows.length; i++) {
        var value = rows[i].value.trim();
        if (value) values.push(value);
      }
      if (strict && values.length === 0) return { ok: false, error: S.needReply || "" };
      reply = values;
    } else {
      var map = {};
      var any = false;
      for (var j = 0; j < rows.length; j++) {
        var key = rows[j].key.trim();
        var text = rows[j].value.trim();
        if (!key && !text) continue;
        any = true;
        if (strict && !key) return { ok: false, error: S.needKey || "" };
        if (!key) continue;
        if (strict && Object.prototype.hasOwnProperty.call(map, key)) {
          return { ok: false, error: fill(S.duplicateKey || "", { key: key }) };
        }
        map[key] = text;
      }
      if (strict && !any) return { ok: false, error: S.needReply || "" };
      reply = map;
    }
    var persona = { reply: reply, thinking: readCotRows(false) };
    if (draftDescription) persona.description = draftDescription;
    var tpsText = $("p-tps").value.trim();
    if (tpsText !== "") {
      var tps = Number(tpsText);
      if (Number.isFinite(tps) && tps > 0) persona.tps = Math.round(tps);
    }
    return { ok: true, persona: persona };
  }

  function personaDraft() {
    var result = personaFromForm(true);
    if (!result.ok) { status(result.error, "bad"); return null; }
    return result.persona;
  }

  function syncJson() {
    var json = $("p-json");
    if (!json || document.activeElement === json) return;
    var result = personaFromForm(false);
    if (result.ok) json.value = JSON.stringify(result.persona, null, 2);
  }

  $("p-shape").addEventListener("change", function () {
    var next = $("p-shape").value;
    var oldRows = readReplyRows(previousShape);
    var data;
    var i;
    if (next === "one") {
      var parts = [];
      for (i = 0; i < oldRows.length; i++) {
        if (oldRows[i].value.trim() !== "") parts.push(oldRows[i].value);
      }
      data = parts.join(String.fromCharCode(10, 10));
    } else if (next === "pool") {
      data = [];
      for (i = 0; i < oldRows.length; i++) {
        if (oldRows[i].value.trim() !== "") data.push(oldRows[i].value);
      }
    } else {
      data = [];
      for (i = 0; i < oldRows.length; i++) {
        var key = previousShape === "keys" ? oldRows[i].key.trim() : (i === 0 ? "*" : "");
        data.push({ key: key, value: oldRows[i].value });
      }
    }
    previousShape = next;
    renderReplyList(next, data);
    syncJson();
  });
  $("p-reply-add").addEventListener("click", function () {
    var shape = $("p-shape").value;
    if (shape === "one") return;
    var rows = readReplyRows(shape);
    rows.push({ key: "", value: "" });
    if (shape === "pool") {
      var values = [];
      for (var i = 0; i < rows.length; i++) values.push(rows[i].value);
      renderReplyList("pool", values);
    } else {
      renderReplyList("keys", rows);
    }
    syncJson();
    var areas = $("p-reply-list").querySelectorAll("textarea");
    if (areas.length) areas[areas.length - 1].focus();
  });
  $("p-cot-add").addEventListener("click", function () {
    var values = readCotRows(true);
    values.push("");
    renderCotList(values);
    syncJson();
    var areas = $("p-cot-list").querySelectorAll("textarea");
    if (areas.length) areas[areas.length - 1].focus();
  });
  $("p-json-apply").addEventListener("click", function () {
    var text = $("p-json").value.trim();
    if (!text) { status(S.jsonBad || "", "bad"); return; }
    var value = null;
    try { value = JSON.parse(text); } catch (error) { value = null; }
    if (value === null || typeof value !== "object" || Array.isArray(value)) { status(S.jsonBad || "", "bad"); return; }
    var shape = detectShape(value.reply);
    $("p-shape").value = shape;
    previousShape = shape;
    renderReplyList(shape, value.reply);
    renderCotList(Array.isArray(value.thinking) ? value.thinking : []);
    $("p-tps").value = typeof value.tps === "number" && Number.isFinite(value.tps) ? Math.round(value.tps) : "";
    draftDescription = typeof value.description === "string" ? value.description.trim() : "";
    status(S.jsonApplied || "", "");
  });
  $("p-tps").addEventListener("input", syncJson);
  $("p-save").addEventListener("click", function () {
    if (!selected) { status(S.pickPersona || "", "warn"); return; }
    var draft = personaDraft();
    if (!draft) return;
    if (selected === DEFAULT_ID) {
      put("/admin/api/defaults", { reply: draft.reply, thinking: draft.thinking }).then(function () { return load(); }).then(function () {
        status(fill(S.saved || "", { id: S.defaultEntry || "default" }), "");
      }).catch(fail);
      return;
    }
    var id = $("p-id").value.trim();
    if (!/^[A-Za-z0-9._-]{1,120}$/.test(id)) { status(S.badId || "", "bad"); return; }
    put("/admin/api/personas/" + encodeURIComponent(id), draft).then(function () {
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
    if (selected === DEFAULT_ID) {
      if (!window.confirm(S.resetDefault || "")) return;
      del("/admin/api/defaults/reply").then(function () { return del("/admin/api/defaults/thinking"); }).then(function () { return load(); }).then(function () {
        status(S.defaultReset || "", "");
      }).catch(fail);
      return;
    }
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
    $("p-id").readOnly = false;
    $("p-id").value = id;
    $("p-tps-field").hidden = false;
    $("p-tps").value = "";
    $("p-shape").value = "one";
    previousShape = "one";
    renderReplyList("one", "{input}");
    renderCotList([]);
    draftDescription = "";
    $("p-json").value = JSON.stringify({ reply: "{input}", thinking: [] }, null, 2);
    setText($("p-delete"), deleteLabel);
    renderPersonas();
    status(fill(S.newPersona || "", { id: id }), "");
  });

  var DEFAULT_ROWS = ["tps", "chunk", "delayMs", "ttftMs", "log", "playground", "maxReplyChars", "models"];
  var DEFAULT_TEXT = {
    tps: "varTps",
    chunk: "varChunk",
    delayMs: "varDelayMs",
    ttftMs: "varTtftMs",
    log: "varLog",
    playground: "varPlayground",
    maxReplyChars: "varMaxReplyChars",
    models: "varModels",
  };

  function controlFor(key, value) {
    var input;
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
    if (key === "models") {
      input.placeholder = "model-a, model-b";
      input.value = Array.isArray(value) ? value.join(", ") : value === null || value === undefined ? "" : String(value);
      return input;
    }
    if (key === "chunk") {
      input.placeholder = "4 / word / line / whole";
      input.value = value === null || value === undefined ? "" : String(value);
      return input;
    }
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.value = value === null || value === undefined ? "" : String(value);
    return input;
  }

  function readControl(key, input) {
    if (key === "playground") return input.checked;
    if (key === "log") return input.value;
    if (key === "models") {
      var models = input.value.split(",").map(function (item) { return item.trim(); }).filter(Boolean);
      return models.length ? models : undefined;
    }
    var text = input.value.trim();
    if (text === "") return undefined;
    if (key === "chunk") {
      if (text === "word" || text === "line" || text === "whole") return text;
      if (!/^[0-9]+$/.test(text)) return undefined;
      var size = Number(text);
      return size > 0 && size <= 100000 ? size : undefined;
    }
    var number = Math.round(Number(text));
    if (!Number.isFinite(number) || number < 0) return undefined;
    if (key === "tps" && number > 100000) return undefined;
    if (key === "delayMs" && number > 600000) return undefined;
    if (key === "ttftMs" && number > 600000) return undefined;
    if (key === "maxReplyChars" && number > 10000000) return undefined;
    return number;
  }

  function inlineValue(value) {
    if (Array.isArray(value)) return value.join(", ");
    return format(value);
  }

  function deleteDefault(key) {
    resettingKey = "";
    del("/admin/api/defaults/" + encodeURIComponent(key)).then(function () {
      return refresh();
    }).then(function () {
      status(fill(S.resetOne || "", { key: key }), "");
    }).catch(fail);
  }

  function commitDefault(key) {
    var input = $("d-" + key);
    if (!input) return;
    if (resettingKey === key) { resettingKey = ""; return; }
    var value = readControl(key, input);
    var entry = state.defaults[key];
    if (value === undefined) {
      status(fill(S.badValue || "", { key: key }), "bad");
      refresh();
      return;
    }
    if (JSON.stringify(value) === JSON.stringify(entry.env)) {
      if (entry.stored !== null) { deleteDefault(key); return; }
      if (JSON.stringify(value) === JSON.stringify(entry.effective)) {
        status(S.nothingChanged || "", "");
        return;
      }
    }
    if (JSON.stringify(value) === JSON.stringify(entry.effective)) {
      status(S.nothingChanged || "", "");
      return;
    }
    var patch = {};
    patch[key] = value;
    var activeId = document.activeElement && document.activeElement.id ? document.activeElement.id : "";
    put("/admin/api/defaults", patch).then(function () {
      return refresh();
    }).then(function () {
      if (activeId && $(activeId)) $(activeId).focus();
      status(fill(S.savedOne || "", { key: key }), "");
    }).catch(fail);
  }

  function renderDefaults() {
    var body = $("defaults-body");
    body.textContent = "";
    DEFAULT_ROWS.forEach(function (key) {
      var entry = state.defaults[key];
      var row = el("tr");
      var setting = el("td", "setting");
      setting.appendChild(el("span", "setting-key", key));
      if (entry.stored !== null) setting.appendChild(el("span", "setting-badge", S.overridden || "stored"));
      setting.appendChild(el("span", "setting-desc", S[DEFAULT_TEXT[key]] || ""));
      row.appendChild(setting);
      var env = el("td", "m env");
      setText(env, inlineValue(entry.env));
      row.appendChild(env);
      var effective = el("td", "effective");
      var wrap = el("div", "effective-cell");
      var input = controlFor(key, entry.effective);
      input.id = "d-" + key;
      input.disabled = !state.auth.writable;
      input.addEventListener("change", function () { commitDefault(key); });
      wrap.appendChild(input);
      var reset = el("button", "btn mini", S.reset || "Reset");
      reset.type = "button";
      reset.title = fill(S.resetOne || "", { key: key });
      reset.disabled = entry.stored === null || !state.auth.writable;
      reset.addEventListener("mousedown", function () { resettingKey = key; });
      reset.addEventListener("click", function () { deleteDefault(key); });
      wrap.appendChild(reset);
      effective.appendChild(wrap);
      row.appendChild(effective);
      body.appendChild(row);
    });
  }

  $("d-reset").addEventListener("click", function () {
    if (!window.confirm(S.confirmReset || "")) return;
    post("/admin/api/reset", {}).then(function () { return load(); }).then(function () {
      status(S.storeDropped || "", "");
    }).catch(fail);
  });

  var previewModel = "";
  var previewButtons = [];
  var previewOpen = false;
  function closePreviewMenu() {
    if ($("preview-menu")) $("preview-menu").hidden = true;
    if ($("preview-pick")) $("preview-pick").setAttribute("aria-expanded", "false");
    previewOpen = false;
  }
  function renderPreviewModels() {
    var menu = $("preview-menu");
    if (!menu) return;
    menu.textContent = "";
    previewButtons = [];
    var options = [{ id: "", label: S.previewDefaults || "defaults" }];
    state.models.forEach(function (id) { options.push({ id: id, label: id }); });
    options.forEach(function (option) {
      var li = el("li");
      li.setAttribute("role", "option");
      var button = el("button");
      button.type = "button";
      button.setAttribute("data-model", option.id);
      button.appendChild(el("span", "name", option.label));
      button.appendChild(el("span", "check", "\u2713"));
      button.addEventListener("click", function () {
        previewModel = option.id;
        setText($("preview-name"), option.label);
        previewButtons.forEach(function (other) { other.className = other === button ? "on" : ""; });
        closePreviewMenu();
      });
      li.appendChild(button);
      menu.appendChild(li);
      previewButtons.push(button);
    });
    var known = false;
    for (var i = 0; i < options.length; i++) if (options[i].id === previewModel) known = true;
    if (!known) previewModel = state.models.length ? state.models[0] : "";
    setText($("preview-name"), previewModel || (S.previewDefaults || "defaults"));
    previewButtons.forEach(function (button) {
      button.className = button.getAttribute("data-model") === previewModel ? "on" : "";
    });
  }
  if ($("preview-pick")) {
    $("preview-pick").addEventListener("click", function (event) {
      event.stopPropagation();
      var menu = $("preview-menu");
      if (previewOpen) closePreviewMenu();
      else { menu.hidden = false; $("preview-pick").setAttribute("aria-expanded", "true"); previewOpen = true; }
    });
    document.addEventListener("click", function (event) {
      if (previewOpen && !$("preview-menu").contains(event.target) && event.target !== $("preview-pick")) closePreviewMenu();
    });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") closePreviewMenu(); });
  }

  function estimateTokens(text) { return Math.max(1, Math.ceil(String(text || "").length / 4)); }
  function previewEstimate() {
    var stats = $("preview-stats");
    if (!stats) return;
    setText(stats, fill(S.statsPrompt || "", { n: estimateTokens($("preview-input").value || "hello") }));
  }
  if ($("preview-input")) $("preview-input").addEventListener("input", previewEstimate);

  $("preview-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var draft = personaDraft();
    if (!draft) return;
    var input = $("preview-input").value || "hello";
    var stream = $("preview-stream");
    /* The preview draws the same view as the public page, and it accumulates the same way. */
    var empty = stream.querySelector(".empty");
    if (empty) empty.remove();
    var chat = chatWidget(stream, S.chat);
    chat.addUser(input);
    var bot = chat.addBot();
    var settle = chat.thoughtStarted(bot);
    var settled = false;
    var finished = function () {
      if (!settled) { settled = true; settle(); }
      if (!bot.thinkingText.textContent) bot.box.remove();
    };
    stream.scrollTop = stream.scrollHeight;
    var button = $("preview-form").querySelector("button.send");
    if (button) button.disabled = true;
    var startedAt = performance.now();
    var firstAt = 0;
    var usage = null;

    fetch("/admin/api/preview", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: input, model: previewModel, patch: draft }),
    }).then(function (response) {
      if (!response.ok || !response.body) {
        return response.text().then(function (text) {
          finished();
          bot.caret.remove();
          setText(bot.answerText, "HTTP " + response.status + " " + text);
          bot.answerText.className = "answer error";
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
            if (chunk.usage) usage = chunk.usage;
            var delta = (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) || {};
            if (typeof delta.reasoning_content === "string") {
              if (!firstAt) firstAt = performance.now();
              bot.thinkingText.textContent += delta.reasoning_content;
              bot.thinkingText.scrollTop = bot.thinkingText.scrollHeight;
              stream.scrollTop = stream.scrollHeight;
            }
            if (typeof delta.content === "string") {
              if (!firstAt) firstAt = performance.now();
              if (!settled) { settled = true; settle(); }
              bot.caret.remove();
              bot.answerText.textContent += delta.content;
              bot.answerText.appendChild(bot.caret);
              stream.scrollTop = stream.scrollHeight;
            }
          });
          return pump();
        });
      }
      return pump().then(function () {
        finished();
        bot.caret.remove();
        var stats = $("preview-stats");
        if (stats) {
          var done = performance.now();
          var completion = usage ? usage.completion_tokens : estimateTokens(bot.answerText.textContent);
          var spanned = Math.max(120, firstAt ? done - firstAt : done - startedAt);
          setText(stats, fill(S.statsAfter || "", {
            p: usage ? usage.prompt_tokens : estimateTokens(input),
            c: completion,
            tps: (completion / (spanned / 1000)).toFixed(1),
          }));
        }
      });
    }).catch(function (error) {
      finished();
      bot.box.remove();
      bot.caret.remove();
      setText(bot.answerText, String(error));
      bot.answerText.className = "answer error";
    }).then(function () { if (button) button.disabled = false; });
  });

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
  var packButtons = document.querySelectorAll("[data-pack-url]");
  for (var p = 0; p < packButtons.length; p++) {
    packButtons[p].addEventListener("click", function (event) { fetchPack(event.currentTarget.getAttribute("data-pack-url")); });
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
    (diff.defaults || []).forEach(function (entry) { lines.push("= " + entry.key + ": " + format(entry.from) + " -> " + format(entry.to)); });
    if (diff.models) lines.push("= models: " + format(diff.models.from) + " -> " + format(diff.models.to));
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

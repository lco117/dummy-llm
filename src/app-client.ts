export const APP_JS = `(function () {
  "use strict";
  var S = window.__DUMMY_I18N || {};
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function fill(text, vars) {
    var out = text || "";
    for (var key in vars) out = out.replace("{" + key + "}", vars[key]);
    return out;
  }

  var tabs = document.querySelectorAll(".cmd-tab");
  function selectTab(button) {
    var id = button.getAttribute("data-tab");
    for (var i = 0; i < tabs.length; i++) tabs[i].setAttribute("aria-selected", tabs[i] === button ? "true" : "false");
    var panels = document.querySelectorAll(".cmd-panel[data-tab]");
    for (var j = 0; j < panels.length; j++) {
      if (panels[j].getAttribute("data-tab") === id) panels[j].setAttribute("data-on", "");
      else panels[j].removeAttribute("data-on");
    }
  }
  for (var t = 0; t < tabs.length; t++) tabs[t].addEventListener("click", function (event) { selectTab(event.currentTarget); });

  var blocks = document.querySelectorAll(".cmd");
  for (var b = 0; b < blocks.length; b++) {
    (function (block) {
      var buttons = block.querySelectorAll("[data-term-btn]");
      function setTerm(term) {
        for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute("aria-selected", buttons[i].getAttribute("data-term-btn") === term ? "true" : "false");
        var panels = block.querySelectorAll("[data-term-panel]");
        for (var j = 0; j < panels.length; j++) panels[j].hidden = panels[j].getAttribute("data-term-panel") !== term;
      }
      for (var k = 0; k < buttons.length; k++) {
        buttons[k].addEventListener("click", function (event) { setTerm(event.currentTarget.getAttribute("data-term-btn")); });
      }
    })(blocks[b]);
  }

  var copies = document.querySelectorAll("button.copy");
  for (var c = 0; c < copies.length; c++) {
    copies[c].addEventListener("click", function (event) {
      var button = event.currentTarget;
      var block = button.closest(".cmd");
      var pres = block ? block.querySelectorAll("pre") : [];
      var text = "";
      for (var i = 0; i < pres.length; i++) if (!pres[i].hidden) text = pres[i].textContent;
      if (!navigator.clipboard || !text) return;
      navigator.clipboard.writeText(text.replace(/^\\$ /gm, "")).then(function () {
        button.textContent = S.copied || "Copied";
        setTimeout(function () { button.textContent = S.copy || "Copy"; }, 1400);
      });
    });
  }

  var form = $("ask");
  var input = $("prompt");
  var button = $("send");
  var stream = $("stream");
  var editor = $("template");
  var stats = $("stats");
  var pick = $("model-pick");
  var menu = $("model-menu");
  var nameEl = $("model-name");
  var items = menu ? menu.querySelectorAll("button[data-model]") : [];
  var playground = form && form.getAttribute("data-playground") === "1";
  var chosen = nameEl ? nameEl.textContent : "";

  function closeMenu() { if (menu) menu.hidden = true; if (pick) pick.setAttribute("aria-expanded", "false"); }
  if (pick && menu) {
    pick.addEventListener("click", function (event) {
      event.stopPropagation();
      if (menu.hidden) { menu.hidden = false; pick.setAttribute("aria-expanded", "true"); }
      else closeMenu();
    });
    for (var m = 0; m < items.length; m++) {
      items[m].addEventListener("click", function (event) {
        var item = event.currentTarget;
        chosen = item.getAttribute("data-model") || chosen;
        if (nameEl) nameEl.textContent = chosen;
        for (var i = 0; i < items.length; i++) items[i].className = items[i] === item ? "on" : "";
        closeMenu();
      });
    }
    document.addEventListener("click", function (event) {
      if (!menu.hidden && !menu.contains(event.target) && event.target !== pick) closeMenu();
    });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeMenu(); });
  }

  function currentTemplate() { return playground && editor ? editor.value.trim() : ""; }
  function estimateTokens(text) { return Math.max(1, Math.ceil(text.length / 4)); }
  function refreshComposer() {
    var usingTemplate = currentTemplate() !== "";
    if (form) form.className = usingTemplate ? "composer locked" : "composer";
    if (pick) pick.title = usingTemplate ? (S.templateWins || "") : "";
    if (!stats) return;
    stats.textContent = usingTemplate
      ? (S.templateWins || "")
      : fill(S.statsPrompt || "", { n: estimateTokens((input && input.value) || "hello") });
  }
  if (input) input.addEventListener("input", refreshComposer);
  refreshComposer();

  if (playground && editor) {
    var initial = new URLSearchParams(location.search).get("t");
    if (initial) editor.value = initial;
    editor.addEventListener("input", function () {
      var url = new URL(location.href);
      var value = editor.value.trim();
      if (value) url.searchParams.set("t", value); else url.searchParams.delete("t");
      history.replaceState(null, "", url);
      refreshComposer();
    });
    refreshComposer();
  }

  function renderStream() {
    stream.textContent = "";
    if (currentTemplate()) stream.appendChild(el("p", "visitor", S.visitor || ""));
    var thinking = el("div");
    thinking.appendChild(el("div", "label", S.thinking || "thinking"));
    var thinkingText = el("div", "thinking-text");
    thinking.appendChild(thinkingText);
    var answer = el("div");
    answer.appendChild(el("div", "label", S.answer || "answer"));
    var answerText = el("div", "answer");
    var caret = el("span", "caret");
    answerText.appendChild(caret);
    answer.appendChild(answerText);
    stream.appendChild(thinking);
    stream.appendChild(answer);
    return { thinking: thinking, thinkingText: thinkingText, answerText: answerText, caret: caret };
  }

  if (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var prompt = ((input && input.value) || "").trim() || "hello";
      var template = currentTemplate();
      var model = template ? "dummy-playground" : chosen;
      var ui = renderStream();
      if (button) button.disabled = true;
      var startedAt = performance.now();
      var firstAt = 0;
      var usage = null;
      try {
        var endpoint = "/v1/chat/completions" + (template ? "?t=" + encodeURIComponent(template) : "");
        var response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: model,
            stream: true,
            stream_options: { include_usage: true },
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (!response.ok || !response.body) {
          ui.thinking.remove();
          ui.answerText.textContent = fill(S.httpError, { status: response.status });
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
            if (chunk.usage) usage = chunk.usage;
            var delta = (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) || {};
            if (typeof delta.reasoning_content === "string") {
              if (!firstAt) firstAt = performance.now();
              ui.thinkingText.textContent += delta.reasoning_content;
              ui.thinkingText.scrollTop = ui.thinkingText.scrollHeight;
            }
            if (typeof delta.content === "string") {
              if (!firstAt) firstAt = performance.now();
              ui.caret.remove();
              ui.answerText.textContent += delta.content;
              ui.answerText.appendChild(ui.caret);
            }
          }
        }
        if (ui.thinkingText.textContent === "") ui.thinking.remove();
        ui.caret.remove();
        if (stats) {
          var done = performance.now();
          var completion = usage ? usage.completion_tokens : estimateTokens(ui.answerText.textContent);
          var spanned = Math.max(120, (firstAt ? done - firstAt : done - startedAt));
          stats.textContent = fill(S.statsAfter, {
            p: usage ? usage.prompt_tokens : estimateTokens(prompt),
            c: completion,
            tps: (completion / (spanned / 1000)).toFixed(1),
          });
        }
      } catch (error) {
        ui.answerText.textContent = S.networkError || String(error);
        ui.answerText.className = "answer error";
        ui.caret.remove();
      } finally {
        if (button) button.disabled = false;
      }
    });
  }
})();`;

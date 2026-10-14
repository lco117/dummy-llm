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

  /* The language menu is a <details>, so it opens and closes without a line of script. The script only
     adds the two habits a menu is expected to have: click anywhere else, or press Escape, and it shuts. */
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

  /* The neuron field behind the page. Sparse on purpose: a handful of nodes, an edge only where two are
     close, and everything near the cursor leans in and lights up. One canvas, redrawn at about 30fps,
     stopped when the tab is hidden and left still when the visitor asked for less motion. */
  var canvas = $("neurons");
  if (canvas && canvas.getContext) {
    (function (surface) {
      var ctx = surface.getContext("2d");
      var calm = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var REACH = 250, LINK = 244, LEAN = 18;
      var W = 0, H = 0, nodes = [], last = 0, queued = 0, pending = 0;
      var at = { x: -1e4, y: -1e4 };

      function gap(ax, ay, bx, by) {
        var dx = ax - bx, dy = ay - by;
        return Math.sqrt(dx * dx + dy * dy);
      }

      function seed() {
        var count = Math.max(14, Math.min(62, Math.round((W * H) / 36000)));
        nodes = [];
        for (var i = 0; i < count; i++) {
          nodes.push({
            x: Math.random() * W, y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
            r: 1.15 + Math.random() * 1.6, ox: 0, oy: 0
          });
        }
      }

      function advance() {
        for (var i = 0; i < nodes.length; i++) {
          var n = nodes[i];
          n.x += n.vx; n.y += n.vy;
          if (n.x < -24) n.x = W + 24; else if (n.x > W + 24) n.x = -24;
          if (n.y < -24) n.y = H + 24; else if (n.y > H + 24) n.y = -24;
          var dx = at.x - n.x, dy = at.y - n.y;
          var d = Math.sqrt(dx * dx + dy * dy) || 1;
          var pull = d < REACH ? (1 - d / REACH) : 0;
          n.ox += ((dx / d) * pull * LEAN - n.ox) * 0.12;
          n.oy += ((dy / d) * pull * LEAN - n.oy) * 0.12;
        }
      }

      function draw() {
        ctx.clearRect(0, 0, W, H);
        var i, j, n, m, nx, ny, mx, my, d, hot, alpha;
        for (i = 0; i < nodes.length; i++) {
          n = nodes[i];
          nx = n.x + n.ox; ny = n.y + n.oy;
          var na = gap(at.x, at.y, nx, ny);
          var nh = na < REACH ? 1 - na / REACH : 0;
          for (j = i + 1; j < nodes.length; j++) {
            m = nodes[j];
            mx = m.x + m.ox; my = m.y + m.oy;
            d = gap(nx, ny, mx, my);
            if (d > LINK) continue;
            var ma = gap(at.x, at.y, mx, my);
            hot = Math.max(nh, ma < REACH ? 1 - ma / REACH : 0);
            alpha = (1 - d / LINK) * (0.18 + hot * 0.5);
            ctx.strokeStyle = hot > 0.02
              ? "rgba(139,163,255," + alpha.toFixed(3) + ")"
              : "rgba(110,231,200," + alpha.toFixed(3) + ")";
            ctx.lineWidth = hot > 0.35 ? 1.25 : 1;
            ctx.beginPath();
            ctx.moveTo(nx, ny);
            ctx.lineTo(mx, my);
            ctx.stroke();
          }
        }
        for (i = 0; i < nodes.length; i++) {
          n = nodes[i];
          nx = n.x + n.ox; ny = n.y + n.oy;
          var pa = gap(at.x, at.y, nx, ny);
          hot = pa < REACH ? 1 - pa / REACH : 0;
          ctx.beginPath();
          ctx.arc(nx, ny, n.r + hot * 1.7, 0, 6.2832);
          ctx.fillStyle = hot > 0.02
            ? "rgba(200,214,255," + (0.30 + hot * 0.6).toFixed(3) + ")"
            : "rgba(154,167,186," + (0.40 + n.r * 0.05).toFixed(3) + ")";
          ctx.fill();
        }
      }

      /* The loop is armed once and never cancelled. A hidden tab simply does not get frames, so the
         check here is belt and braces - it keeps a background tab from paying for a background nobody
         can see, without the start/stop dance that can leave a loop dead when visibility flaps. */
      function frame(now) {
        requestAnimationFrame(frame);
        if (now - last < 33 || document.hidden) return;
        last = now;
        advance();
        draw();
      }
      function repaint() {
        if (queued || !calm) return;
        queued = requestAnimationFrame(function () { queued = 0; draw(); });
      }

      function resize() {
        W = window.innerWidth || document.documentElement.clientWidth || 0;
        H = window.innerHeight || document.documentElement.clientHeight || 0;
        surface.width = Math.max(1, Math.round(W * dpr));
        surface.height = Math.max(1, Math.round(H * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        seed();
        draw();
      }

      window.addEventListener("resize", function () {
        if (pending) return;
        pending = requestAnimationFrame(function () { pending = 0; resize(); });
      });
      window.addEventListener("pointermove", function (event) {
        at.x = event.clientX; at.y = event.clientY; repaint();
      }, { passive: true });
      window.addEventListener("pointerleave", function () { at.x = -1e4; at.y = -1e4; repaint(); });
      window.addEventListener("blur", function () { at.x = -1e4; at.y = -1e4; repaint(); });
      resize();
      if (!calm) requestAnimationFrame(frame);
    })(canvas);
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
      var panel = button.closest(".cmd-panel") || button.closest(".cmd");
      var pres = panel ? panel.querySelectorAll("pre") : [];
      var text = "";
      for (var i = 0; i < pres.length; i++) if (!pres[i].hidden) text = pres[i].textContent;
      if (!navigator.clipboard || !text) return;
      navigator.clipboard.writeText(text.replace(/^\\$ /gm, "")).then(function () {
        button.className = "copy done";
        button.setAttribute("aria-label", S.copied || "Copied");
        setTimeout(function () {
          button.className = "copy";
          button.setAttribute("aria-label", S.copy || "Copy");
        }, 1400);
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

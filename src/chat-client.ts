/**
 * The conversation view that both client scripts draw.
 *
 * It is a string because both client scripts are strings, and it is shared because the administration
 * preview has to show exactly what the public page shows. Two implementations would drift apart, and
 * the difference would only ever be visible on one of the two pages.
 *
 * The caller supplies the labels and the scrolling container; the widget owns the markup, the seconds
 * counter on the reasoning block, the collapse that follows it, the time stamp under each message and
 * the two copy buttons. Every node is built with createElement, so no value is ever interpolated into
 * markup.
 */
export const CHAT_JS = `  var CHAT_SVG = "http://www.w3.org/2000/svg";
  var CHAT_COPY_PATH = "M9 9h10v10H9zM5 15V5h10";
  var CHAT_DONE_PATH = "M5 13l4 4L19 7";

  /**
   * The labels object carries: thinking ("Thinking… {n}s"), thought ("Thought for {n}s"), copy, copied.
   * The two time templates are the only ones with a placeholder, and {n} is a whole number of seconds.
   */
  function chatWidget(stream, strings) {
    var C = strings || {};
    var L = {
      thinking: C.thinking || "{n}s",
      thought: C.thought || "{n}s",
      copy: C.copy || "Copy",
      copied: C.copied || "Copied"
    };

    function node(tag, cls, text) {
      var found = document.createElement(tag);
      if (cls) found.className = cls;
      if (text !== undefined) found.textContent = text;
      return found;
    }

    function glyph(d, cls) {
      var svg = document.createElementNS(CHAT_SVG, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.setAttribute("aria-hidden", "true");
      if (cls) svg.setAttribute("class", cls);
      var path = document.createElementNS(CHAT_SVG, "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
      return svg;
    }

    function two(value) { return (value < 10 ? "0" : "") + value; }

    function stamp() {
      var now = new Date();
      return two(now.getHours()) + ":" + two(now.getMinutes()) + ":" + two(now.getSeconds());
    }

    function copyButton(text, label) {
      var button = node("button", "msg-copy");
      button.type = "button";
      button.setAttribute("aria-label", label);
      button.title = label;
      button.appendChild(glyph(CHAT_COPY_PATH, "i-copy"));
      button.appendChild(glyph(CHAT_DONE_PATH, "i-done"));
      button.addEventListener("click", function () {
        var value = typeof text === "function" ? text() : text;
        if (!navigator.clipboard || !value) return;
        navigator.clipboard.writeText(value).then(function () {
          button.className = "msg-copy done";
          button.setAttribute("aria-label", L.copied);
          setTimeout(function () {
            button.className = "msg-copy";
            button.setAttribute("aria-label", label);
          }, 1400);
        });
      });
      return button;
    }

    function metaRow(copyOf) {
      var meta = node("div", "meta");
      meta.appendChild(node("span", "clock", stamp()));
      meta.appendChild(copyButton(copyOf, L.copy));
      return meta;
    }

    /** One message from the visitor, on the right, with the time and a copy button under it. */
    function addUser(text) {
      var turn = node("article", "turn me");
      var wrap = node("div", "wrap");
      wrap.appendChild(node("div", "said", text));
      wrap.appendChild(metaRow(text));
      turn.appendChild(wrap);
      stream.appendChild(turn);
      return turn;
    }

    /** One answer, on the left: the reasoning block, then the reply, then the time and a copy button. */
    function addBot() {
      var turn = node("article", "turn bot");
      var wrap = node("div", "wrap");

      var box = document.createElement("details");
      box.className = "thought";
      box.open = true;
      var summary = document.createElement("summary");
      var state = node("span", "state", L.thinking.replace("{n}", "0"));
      summary.appendChild(state);
      summary.appendChild(node("span", "chev", "⌄"));
      box.appendChild(summary);
      var thinkingText = node("div", "thinking-text");
      box.appendChild(thinkingText);

      var answerText = node("div", "answer");
      var caret = node("span", "caret");
      answerText.appendChild(caret);

      wrap.appendChild(box);
      wrap.appendChild(answerText);
      wrap.appendChild(metaRow(function () { return answerText.textContent || ""; }));
      turn.appendChild(wrap);
      stream.appendChild(turn);

      return { root: turn, box: box, state: state, thinkingText: thinkingText, answerText: answerText, caret: caret };
    }

    /**
     * Starts the seconds counter that the reasoning header shows. The returned function stops the
     * counter, writes the final duration and folds the block away, which is what the answer arriving
     * should do. It is safe to call more than once.
     */
    function thoughtStarted(handle) {
      var from = Date.now();
      var done = false;
      var timer = setInterval(function () {
        handle.state.textContent = L.thinking.replace("{n}", String(Math.round((Date.now() - from) / 1000)));
      }, 250);
      return function settled() {
        if (done) return;
        done = true;
        clearInterval(timer);
        handle.state.textContent = L.thought.replace("{n}", String(Math.max(1, Math.round((Date.now() - from) / 1000))));
        handle.box.open = false;
      };
    }

    return { addUser: addUser, addBot: addBot, thoughtStarted: thoughtStarted, stamp: stamp };
  }
`;

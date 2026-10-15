/**
 * The shared shell: design tokens, the chrome both pages use, and the few components that must look
 * identical on the public page and in the admin.
 *
 * Two constraints shaped this file:
 *   - the pages are served under a strict CSP with no font-src, so there are no webfonts. The type is
 *     system fonts picked per script (with CJK fallbacks) rather than downloaded.
 *   - there is no build step, so the token block below is the only place a colour or a radius lives.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const BASE_CSS = `  :root {
    color-scheme: dark;
    --bg: #0a0b0d;
    --bg-elev: #101216;
    --panel: #0e1013;
    --line: rgba(255, 255, 255, .085);
    --line-strong: rgba(255, 255, 255, .16);
    --text: #e9edf3;
    --muted: #98a2b3;
    --faint: #6b7480;
    --accent: #4d6bfe;
    --accent-hi: #7b90ff;
    --accent-soft: rgba(77, 107, 254, .12);
    --teal: #6ee7c8;
    --ok: #4ade80;
    --warn: #fbbf24;
    --bad: #f87171;
    --hover: rgba(255, 255, 255, .06);
    --hover-strong: rgba(255, 255, 255, .09);
    --slab: rgba(255, 255, 255, .025);
    --menu: #1b1e23;
    --field: rgba(0, 0, 0, .32);
    --soft: #ccd4de;
    --top: rgba(10, 11, 13, .82);
    --code: #dbe3ee;
    --shadow: rgba(0, 0, 0, .55);
    --sh-cmd: #6ee7c8;
    --sh-flag: #7b90ff;
    --sh-str: #e0b978;
    --sh-op: #8b93a1;
    --sh-url: #7cc4f8;
    --sh-var: #e08fd0;
    --radius: 12px;
    --radius-sm: 8px;
    --mono: ui-monospace, "SFMono-Regular", "SF Mono", "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  }
  /* Daylight. Only the tokens change: every rule below is written against them, so a theme is a
     palette and never a second stylesheet to keep in step. */
  html[data-theme="light"] {
    color-scheme: light;
    --bg: #f4f3ef;
    --bg-elev: #ffffff;
    --panel: #ffffff;
    --line: rgba(20, 22, 28, .12);
    --line-strong: rgba(20, 22, 28, .22);
    --text: #14161b;
    --muted: #565f6d;
    --faint: #838b97;
    --accent: #3b55e6;
    --accent-hi: #2b41c4;
    --accent-soft: rgba(59, 85, 230, .10);
    --teal: #0d7a63;
    --ok: #17854a;
    --warn: #9a6200;
    --bad: #c23636;
    --hover: rgba(20, 22, 28, .05);
    --hover-strong: rgba(20, 22, 28, .08);
    --slab: rgba(20, 22, 28, .035);
    --menu: #ffffff;
    --field: rgba(255, 255, 255, .85);
    --soft: #3a4250;
    --top: rgba(244, 243, 239, .85);
    --code: #23282f;
    --shadow: rgba(20, 22, 28, .18);
    --sh-cmd: #0b6b58;
    --sh-flag: #2f46c9;
    --sh-str: #8a5a12;
    --sh-op: #6b7280;
    --sh-url: #0b62a8;
    --sh-var: #9b3d8f;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    min-height: 100vh;
    background-color: var(--bg);
    background-image:
      radial-gradient(900px 460px at 8% -8%, rgba(77, 107, 254, .10), transparent 62%),
      radial-gradient(700px 400px at 100% 0%, rgba(110, 231, 200, .05), transparent 58%);
    background-repeat: no-repeat;
    color: var(--text);
    font-family: var(--sans);
    font-size: 17.5px;
    line-height: 1.7;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--accent-hi); text-decoration: none; }
  a:hover { text-decoration: underline; text-underline-offset: 3px; }
  code, pre, kbd { font-family: var(--mono); }
  code { color: var(--teal); background: rgba(110, 231, 200, .07); border-radius: 5px; padding: 0 .28em; font-size: .92em; }
  h1, h2, h3 { margin: 0; font-weight: 650; letter-spacing: -.02em; }

  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
  /* The background is a neuron field drawn on one canvas, not a pile of animated divs: no layout, no
     paint cost when the script is absent, and every edge is decided per frame by where the cursor is. */
  .neurons { position: fixed; inset: 0; z-index: -1; display: block; width: 100%; height: 100%; pointer-events: none; }

  .doc { max-width: 78rem; margin: 0 auto; padding: 0 1.1rem 5rem; }
  .doc.wide { max-width: 94rem; }
  .sec, section[id] { scroll-margin-top: 4.6rem; }

  .top {
    position: sticky; top: 0; z-index: 20;
    display: flex; align-items: center; gap: 1.1rem;
    padding: .85rem 0;
    border-bottom: 1px solid var(--line);
    background: var(--top);
    backdrop-filter: blur(10px);
  }
  .brand { display: flex; align-items: baseline; gap: .5rem; font-family: var(--mono); font-size: 1.12rem; letter-spacing: -.02em; color: var(--text); }
  .brand strong { font-weight: 650; }
  .brand .cursor { display: inline-block; width: .55ch; height: 1em; background: var(--teal); vertical-align: -.12em; animation: blink 1.1s steps(1) infinite; }
  .brand:hover { text-decoration: none; }
  .nav { display: flex; gap: 1.1rem; margin-left: auto; font-size: .9rem; }
  .nav a { color: var(--muted); }
  .nav a:hover { color: var(--text); text-decoration: none; }
  /* Language is a menu of native names, the shape a settings menu uses: pick the one you can read
     without first reading the language you are stuck in. It is a <details>, so it opens without JS. */
  /* The theme switch is a link, exactly like the language switch: the choice travels in the URL and the
     server renders the attribute, so nothing flashes before the first paint. */
  .theme { display: inline-grid; place-items: center; width: 2rem; height: 2rem; margin-left: .2rem; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); }
  .theme:hover { color: var(--text); border-color: var(--line-strong); text-decoration: none; }
  .theme svg { display: block; width: 1.05rem; height: 1.05rem; }

  .lang { position: relative; margin-left: .2rem; font-family: var(--mono); font-size: .82rem; }
  .lang > summary {
    display: inline-flex; align-items: center; gap: .3rem; cursor: pointer; list-style: none;
    color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: .22rem .62rem;
  }
  .lang > summary::-webkit-details-marker { display: none; }
  .lang > summary::marker { content: ""; }
  .lang > summary:hover { color: var(--text); border-color: var(--line-strong); }
  .lang > summary .chev { color: var(--faint); font-size: .72rem; transition: transform .14s ease; }
  .lang[open] > summary { color: var(--text); border-color: var(--line-strong); }
  .lang[open] > summary .chev { transform: rotate(180deg); }
  .lang-menu {
    position: absolute; top: calc(100% + .45rem); right: 0; z-index: 40; min-width: 11rem;
    list-style: none; margin: 0; padding: .35rem; border: 1px solid var(--line-strong); border-radius: 14px;
    background: var(--menu); box-shadow: 0 22px 48px var(--shadow);
  }
  .lang-menu a { display: flex; align-items: center; gap: .6rem; padding: .45rem .6rem; border-radius: 9px; color: var(--text); font-size: .9rem; }
  .lang-menu a:hover { background: var(--hover); text-decoration: none; }
  .lang-menu a.on { background: var(--hover-strong); }
  .lang-menu .name { flex: 1; }
  .lang-menu .check { opacity: 0; }
  .lang-menu a.on .check { opacity: 1; }
  @media (max-width: 40rem) { .nav { display: none; } }

  .hero { padding: 4rem 0 2.4rem; display: grid; gap: 1.1rem; }
  .hero h1 { font-family: var(--mono); font-size: clamp(2.7rem, 7.5vw, 4.1rem); line-height: 1.02; }
  .hero h1 .cursor { display: inline-block; width: .5ch; height: .82em; background: var(--accent); margin-left: .1ch; vertical-align: -.02em; animation: blink 1.1s steps(1) infinite; }
  .lede { margin: 0; max-width: 46rem; font-size: 1.16rem; color: var(--soft); }
  .lede-sub { margin: 0; max-width: 46rem; color: var(--faint); font-size: .99rem; }
  .chips { display: flex; flex-wrap: wrap; gap: .45rem; }
  .chip { font-family: var(--mono); font-size: .8rem; padding: .22rem .68rem; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); }
  .chip.on { color: var(--accent-hi); border-color: rgba(77,107,254,.4); background: var(--accent-soft); }

  .cmd { border: 1px solid var(--line); border-radius: 14px; background: var(--bg-elev); overflow: hidden; }
  .cmd-tabs { display: flex; gap: .15rem; padding: .5rem .6rem; border-bottom: 1px solid var(--line); }
  .cmd-tab { font: inherit; font-family: var(--mono); font-size: .82rem; color: var(--muted); background: transparent; border: 0; border-radius: 999px; padding: .28rem .75rem; cursor: pointer; }
  .cmd-tab[aria-selected="true"] { color: var(--text); background: var(--hover); }
  .cmd-panel { display: none; padding: .55rem .6rem .7rem; }
  .cmd-panel[data-on] { display: block; }
  /* The command sits in its own slab, the way skills.sh draws "npx skills add": one rounded box,
     one prompt glyph, one copy button pinned to the right edge. */
  .cmd-body {
    display: flex; align-items: flex-start; gap: .5rem;
    padding: .7rem .75rem .7rem .85rem;
    border: 1px solid var(--line); border-radius: 10px; background: var(--slab);
  }
  .cmd-body pre { flex: 1; min-width: 0; margin: 0; overflow-x: auto; font-size: .92rem; line-height: 1.75; color: var(--code); }
  .cmd-body pre .p { color: var(--muted); user-select: none; }
  /* One class per thing an editor would colour. See src/sh.ts - nothing here is decided in CSS. */
  .c-cmd { color: var(--sh-cmd); }
  .c-flag { color: var(--sh-flag); }
  .c-str { color: var(--sh-str); }
  .c-op { color: var(--sh-op); }
  .c-url { color: var(--sh-url); }
  .c-var { color: var(--sh-var); }
  .cmd .hint { margin: .5rem .2rem 0; }
  .copy {
    flex: 0 0 auto; display: inline-grid; place-items: center; width: 1.9rem; height: 1.9rem; margin-top: -.15rem;
    padding: 0; cursor: pointer; color: var(--muted); background: none; border: 1px solid transparent; border-radius: 8px;
  }
  .copy:hover { color: var(--text); background: var(--hover); }
  .copy:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .copy svg { display: block; width: 1rem; height: 1rem; }
  .copy .i-done { display: none; color: var(--ok); }
  .copy.done .i-copy { display: none; }
  .copy.done .i-done { display: block; }

  .sec { padding: 2.6rem 0 .4rem; }
  .sec > h2 {
    display: flex; align-items: center; gap: .9rem;
    font-family: var(--mono); font-size: 1.55rem; font-weight: 650; letter-spacing: -.015em;
    color: var(--text); margin-bottom: 1.15rem;
  }
  .sec > h2 .hint { font-weight: 400; }
  .sec > h2::after { content: ""; flex: 1; height: 1px; background: var(--line); }
  .sec > .sub { margin: -.55rem 0 1.2rem; color: var(--muted); font-size: 1.05rem; max-width: 72rem; }

  .tbl { width: 100%; border-collapse: collapse; font-size: .95rem; }
  .tbl th {
    text-align: left; font-family: var(--mono); font-size: .74rem; font-weight: 600; letter-spacing: .12em;
    text-transform: uppercase; color: var(--faint); padding: .45rem .7rem .45rem 0; border-bottom: 1px solid var(--line-strong);
  }
  .tbl td { padding: .66rem .7rem .66rem 0; border-bottom: 1px solid var(--line); vertical-align: top; }
  .tbl tr:last-child td { border-bottom: 0; }
  .tbl td.mono, .tbl .m { font-family: var(--mono); font-size: .88rem; color: var(--muted); }
  .tbl td.k { color: var(--text); font-family: var(--mono); font-size: .9rem; white-space: nowrap; }
  .tbl td.note { color: var(--muted); }

  .panel { border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); }
  .panel-pad { padding: 1.1rem 1.15rem; }
  .grid { display: grid; gap: 1rem; }
  .btn {
    font: inherit; font-size: .92rem; cursor: pointer; color: var(--text);
    background: var(--slab); border: 1px solid var(--line-strong); border-radius: var(--radius-sm);
    padding: .42rem .9rem;
  }
  .btn:hover { background: var(--hover); }
  .btn.primary { background: var(--accent); border-color: transparent; color: #fff; font-weight: 600; }
  .btn.primary:hover { background: var(--accent-hi); }
  .btn.danger { color: var(--bad); border-color: rgba(248,113,113,.34); }
  .btn:disabled { opacity: .42; cursor: not-allowed; }
  input:not([type=checkbox]), select, textarea {
    font: inherit; font-size: .92rem; width: 100%; color: var(--text);
    background: var(--field); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: .48rem .62rem;
  }
  textarea { font-family: var(--mono); font-size: .88rem; resize: vertical; line-height: 1.65; }
  input:focus, select:focus, textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: transparent; }
  input[type=checkbox] { width: auto; }
  .hint { color: var(--faint); font-size: .86rem; line-height: 1.7; margin: .3rem 0; }
  .mono { font-family: var(--mono); }
  .muted { color: var(--muted); }
  .callout {
    border: 1px solid var(--line); border-left: 2px solid var(--accent); border-radius: var(--radius-sm);
    background: rgba(77,107,254,.06); padding: .65rem .85rem; font-size: .88rem; color: var(--soft);
  }
  .callout.warn { border-left-color: var(--warn); background: rgba(251,191,36,.07); color: #f4dfae; }
  .callout.bad { border-left-color: var(--bad); background: rgba(248,113,113,.07); color: #f6c4c4; }
  .tip {
    position: relative; display: inline-grid; place-items: center; width: 1.15rem; height: 1.15rem; margin-left: .35rem;
    border: 1px solid var(--line-strong); border-radius: 999px; color: var(--faint);
    font-family: var(--mono); font-size: .68rem; line-height: 1; cursor: help; vertical-align: middle;
  }
  .tip:hover, .tip:focus-visible { color: var(--text); border-color: var(--accent); outline: none; }
  .tip-body {
    position: absolute; bottom: calc(100% + .45rem); left: 50%; transform: translateX(-50%);
    width: 21rem; max-width: 72vw; padding: .6rem .75rem; border: 1px solid var(--line-strong); border-radius: var(--radius-sm);
    background: var(--menu); color: var(--muted); font-family: var(--sans); font-size: .88rem; font-weight: 400;
    letter-spacing: 0; text-transform: none; line-height: 1.6; text-align: left;
    box-shadow: 0 16px 36px var(--shadow); opacity: 0; visibility: hidden; transition: opacity .12s ease; z-index: 40;
  }
  .tip:hover .tip-body, .tip:focus-visible .tip-body { opacity: 1; visibility: visible; }

  .help-body { padding-top: .35rem; }
  ul.help-list { margin: .35rem 0 .6rem; padding-left: 1.15rem; }
  ul.help-list li { margin: .18rem 0; font-size: .88rem; color: var(--muted); }
  .composer { border: 1px solid var(--line); border-radius: 16px; background: var(--bg-elev); }
  .chat .composer { border: 0; border-top: 1px solid var(--line); border-radius: 0; background: transparent; }
  /* The trial is one box of a fixed height: the transcript scrolls inside it and the composer stays
     where it is, which is the only shape in which a conversation stays readable. */
  .chat { display: flex; flex-direction: column; height: min(74vh, 40rem); }
  .chat .stream { flex: 1; min-height: 7rem; overflow-y: auto; overscroll-behavior: contain; padding: 1.2rem 1.1rem; display: flex; flex-direction: column; gap: 1.5rem; }

  /* An answer is a column on the left; a message from the visitor is a bubble on the right. */
  .turn { display: flex; }
  .turn.bot { justify-content: flex-start; }
  .turn.me { justify-content: flex-end; }
  .turn > .wrap { min-width: 0; max-width: min(50rem, 100%); }
  .turn.me > .wrap { display: flex; flex-direction: column; align-items: flex-end; max-width: min(34rem, 84%); }
  .turn.me .said { background: var(--accent-soft); border: 1px solid rgba(77,107,254,.30); border-radius: 16px; padding: .7rem .95rem; overflow-wrap: anywhere; }
  .turn .meta { display: flex; align-items: center; gap: .45rem; margin-top: .45rem; font-family: var(--mono); font-size: .76rem; color: var(--faint); }
  .msg-copy { display: inline-grid; place-items: center; width: 1.5rem; height: 1.5rem; padding: 0; cursor: pointer; color: var(--faint); background: none; border: 1px solid transparent; border-radius: 7px; }
  .msg-copy:hover { color: var(--text); background: var(--hover); }
  .msg-copy svg { display: block; width: .95rem; height: .95rem; }
  .msg-copy .i-done { display: none; color: var(--ok); }
  .msg-copy.done .i-copy { display: none; }
  .msg-copy.done .i-done { display: block; }

  /* The reasoning block: one growing line while it is being written, one folded line afterwards. */
  .thought { margin: 0 0 .6rem; }
  .thought > summary { display: inline-flex; align-items: center; gap: .45rem; cursor: pointer; list-style: none; color: var(--muted); font-size: .95rem; }
  .thought > summary::-webkit-details-marker { display: none; }
  .thought > summary::marker { content: ""; }
  .thought > summary::before { content: "✦"; color: var(--accent-hi); }
  .thought > summary:hover { color: var(--text); }
  .thought > summary .chev { color: var(--faint); font-size: .72rem; transition: transform .14s ease; }
  .thought[open] > summary .chev { transform: rotate(180deg); }
  .composer .row-in { display: flex; align-items: center; gap: .55rem; padding: 1rem 1.05rem .4rem; }
  .composer .row-in .p { color: var(--teal); font-family: var(--mono); }
  .composer .row-in input { flex: 1; border: 0; background: transparent; padding: .35rem 0; font-size: 1.08rem; }
  .composer .row-in input:focus { outline: none; }
  .composer .foot { display: flex; align-items: center; gap: .55rem; padding: .35rem .6rem .6rem .95rem; }
  .composer .stats { margin-right: auto; font-family: var(--mono); font-size: .8rem; color: var(--faint); white-space: nowrap; }
  .composer .stats b { color: var(--muted); font-weight: 600; }

  /* The model picker is a bare label at the right of the composer, next to send — the same shape as
     the model switcher in a chat composer. It opens upward so the list never pushes the page around. */
  .pick { position: relative; }
  .pick-btn {
    display: inline-flex; align-items: center; gap: .3rem; font: inherit; font-size: .92rem;
    color: var(--muted); background: none; border: 0; border-radius: var(--radius-sm);
    padding: .26rem .4rem; cursor: pointer; max-width: 17rem;
  }
  .pick-btn:hover { color: var(--text); background: var(--hover); }
  .pick-btn .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pick-btn .chev { color: var(--faint); font-size: .72rem; transition: transform .14s ease; }
  .pick-btn[aria-expanded="true"] .chev { transform: rotate(180deg); }
  .pick-menu {
    position: absolute; bottom: calc(100% + .45rem); right: 0; left: auto; z-index: 30;
    min-width: 16rem; max-height: 17rem; overflow: auto;
    list-style: none; margin: 0; padding: .35rem; border: 1px solid var(--line-strong); border-radius: 14px;
    background: var(--menu); box-shadow: 0 22px 48px var(--shadow);
  }
  .pick-menu button {
    display: flex; align-items: center; gap: .6rem; width: 100%; text-align: left;
    font: inherit; font-size: .92rem; color: var(--text);
    background: none; border: 0; border-radius: 9px; padding: .5rem .6rem; cursor: pointer;
  }
  .pick-menu button:hover { background: var(--hover); }
  .pick-menu button.on { background: var(--hover-strong); }
  .pick-menu .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pick-menu .check { color: var(--text); font-size: .95rem; opacity: 0; }
  .pick-menu button.on .check { opacity: 1; }
  .pick-menu .desc { display: block; color: var(--faint); font-size: .8rem; }
  .send {
    display: inline-grid; place-items: center; width: 2.2rem; height: 2.2rem; border-radius: 999px;
    border: 0; background: var(--accent); color: #fff; cursor: pointer; flex: 0 0 auto;
  }
  .send:hover { background: var(--accent-hi); }
  .send:disabled { opacity: .5; cursor: progress; }
  .send svg { width: 1.1rem; height: 1.1rem; }
  .composer.locked .pick-btn { opacity: .5; }

  /* The spec sheet: one panel, the model in the first column, everything else read across. */
  .spec-table { border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); overflow: hidden; }
  .tbl.spec th { padding: .8rem 1rem; text-transform: none; letter-spacing: .04em; font-size: .78rem; }
  .tbl.spec td { padding: .95rem 1rem; border-top: 1px solid var(--line); border-bottom: 0; }
  .tbl.spec tbody tr:first-child td { border-top: 0; }
  .tbl.spec tbody tr:hover td { background: var(--slab); }
  .spec-name { display: block; font-weight: 650; color: var(--text); }
  .spec-sub { display: block; margin-top: .2rem; font-family: var(--mono); font-size: .8rem; color: var(--faint); }
  .tbl.spec td.note { color: var(--muted); max-width: 26rem; }
  .tbl.spec td.m { color: var(--muted); white-space: nowrap; }
  .sec > h2.spaced { margin-top: 2.8rem; }

  /* The chart. Bar widths are classes, not style attributes: every score is quantised to 5, so the page
     needs at most twenty of them and never builds CSS out of data. */
  .bench { border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); padding: 1.1rem 1.15rem 1.25rem; }
  .bench-legend { display: flex; flex-wrap: wrap; gap: .5rem 1.15rem; margin-bottom: 1.15rem; }
  .bench-key { display: inline-flex; align-items: center; gap: .45rem; font-family: var(--mono); font-size: .8rem; color: var(--muted); }
  .bench-key i { width: .62rem; height: .62rem; border-radius: 2px; background: var(--mk); }
  .bench-rows { display: grid; gap: 1.05rem; }
  .bench-row { display: grid; gap: .45rem; }
  .bench-name { font-family: var(--mono); font-size: .82rem; color: var(--muted); }
  .bench-bars { display: grid; gap: .3rem; }
  .bench-track { height: 1.35rem; border-radius: 4px; background: var(--slab); transition: background .12s ease; }
  /* Hover is the readout: the bar lifts, and the title attribute spells out dimension, model and score. */
  .bench-track:hover { background: var(--hover); }
  .bench-track:hover .bench-bar { filter: brightness(1.08); }
  .bench-bar { display: flex; align-items: center; justify-content: flex-end; height: 100%; border-radius: 4px; background: var(--mk); }
  .bench-bar span { padding-right: .5rem; font-family: var(--mono); font-size: .74rem; color: #14171c; }
  .mk0 { --mk: #e9e2d0; }
  .mk1 { --mk: #a9d9c9; }
  .mk2 { --mk: #efb56b; }
  .mk3 { --mk: #93b8f2; }
  .mk4 { --mk: #d99595; }
  .b5 { width: 5% }
  .b10 { width: 10% }
  .b15 { width: 15% }
  .b20 { width: 20% }
  .b25 { width: 25% }
  .b30 { width: 30% }
  .b35 { width: 35% }
  .b40 { width: 40% }
  .b45 { width: 45% }
  .b50 { width: 50% }
  .b55 { width: 55% }
  .b60 { width: 60% }
  .b65 { width: 65% }
  .b70 { width: 70% }
  .b75 { width: 75% }
  .b80 { width: 80% }
  .b85 { width: 85% }
  .b90 { width: 90% }
  .b95 { width: 95% }
  .b100 { width: 100% }

  /* The playground opens empty and offers four ways in. Each one is a button, not a suggestion:
     clicking it sends, which is the shortest path from a cold page to a streamed answer. */
  .start { display: grid; gap: .35rem; }
  .start-line { margin: 0; color: var(--muted); font-size: 1rem; }
  .start-label { margin: .55rem 0 0; font-family: var(--mono); font-size: .74rem; letter-spacing: .12em; text-transform: uppercase; color: var(--faint); }
  .start-row { display: grid; gap: .5rem; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); margin-top: .35rem; }
  .start-card {
    font: inherit; text-align: left; cursor: pointer; color: var(--text); font-size: .95rem; line-height: 1.45;
    background: var(--slab); border: 1px solid var(--line); border-radius: 12px; padding: .7rem .85rem;
  }
  .start-card:hover { background: var(--hover); border-color: var(--line-strong); }

  footer.foot {
    margin-top: 3.5rem; padding-top: 1.2rem; border-top: 1px solid var(--line);
    display: flex; flex-wrap: wrap; gap: .4rem 1.1rem; color: var(--faint); font-size: .86rem;
  }
  footer.foot .grow { flex: 1; }

  @keyframes blink { 50% { opacity: 0; } }
  @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  /* Motion is a garnish on the hero only. Sections are never hidden behind an animation delay: a page
     whose content depends on timing to be visible is a page that is broken in a screenshot, a print,
     an RSS reader and every other place a human is not watching it fade in. */
  .hero { animation: rise .45s cubic-bezier(.22,.61,.36,1) both; }
  @media (prefers-reduced-motion: reduce) { .hero { animation: none; } .brand .cursor, .hero h1 .cursor { animation: none; } }
`;

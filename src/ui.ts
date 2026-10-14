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
    --radius: 12px;
    --radius-sm: 8px;
    --mono: ui-monospace, "SFMono-Regular", "SF Mono", "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
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
    font-size: 16.5px;
    line-height: 1.68;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--accent-hi); text-decoration: none; }
  a:hover { text-decoration: underline; text-underline-offset: 3px; }
  code, pre, kbd { font-family: var(--mono); }
  code { color: var(--teal); background: rgba(110, 231, 200, .07); border-radius: 5px; padding: 0 .28em; font-size: .92em; }
  h1, h2, h3 { margin: 0; font-weight: 650; letter-spacing: -.02em; }

  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
  .shapes { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
  .shapes i {
    position: absolute; display: block; border-radius: 26%;
    border: 1px solid rgba(110, 231, 200, .16);
    background: linear-gradient(150deg, rgba(110,231,200,.05), rgba(77,107,254,.04));
    animation: drift 26s ease-in-out infinite alternate;
  }
  .shapes i.b { border-radius: 999px; border-color: rgba(77,107,254,.18); }
  .shapes i.c { border-radius: 22%; border-color: rgba(255,255,255,.06); background: none; }
  .shapes i:nth-child(1) { width: 22rem; height: 22rem; top: 6%; left: -6rem; animation-duration: 30s; }
  .shapes i:nth-child(2) { width: 15rem; height: 15rem; top: 42%; right: -5rem; animation-duration: 24s; animation-delay: -7s; }
  .shapes i:nth-child(3) { width: 9rem; height: 9rem; top: 74%; left: 12%; animation-duration: 34s; animation-delay: -14s; }
  .shapes i:nth-child(4) { width: 6rem; height: 6rem; top: 20%; right: 22%; border-radius: 999px; animation-duration: 21s; animation-delay: -3s; }
  @keyframes drift {
    from { transform: translate3d(0, 0, 0) rotate(0deg); }
    to { transform: translate3d(2.5rem, -1.6rem, 0) rotate(24deg); }
  }
  @media (prefers-reduced-motion: reduce) { .shapes i { animation: none; } }

  .doc { max-width: 78rem; margin: 0 auto; padding: 0 1.1rem 5rem; }
  .doc.wide { max-width: 94rem; }
  .sec, section[id] { scroll-margin-top: 4.6rem; }

  .top {
    position: sticky; top: 0; z-index: 20;
    display: flex; align-items: center; gap: 1.1rem;
    padding: .85rem 0;
    border-bottom: 1px solid var(--line);
    background: rgba(10, 11, 13, .82);
    backdrop-filter: blur(10px);
  }
  .brand { display: flex; align-items: baseline; gap: .5rem; font-family: var(--mono); font-size: 1rem; letter-spacing: -.02em; color: var(--text); }
  .brand strong { font-weight: 650; }
  .brand .cursor { display: inline-block; width: .55ch; height: 1em; background: var(--teal); vertical-align: -.12em; animation: blink 1.1s steps(1) infinite; }
  .brand:hover { text-decoration: none; }
  .nav { display: flex; gap: 1rem; margin-left: auto; font-size: .82rem; }
  .nav a { color: var(--muted); }
  .nav a:hover { color: var(--text); text-decoration: none; }
  .lang { display: flex; align-items: center; gap: .1rem; margin-left: .2rem; border: 1px solid var(--line); border-radius: 999px; padding: .1rem; font-family: var(--mono); font-size: .72rem; }
  .lang-now { padding: .12rem .55rem; border-radius: 999px; background: var(--accent-soft); color: var(--accent-hi); }
  .lang-other { padding: .12rem .55rem; color: var(--muted); border-radius: 999px; }
  .lang-other:hover { color: var(--text); text-decoration: none; background: rgba(255,255,255,.05); }
  @media (max-width: 40rem) { .nav { display: none; } }

  .hero { padding: 4rem 0 2.4rem; display: grid; gap: 1.1rem; }
  .hero h1 { font-family: var(--mono); font-size: clamp(2.4rem, 7vw, 3.6rem); line-height: 1.02; }
  .hero h1 .cursor { display: inline-block; width: .5ch; height: .82em; background: var(--accent); margin-left: .1ch; vertical-align: -.02em; animation: blink 1.1s steps(1) infinite; }
  .lede { margin: 0; max-width: 44rem; font-size: 1.06rem; color: #c8d0da; }
  .lede-sub { margin: 0; max-width: 44rem; color: var(--faint); font-size: .9rem; }
  .chips { display: flex; flex-wrap: wrap; gap: .45rem; }
  .chip { font-family: var(--mono); font-size: .72rem; padding: .2rem .6rem; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); }
  .chip.on { color: var(--accent-hi); border-color: rgba(77,107,254,.4); background: var(--accent-soft); }

  .cmd { border: 1px solid var(--line); border-radius: var(--radius); background: var(--bg-elev); overflow: hidden; }
  .cmd-tabs { display: flex; gap: .15rem; padding: .4rem .5rem; border-bottom: 1px solid var(--line); }
  .cmd-tab { font: inherit; font-family: var(--mono); font-size: .74rem; color: var(--muted); background: transparent; border: 0; border-radius: 999px; padding: .25rem .7rem; cursor: pointer; }
  .cmd-tab[aria-selected="true"] { color: var(--text); background: rgba(255,255,255,.06); }
  .cmd-panel { display: none; padding: .9rem 1rem 1rem; }
  .cmd-panel[data-on] { display: block; }
  .cmd pre { margin: 0 0 .5rem; overflow-x: auto; font-size: .82rem; line-height: 1.7; color: #d7dee8; }
  .cmd pre .p { color: var(--teal); user-select: none; }
  .cmd .hint { margin: 0; }

  .sec { padding: 2.6rem 0 .4rem; }
  .sec > h2 {
    display: flex; align-items: center; gap: .8rem;
    font-family: var(--mono); font-size: .72rem; font-weight: 600; letter-spacing: .16em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 1.1rem;
  }
  .sec > h2::after { content: ""; flex: 1; height: 1px; background: var(--line); }
  .sec > .sub { margin: -.6rem 0 1.1rem; color: var(--muted); font-size: .86rem; max-width: 46rem; }

  .tbl { width: 100%; border-collapse: collapse; font-size: .86rem; }
  .tbl th {
    text-align: left; font-family: var(--mono); font-size: .68rem; font-weight: 600; letter-spacing: .12em;
    text-transform: uppercase; color: var(--faint); padding: .45rem .7rem .45rem 0; border-bottom: 1px solid var(--line-strong);
  }
  .tbl td { padding: .62rem .7rem .62rem 0; border-bottom: 1px solid var(--line); vertical-align: top; }
  .tbl tr:last-child td { border-bottom: 0; }
  .tbl td.mono, .tbl .m { font-family: var(--mono); font-size: .8rem; color: var(--muted); }
  .tbl td.k { color: var(--text); font-family: var(--mono); font-size: .82rem; white-space: nowrap; }
  .tbl td.note { color: var(--muted); }

  .panel { border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); }
  .panel-pad { padding: 1.1rem 1.15rem; }
  .grid { display: grid; gap: 1rem; }
  .btn {
    font: inherit; font-size: .84rem; cursor: pointer; color: var(--text);
    background: rgba(255,255,255,.03); border: 1px solid var(--line-strong); border-radius: var(--radius-sm);
    padding: .42rem .9rem;
  }
  .btn:hover { background: rgba(255,255,255,.06); }
  .btn.primary { background: var(--accent); border-color: transparent; color: #fff; font-weight: 600; }
  .btn.primary:hover { background: var(--accent-hi); }
  .btn.danger { color: var(--bad); border-color: rgba(248,113,113,.34); }
  .btn:disabled { opacity: .42; cursor: not-allowed; }
  input:not([type=checkbox]), select, textarea {
    font: inherit; font-size: .84rem; width: 100%; color: var(--text);
    background: rgba(0,0,0,.32); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: .45rem .6rem;
  }
  textarea { font-family: var(--mono); font-size: .8rem; resize: vertical; line-height: 1.6; }
  input:focus, select:focus, textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: transparent; }
  input[type=checkbox] { width: auto; }
  .hint { color: var(--faint); font-size: .78rem; line-height: 1.7; margin: .3rem 0; }
  .mono { font-family: var(--mono); }
  .muted { color: var(--muted); }
  .callout {
    border: 1px solid var(--line); border-left: 2px solid var(--accent); border-radius: var(--radius-sm);
    background: rgba(77,107,254,.06); padding: .6rem .8rem; font-size: .8rem; color: #c8d0da;
  }
  .callout.warn { border-left-color: var(--warn); background: rgba(251,191,36,.07); color: #f4dfae; }
  .callout.bad { border-left-color: var(--bad); background: rgba(248,113,113,.07); color: #f6c4c4; }
  .tip {
    position: relative; display: inline-grid; place-items: center; width: 1.05rem; height: 1.05rem; margin-left: .35rem;
    border: 1px solid var(--line-strong); border-radius: 999px; color: var(--faint);
    font-family: var(--mono); font-size: .62rem; line-height: 1; cursor: help; vertical-align: middle;
  }
  .tip:hover, .tip:focus-visible { color: var(--text); border-color: var(--accent); outline: none; }
  .tip-body {
    position: absolute; bottom: calc(100% + .45rem); left: 50%; transform: translateX(-50%);
    width: 21rem; max-width: 72vw; padding: .6rem .75rem; border: 1px solid var(--line-strong); border-radius: var(--radius-sm);
    background: #14171c; color: var(--muted); font-family: var(--sans); font-size: .8rem; font-weight: 400;
    letter-spacing: 0; text-transform: none; line-height: 1.6; text-align: left;
    box-shadow: 0 16px 36px rgba(0,0,0,.5); opacity: 0; visibility: hidden; transition: opacity .12s ease; z-index: 40;
  }
  .tip:hover .tip-body, .tip:focus-visible .tip-body { opacity: 1; visibility: visible; }

  .help-body { padding-top: .35rem; }
  ul.help-list { margin: .35rem 0 .6rem; padding-left: 1.15rem; }
  ul.help-list li { margin: .15rem 0; font-size: .8rem; color: var(--muted); }
  .composer { border: 1px solid var(--line); border-radius: var(--radius); background: var(--bg-elev); }
  .chat .composer { border: 0; border-top: 1px solid var(--line); border-radius: 0; background: transparent; }
  .chat .stream { padding: 1.1rem 1rem 1.2rem; min-height: 7rem; display: grid; gap: .9rem; align-content: start; }
  .composer .row-in { display: flex; align-items: center; gap: .55rem; padding: .75rem .85rem .35rem; }
  .composer .row-in .p { color: var(--teal); font-family: var(--mono); }
  .composer .row-in input { flex: 1; border: 0; background: transparent; padding: .3rem .1rem; font-size: .98rem; }
  .composer .row-in input:focus { outline: none; }
  .composer .foot { display: flex; align-items: center; gap: .5rem; padding: .35rem .6rem .6rem .85rem; }
  .composer .stats { margin-left: auto; font-family: var(--mono); font-size: .74rem; color: var(--faint); white-space: nowrap; }
  .composer .stats b { color: var(--muted); font-weight: 600; }
  .pick { position: relative; }
  .pick-btn {
    display: inline-flex; align-items: center; gap: .35rem; font: inherit; font-size: .82rem;
    color: var(--muted); background: rgba(255,255,255,.03); border: 1px solid var(--line);
    border-radius: 999px; padding: .3rem .6rem; cursor: pointer; max-width: 16rem;
  }
  .pick-btn:hover { color: var(--text); border-color: var(--line-strong); }
  .pick-btn .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pick-btn .chev { color: var(--faint); font-size: .7rem; }
  .pick-menu {
    position: absolute; bottom: calc(100% + .4rem); left: 0; z-index: 30; min-width: 15rem; max-height: 16rem; overflow: auto;
    list-style: none; margin: 0; padding: .3rem; border: 1px solid var(--line-strong); border-radius: var(--radius-sm);
    background: #14171c; box-shadow: 0 18px 40px rgba(0,0,0,.5);
  }
  .pick-menu button {
    display: block; width: 100%; text-align: left; font: inherit; font-size: .82rem; color: var(--text);
    background: none; border: 0; border-radius: 6px; padding: .4rem .55rem; cursor: pointer;
  }
  .pick-menu button:hover { background: rgba(255,255,255,.06); }
  .pick-menu .desc { display: block; color: var(--faint); font-size: .72rem; }
  .pick-menu .on { color: var(--accent-hi); }
  .send {
    display: inline-grid; place-items: center; width: 2.1rem; height: 2.1rem; border-radius: 999px;
    border: 0; background: var(--accent); color: #fff; cursor: pointer; flex: 0 0 auto;
  }
  .send:hover { background: var(--accent-hi); }
  .send:disabled { opacity: .5; cursor: progress; }
  .send svg { width: 1.05rem; height: 1.05rem; }
  .composer.locked .pick-btn { opacity: .5; }

  footer.foot {
    margin-top: 3.5rem; padding-top: 1.2rem; border-top: 1px solid var(--line);
    display: flex; flex-wrap: wrap; gap: .4rem 1.1rem; color: var(--faint); font-size: .78rem;
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

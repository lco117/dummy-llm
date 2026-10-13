import type { Ctx } from "./types.ts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function landingPage(ctx: Ctx): Response {
  const text = escapeHtml(ctx.cfg.text);
  const mode = escapeHtml(ctx.cfg.mode);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>parrot-llm</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: radial-gradient(circle at 30% 20%, #1d2b1f, #0b0f0c 60%);
    color: #d7f5dd; font: 16px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
    padding: 2rem;
  }
  main { max-width: 46rem; width: 100%; }
  h1 { font-size: 1.1rem; letter-spacing: .3em; text-transform: uppercase; color: #6ee787; margin: 0 0 1.5rem; }
  .answer {
    font-size: clamp(4rem, 22vw, 12rem); line-height: 1; font-weight: 700; color: #6ee787;
    word-break: break-word; text-shadow: 0 0 40px rgba(110,231,135,.35); margin: 0 0 1rem;
  }
  .tagline { color: #7d8f82; margin: 0 0 2rem; }
  table { border-collapse: collapse; width: 100%; font-size: .85rem; }
  td { border-top: 1px solid #1f2a22; padding: .5rem .25rem; vertical-align: top; }
  td:first-child { color: #6ee787; white-space: nowrap; padding-right: 1rem; }
  code { color: #b6f0c4; }
  .foot { color: #55665a; font-size: .75rem; margin-top: 2rem; }
  a { color: #6ee787; }
</style>
</head>
<body>
<main>
  <h1>parrot-llm</h1>
  <p class="answer">${text}</p>
  <p class="tagline">It says whatever you said — after thinking about it. Mode: <code>${mode}</code>.</p>
  <table>
    <tr><td>OpenAI</td><td><code>POST /v1/chat/completions</code> &middot; <code>POST /v1/responses</code> &middot; <code>GET /v1/models</code></td></tr>
    <tr><td>Anthropic</td><td><code>POST /v1/messages</code> &middot; <code>POST /v1/messages/count_tokens</code></td></tr>
    <tr><td>Gemini</td><td><code>POST /v1beta/models/{model}:generateContent</code></td></tr>
    <tr><td>Ollama</td><td><code>POST /api/chat</code> &middot; <code>POST /api/generate</code> &middot; <code>GET /api/tags</code></td></tr>
    <tr><td>Health</td><td><code>GET /healthz</code></td></tr>
  </table>
  <p class="foot">Point any SDK at this origin and set the API key to anything. MIT licensed.</p>
</main>
</body>
</html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

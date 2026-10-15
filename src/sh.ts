import { escapeHtml } from "./ui.ts";

/**
 * A very small shell highlighter, for the command blocks on the landing page.
 *
 * It exists so an install command reads the way it does in an editor instead of as one flat string.
 * It knows four things - quotes, operators, options and URLs - and everything else passes through as
 * plain text. Every byte of the input is escaped on the way out: a highlighter that trusts its input
 * would hand the page's XSS story to whoever writes the next command.
 */

/** Quotes win over everything: a flag inside a JSON body is still part of the JSON. */
function classify(word: string, first: boolean): string {
  if (/^https?:\/\//i.test(word)) return "c-url";
  if (/^-{1,2}[A-Za-z]/.test(word)) return "c-flag";
  if (/^\$[A-Za-z_{]/.test(word)) return "c-var";
  return first ? "c-cmd" : "";
}

function painted(cls: string, text: string): string {
  const safe = escapeHtml(text);
  return cls === "" ? safe : '<span class="' + cls + '">' + safe + "</span>";
}

/** One line of shell, with the pieces editors colour wrapped in spans. */
export function highlightShell(line: string): string {
  const delimiters = " \t'\"|;\\";
  let out = "";
  let at = 0;
  let first = true;
  while (at < line.length) {
    const char = line[at] as string;
    if (char === " " || char === "\t") {
      out += char;
      at += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      let end = at + 1;
      while (end < line.length && line[end] !== char) end += 1;
      const stop = end < line.length ? end + 1 : line.length;
      out += painted("c-str", line.slice(at, stop));
      at = stop;
      first = false;
      continue;
    }
    if (line.startsWith("&&", at) || line.startsWith("||", at)) {
      out += painted("c-op", line.slice(at, at + 2));
      at += 2;
      first = true;
      continue;
    }
    if (char === "|" || char === ";" || char === "\\") {
      out += painted("c-op", char);
      at += 1;
      first = true;
      continue;
    }
    let end = at;
    while (end < line.length && delimiters.indexOf(line[end] as string) === -1 && !line.startsWith("&&", end) && !line.startsWith("||", end)) {
      end += 1;
    }
    out += painted(classify(line.slice(at, end), first), line.slice(at, end));
    first = false;
    at = end;
  }
  return out;
}

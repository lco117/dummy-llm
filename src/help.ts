import { FILTER_NAMES } from "./filters.ts";
import { t, type Lang } from "./i18n.ts";

/**
 * The one place that explains what you can write in a reply template.
 *
 * The filter list is generated from the registry rather than typed out, so adding a filter updates
 * every page that shows this text. The prose is the only part that is translated; the code spans are
 * code in both languages.
 */

/** The four filters that take a `:N` argument; the rest ignore it. */
const WITH_ARGUMENT = new Set(["truncate", "repeat", "wrap", "indent"]);

const filters = FILTER_NAMES.map((name) => "<code>" + (WITH_ARGUMENT.has(name) ? name + ":N" : name) + "</code>").join(" ");

export function helpHtml(lang: Lang): string {
  const placeholders: Array<[string, string]> = [
    ["{input}", t(lang, "help.input")],
    ["{raw}", t(lang, "help.raw")],
    ["{reply}", t(lang, "help.reply")],
    ["{model}", t(lang, "help.model")],
    ["{text}", t(lang, "help.text")],
  ];
  return [
    '<div class="help-body">',
    '<p class="hint">' + t(lang, "help.placeholders") + "</p>",
    '<ul class="help-list">',
    placeholders.map(([token, meaning]) => "<li><code>" + token + "</code> — " + meaning + "</li>").join(""),
    "</ul>",
    '<p class="hint">' + t(lang, "help.filters") + " <code>|</code>: <code>{input|upper}</code>, <code>{input|reverse}</code>, <code>{input|upper|box}</code>. "
      + t(lang, "help.filters.arg") + " <code>truncate:N</code> <code>repeat:N</code> <code>wrap:N</code> <code>indent:N</code>.</p>",
    '<p class="hint">' + filters + "</p>",
    '<p class="hint"><strong>' + t(lang, "help.shapes") + "</strong></p>",
    '<ul class="help-list">',
    "<li>" + t(lang, "help.shape.one") + " <code>6</code>, <code>{input|upper} ({input|count} chars)</code></li>",
    "<li>" + t(lang, "help.shape.pool") + ' <code>["6","7","maybe"]</code></li>',
    "<li>" + t(lang, "help.shape.keys") + ' <code>{"weather":"raining","*":"no idea"}</code></li>',
    "</ul>",
    '<p class="hint">' + t(lang, "help.note") + " " + t(lang, "help.thinking") + "</p>",
    "</div>",
  ].join("");
}

/** Kept for the test that walks the filter registry, and for any caller that wants English. */
export const TEMPLATE_HELP_HTML = helpHtml("en");

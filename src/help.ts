import { FILTER_NAMES } from "./filters.ts";

/**
 * The one place that explains what you can write in a reply template.
 *
 * It is generated from the real filter registry rather than typed out, so adding a filter (or
 * renaming one) updates every page that shows this text. Both the public playground editor and
 * the admin editor render this exact fragment; there is no second copy to drift.
 */

/** The four filters that take a `:N` argument; the rest ignore it. */
const WITH_ARGUMENT = new Set(["truncate", "repeat", "wrap", "indent"]);

const PLACEHOLDERS: Array<[string, string]> = [
  ["{input}", "the cleaned-up user message — normally the one you want"],
  ["{raw}", "the same message before harness noise is stripped out"],
  ["{reply}", "the answer being generated right now (useful in a thinking template)"],
  ["{model}", "the model id the client asked for"],
  ["{text}", "the template itself"],
];

const placeholders = PLACEHOLDERS.map(([token, meaning]) => `<li><code>${token}</code> — ${meaning}</li>`).join("");

const filters = FILTER_NAMES.map((name) => `<code>${WITH_ARGUMENT.has(name) ? name + ":N" : name}</code>`).join(" ");

/** A self-contained fragment: no scripts, no styles, no server data. */
export const TEMPLATE_HELP_HTML = `<div class="help-body">
  <p class="hint"><strong>Placeholders</strong> — anything else is passed through as written.</p>
  <ul class="help-list">${placeholders}</ul>
  <p class="hint"><strong>Filters</strong> chain onto a placeholder with <code>|</code>:
    <code>{input|upper}</code>, <code>{input|reverse}</code>, <code>{input|upper|box}</code>.
    Four of them take a number: <code>truncate:N</code> <code>repeat:N</code> <code>wrap:N</code> <code>indent:N</code>.</p>
  <p class="hint">${filters}</p>
  <p class="hint"><strong>A reply value can have three shapes</strong> — the shape is the behaviour:</p>
  <ul class="help-list">
    <li>one template: <code>6</code>, or <code>{input|upper} ({input|count} chars)</code></li>
    <li>a pool, drawn at random: <code>["6","7","maybe"]</code></li>
    <li>a keyword map, where <code>"*"</code> is the fallback: <code>{"weather":"raining","*":"no idea"}</code></li>
  </ul>
  <p class="hint">An unknown placeholder is left alone and an unknown filter is ignored, so a typo shows up in the
    answer instead of breaking anything. A thinking template may use <code>{reply}</code>; a reply template may not.</p>
</div>`;

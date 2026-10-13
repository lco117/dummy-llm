/**
 * Placeholder filters: `{input|upper|box}`. Every filter is synchronous and
 * side-effect free, because the streaming scheduler in src/engine.ts assumes it
 * can render a piece without awaiting anything.
 */
export type Filter = (value: string, arg: string) => string;

const MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
  I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
  Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..", "0": "-----", "1": ".----", "2": "..---", "3": "...--",
  "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "!": "-.-.--", "/": "-..-.",
};

/** A 3x5 block font — small enough to keep in source, big enough to look like a banner. */
const FONT: Record<string, string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"], D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"], F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"], H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"], J: ["..#", "..#", "..#", "#.#", ".#."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"], L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"], N: ["#.#", "##.", "###", ".##", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."], P: ["##.", "#.#", "##.", "#..", "#.."],
  Q: [".#.", "#.#", "#.#", "###", "..#"], R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"], V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "###", "###", "#.#"], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."], Z: ["###", "..#", ".#.", "#..", "###"],
  "0": [".#.", "#.#", "#.#", "#.#", ".#."], "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["##.", "..#", ".#.", "#..", "###"], "3": ["##.", "..#", ".#.", "..#", "##."],
  "4": ["#.#", "#.#", "###", "..#", "..#"], "5": ["###", "#..", "##.", "..#", "##."],
  "6": [".##", "#..", "###", "#.#", ".#."], "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": [".#.", "#.#", ".#.", "#.#", ".#."], "9": [".#.", "#.#", "###", "..#", "##."],
  " ": ["...", "...", "...", "...", "..."],
  "!": [".#.", ".#.", ".#.", "...", ".#."], "?": ["##.", "..#", ".#.", "...", ".#."],
  "-": ["...", "...", "###", "...", "..."], ".": ["...", "...", "...", "...", ".#."],
};

function width(value: string): number {
  return Array.from(value).length;
}

function box(value: string): string {
  const lines = value.split("\n");
  const inner = Math.max(1, ...lines.map(width));
  const border = "+" + "-".repeat(inner + 2) + "+";
  return [border, ...lines.map((line) => "| " + line + " ".repeat(inner - width(line)) + " |"), border].join("\n");
}

function banner(value: string): string {
  const rows = ["", "", "", "", ""];
  for (const character of value.toUpperCase()) {
    const glyph = FONT[character] ?? FONT[" "];
    for (let row = 0; row < 5; row++) rows[row] += glyph[row] + " ";
  }
  return rows.map((row) => row.replace(/\s+$/, "")).join("\n");
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64(value: string): string {
  const bytes = Array.from(new TextEncoder().encode(value));
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += BASE64[a >> 2];
    out += BASE64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : BASE64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : BASE64[c & 63];
  }
  return out;
}

function hex(value: string): string {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
}

/** FNV-1a. Deliberately not called "hash of a crypto kind" — it is a stable id, nothing more. */
function fingerprint(value: string): string {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function wrap(value: string, size: number): string {
  if (size <= 0) return value;
  return value
    .split("\n")
    .map((line) => {
      const points = Array.from(line);
      const out: string[] = [];
      for (let i = 0; i < points.length; i += size) out.push(points.slice(i, i + size).join(""));
      return out.join("\n");
    })
    .join("\n");
}

function number(arg: string, fallback: number): number {
  const parsed = Number.parseInt(arg, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const FILTERS: Record<string, Filter> = {
  upper: (value) => value.toUpperCase(),
  lower: (value) => value.toLowerCase(),
  title: (value) => value.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()),
  reverse: (value) => Array.from(value).reverse().join(""),
  spongebob: (value) => {
    let index = 0;
    return Array.from(value)
      .map((letter) => {
        if (!/\p{L}/u.test(letter)) return letter;
        return index++ % 2 === 0 ? letter.toLowerCase() : letter.toUpperCase();
      })
      .join("");
  },
  leet: (value) =>
    value.replace(/[aeiost]/gi, (letter) => ({ a: "4", e: "3", i: "1", o: "0", s: "5", t: "7" })[letter.toLowerCase()] ?? letter),
  truncate: (value, arg) => {
    const limit = number(arg, 80);
    const points = Array.from(value);
    return points.length <= limit ? value : points.slice(0, limit).join("") + "…";
  },
  repeat: (value, arg) => value.repeat(Math.max(0, number(arg, 2))),
  wrap: (value, arg) => wrap(value, number(arg, 40)),
  indent: (value, arg) => {
    const pad = " ".repeat(Math.max(0, number(arg, 2)));
    return value.split("\n").map((line) => pad + line).join("\n");
  },
  box: (value) => box(value),
  ascii: (value) => banner(value),
  morse: (value) =>
    value
      .toUpperCase()
      .split(" ")
      .map((word) => Array.from(word).map((letter) => MORSE[letter] ?? "").filter(Boolean).join(" "))
      .join(" / "),
  base64: (value) => base64(value),
  hex: (value) => hex(value),
  json: (value) => JSON.stringify(value),
  count: (value) => String(width(value)),
  hash: (value) => fingerprint(value),
};

export function applyFilters(value: string, specs: string[]): string {
  let out = value;
  for (const spec of specs) {
    const separator = spec.indexOf(":");
    const name = (separator === -1 ? spec : spec.slice(0, separator)).trim().toLowerCase();
    const arg = separator === -1 ? "" : spec.slice(separator + 1);
    const filter = FILTERS[name];
    if (filter) out = filter(out, arg);
  }
  return out;
}

export const FILTER_NAMES = Object.keys(FILTERS);

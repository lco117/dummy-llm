/**
 * The spec sheet the landing page prints for a model id.
 *
 * None of it is measured, and for this server that is the honest position: dummy-llm has no weights,
 * no context window and no benchmark rig. The numbers are invented from the id with the same FNV-1a
 * mixer `pseudoVector` uses, so two renders of the same id agree, a persona added in the admin gets a
 * full row without anyone maintaining a table, and reloading the page never reshuffles the chart.
 */

export const BENCHMARKS = ["terminal", "repeat", "agi"] as const;
export type Benchmark = (typeof BENCHMARKS)[number];
export type BenchScores = number[];

/** FNV-1a over the id. Unsigned, and stable across processes - unlike Math.random. */
function seed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const CONTEXT_WINDOWS = ["8K", "32K", "128K", "256K", "1M"];

/** A context window the server never reads, because it never reads anything. */
export function contextWindow(model: string): string {
  return CONTEXT_WINDOWS[seed(model) % CONTEXT_WINDOWS.length] as string;
}

/**
 * The scores on the three benchmarks.
 *
 * They are fixed values that this project defines, not measurements. The server implements none of
 * the benchmarks, so two of them return zero for every model, which is the accurate result. The
 * middle one is invented here, and it separates the answer profiles: a profile that returns the
 * message it received without changing it scores full marks, and every other profile scores twelve.
 */
export function benchmark(echoes: boolean): BenchScores {
  return BENCHMARKS.map((name) => (name === "repeat" ? (echoes ? 100 : 12) : 0));
}

/**
 * The bar width the page can express in CSS. Scores are whole percentages snapped to even numbers, so
 * the stylesheet needs fifty-one classes and never a style attribute.
 */
export function barStep(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score / 2) * 2));
}

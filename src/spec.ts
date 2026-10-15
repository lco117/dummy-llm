/**
 * The spec sheet the landing page prints for a model id.
 *
 * None of it is measured, and for this server that is the honest position: dummy-llm has no weights,
 * no context window and no benchmark rig. The numbers are invented from the id with the same FNV-1a
 * mixer `pseudoVector` uses, so two renders of the same id agree, a persona added in the admin gets a
 * full row without anyone maintaining a table, and reloading the page never reshuffles the chart.
 */

export const BENCH_DIMENSIONS = ["echo", "thinking", "nonsense", "pedantry"] as const;
export type BenchDimension = (typeof BENCH_DIMENSIONS)[number];
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

/** mulberry32: four lines of PRNG. Arbitrary-looking output, and no dependency to add. */
function stream(hash: number): () => number {
  let state = hash;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CONTEXT_WINDOWS = ["8K", "32K", "128K", "256K", "1M"];

/** A context window the server never reads, because it never reads anything. */
export function contextWindow(model: string): string {
  return CONTEXT_WINDOWS[seed(model) % CONTEXT_WINDOWS.length] as string;
}

/**
 * Four scores out of 100, on the half of the scale that reads as competence. Quantised to steps of
 * five, which is what lets the page size a bar with a class instead of a style attribute - and what
 * makes the numbers read as a rounded opinion rather than a measurement, which is the joke.
 */
export function benchmark(model: string): BenchScores {
  const next = stream(seed(model));
  return BENCH_DIMENSIONS.map(() => 50 + Math.round(next() * 10) * 5);
}

/** The bar width the page can express in CSS: one of eleven steps, never a raw percentage. */
export function barStep(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score / 5) * 5));
}

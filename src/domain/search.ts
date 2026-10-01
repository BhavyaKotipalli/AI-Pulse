/**
 * Reciprocal Rank Fusion: merges ranked lists from different retrievers (vector, full text)
 * without needing comparable scores. k=60 is the standard constant from Cormack et al. (2009).
 */
export function reciprocalRankFusion(lists: string[][], k = 60): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, rank) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1));
    });
  }
  return [...scores.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
}

/** Escapes LIKE wildcards in user input. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Normalizes a free-text query: trims, collapses whitespace, caps length. */
export function normalizeQuery(q: string, max = 200): string {
  return q.replace(/\s+/g, " ").trim().slice(0, max);
}

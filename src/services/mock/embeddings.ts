import { EMBEDDING_DIMENSIONS } from "@/domain/constants";
import type { EmbeddingProvider } from "@/services/ai/types";

/**
 * Offline embedding provider using signed feature hashing over unigrams + bigrams.
 * It captures lexical overlap (not deep semantics) — good enough for demo-mode search,
 * deterministic, and free. Real providers replace it via the registry without schema changes.
 */

const STOPWORDS = new Set(
  "a an and are as at be by can for from has have how i in is it its of on or that the this to was what when which who why will with you your do does did about into than then them they we our new".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s-]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/** Tiny suffix stemmer so "agents"/"agentic"/"agent" collide. */
function stem(token: string): string {
  if (token.length <= 4) return token;
  for (const suffix of ["ically", "ation", "ing", "ic", "es", "s"]) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 4) return token.slice(0, -suffix.length);
  }
  return token;
}

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function hashEmbed(text: string, dims: number = EMBEDDING_DIMENSIONS): number[] {
  const vec = new Array<number>(dims).fill(0);
  const tokens = tokenize(text);
  const features: Array<[string, number]> = tokens.map((t) => [t, 1]);
  for (let i = 0; i < tokens.length - 1; i++) features.push([`${tokens[i]}_${tokens[i + 1]}`, 0.5]);

  const counts = new Map<string, number>();
  for (const [f, w] of features) counts.set(f, (counts.get(f) ?? 0) + w);

  for (const [feature, tf] of counts) {
    const h = fnv1a(feature);
    const sign = (h & 1) === 0 ? 1 : -1;
    vec[h % dims]! += sign * Math.log1p(tf);
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm === 0) {
    vec[0] = 1; // avoid a zero vector (undefined cosine distance)
    return vec;
  }
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

export const mockEmbeddingProvider: EmbeddingProvider = {
  id: "mock-hash-768",
  isMock: true,
  dimensions: EMBEDDING_DIMENSIONS,
  // Measured on the demo corpus: unrelated queries peak around 0.14, related ones start near 0.2.
  relevanceFloor: 0.18,
  async embed(texts) {
    return texts.map((t) => hashEmbed(t));
  },
};

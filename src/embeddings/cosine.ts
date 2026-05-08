// Vectors stored in the index are L2-normalized at embed time, so cosine
// similarity reduces to a dot product. Keep this hot loop tight.
export function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosine: dim mismatch ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

export interface Scored<T> {
  item: T;
  score: number;
}

export function topK<T>(
  query: readonly number[],
  items: ReadonlyArray<{ data: T; embedding: readonly number[] }>,
  k: number,
): Scored<T>[] {
  const scored: Scored<T>[] = items.map((it) => ({
    item: it.data,
    score: cosine(query, it.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

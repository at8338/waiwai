export function spawnHash(text: string): number {
  let value = 2166136261;
  for (const c of text) value = Math.imul(value ^ c.charCodeAt(0), 16777619) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x7feb352d); value = Math.imul(value ^ value >>> 15, 0x846ca68b);
  return (value ^ value >>> 16) >>> 0;
}
// Exponential races give a weighted sample without replacement. Stable seeds keep
// a period's draw identical across reconnects, processes and room changes.
export function weightedDraw<T extends string>(kinds: readonly T[], count: number, seed: string, weight: (kind: T) => number): T[] {
  return kinds.map((kind) => ({ kind, score: -Math.log((spawnHash(`${seed}:${kind}`) + 1) / (2 ** 32 + 1)) / weight(kind) }))
    .sort((a, b) => a.score - b.score || a.kind.localeCompare(b.kind)).slice(0, count).map((entry) => entry.kind);
}

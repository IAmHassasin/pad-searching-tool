export type EggCardRate = {
  monsterId: number;
  weight: number;
};

const RATE_ENTRY = /"\(?(\d+)\)?"\s*:\s*(\d+(?:\.\d+)?)/g;

/** Published rate string → integer weight. 0.0165 (1.65%) becomes 165. */
export function decimalToWeight(raw: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,4}))?$/.exec(raw);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = (match[2] ?? "").padEnd(4, "0");
  return whole * 10000 + Number(fraction);
}

/**
 * Per-card weights from `egg_machines.contents`.
 * Keys are monster ids, often wrapped as `"(12345)"`. A zero weight is omitted.
 */
export function ratesFromContents(contents: string | null): EggCardRate[] {
  if (!contents) return [];
  const byId = new Map<number, number>();
  for (const match of contents.matchAll(RATE_ENTRY)) {
    const monsterId = Number(match[1]);
    const weight = decimalToWeight(match[2] ?? "");
    if (!Number.isInteger(monsterId) || monsterId <= 0 || weight == null || weight <= 0) {
      continue;
    }
    byId.set(monsterId, weight);
  }
  return [...byId.entries()].map(([monsterId, weight]) => ({ monsterId, weight }));
}

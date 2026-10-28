export type RateEntry = {
  monsterId: number;
  weight: number;
};

/** Returns an integer in `[0, exclusiveMax)`. */
export type RandomInt = (exclusiveMax: number) => number;

const UINT32 = 0x1_0000_0000;

/**
 * Unbiased integer from `crypto.getRandomValues`.
 * Rejects values in the leftover modulo range, same as `Random.nextInt`.
 */
export function cryptoRandomInt(exclusiveMax: number): number {
  if (!Number.isInteger(exclusiveMax) || exclusiveMax <= 0 || exclusiveMax > UINT32) {
    throw new Error("exclusiveMax must be a positive integer up to 2^32");
  }
  const limit = Math.floor(UINT32 / exclusiveMax) * exclusiveMax;
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0] ?? 0;
  } while (value >= limit);
  return value % exclusiveMax;
}

function positiveWeight(entries: readonly RateEntry[]): number {
  return entries.reduce((sum, entry) => sum + (entry.weight > 0 ? entry.weight : 0), 0);
}

/** One independent pull. Each call consumes a single ticket from `randomInt`. */
export function rollOne(entries: readonly RateEntry[], randomInt: RandomInt): RateEntry {
  const total = positiveWeight(entries);
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error("Egg machine has no roll rates");
  }
  let ticket = randomInt(total);
  if (!Number.isInteger(ticket) || ticket < 0 || ticket >= total) {
    throw new Error("Random int out of range");
  }
  for (const entry of entries) {
    if (entry.weight <= 0) continue;
    if (ticket < entry.weight) return entry;
    ticket -= entry.weight;
  }
  throw new Error("Roll missed every rate");
}

/** `count` independent pulls. No pity and no shared ticket. */
export function rollMany(
  entries: readonly RateEntry[],
  count: number,
  randomInt: RandomInt
): RateEntry[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("Roll count must be a positive integer");
  }
  const pulls: RateEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    pulls.push(rollOne(entries, randomInt));
  }
  return pulls;
}

/** Weight 165 → "1.65%". */
export function formatPublishedPercent(weight: number): string {
  const text = (weight / 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${text}%`;
}

/**
 * Hardest single hit listed in a dungeon's preemptive table.
 *
 * AppMedia writes the total for multi-hit attacks ("21,930,000ダメージの連続攻撃")
 * and the boosted value for conditional ones ("4,000,000(7倍時：28,000,000)ダメージ"),
 * so the largest "<number>ダメージ" across every effect line is the damage a
 * team has to survive. Lines like "被ダメージ半減" or "ダメージ上限値20億" have no
 * digits directly before ダメージ and are ignored.
 */

// Optional ")" covers "4,000,000(7倍時：28,000,000)ダメージ" (boosted value wins).
// Japanese units: "2,193万ダメージ" = 21,930,000, "1.5億ダメージ" = 150,000,000.
// "10億ダメージ吸収" / "1,000,000ダメージ以上無効" are thresholds, not hits.
const DAMAGE_RE =
  /([\d,]+(?:\.\d+)?)(万|億)?\)?ダメージ(?!吸収|無効|軽減|上限|以上|以下|未満|減少|カット|半減|を)/g;
// Digits grouped in threes ("21,930,000") or no separator at all ("21930000"),
// optionally with decimals when a unit follows ("147.2万").
// Source typos such as "7,800,0000" are rejected: reading them as 78,000,000
// would be a 10× error, so they are reported instead of trusted.
const WELL_FORMED_RE = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
const UNIT_FACTOR = { 万: 10_000, 億: 100_000_000 };

/**
 * @typedef {Object} DungeonMaxDamage
 * @property {number} value
 * @property {string|null} floor
 * @property {number|null} monsterId
 * @property {string|null} monsterNameJa
 * @property {string} raw
 */

/**
 * Every well-formed "<number>ダメージ" value in one effect line, in order.
 * Malformed groups are skipped and, when `onInvalid` is given, reported.
 * @param {string} raw
 * @param {(token: string, raw: string) => void} [onInvalid]
 * @returns {number[]}
 */
export function parseDamageValues(raw, onInvalid) {
  /** @type {number[]} */
  const out = [];
  if (!raw) return out;
  for (const m of raw.matchAll(DAMAGE_RE)) {
    const unit = m[2] ?? "";
    if (!WELL_FORMED_RE.test(m[1]) || (!unit && m[1].includes("."))) {
      onInvalid?.(m[1] + unit, raw);
      continue;
    }
    const n = Number(m[1].replace(/,/g, "")) * (UNIT_FACTOR[unit] ?? 1);
    if (Number.isFinite(n) && n > 0) out.push(Math.round(n));
  }
  return out;
}

/**
 * @param {import("./parse-dungeon-table.mjs").DungeonFloor[]|undefined} floors
 * @param {(token: string, raw: string) => void} [onInvalid] called for each malformed damage token
 * @returns {DungeonMaxDamage|null}
 */
export function findMaxDamage(floors, onInvalid) {
  /** @type {DungeonMaxDamage|null} */
  let best = null;
  for (const floor of floors ?? []) {
    for (const spawn of floor.spawns ?? []) {
      for (const effect of spawn.effects ?? []) {
        for (const value of parseDamageValues(effect.raw, onInvalid)) {
          if (best && value <= best.value) continue;
          best = {
            value,
            floor: floor.floor ?? null,
            monsterId: spawn.monsterId ?? null,
            monsterNameJa: spawn.monsterNameJa ?? null,
            raw: effect.raw,
          };
        }
      }
    }
  }
  return best;
}

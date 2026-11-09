/**
 * Per-floor summary of an imported floor table: the floor number, the hardest hit on
 * that floor and how many breakable parts it has. Used by the team-build Trial (HP per
 * floor with Aging / Part Break Bonus, heavy-hit floors).
 */

import { parseDamageValues } from "./max-damage.mjs";

/**
 * @typedef {Object} FloorHit
 * @property {number} value
 * @property {number|null} monsterId
 * @property {string|null} monsterNameJa
 * @property {string} raw
 */

/**
 * @typedef {Object} FloorSummary
 * @property {number} index        1-based position in the table
 * @property {string} label        "B5", "乱入", …
 * @property {number|null} floor   floor number when the label carries one
 * @property {FloorHit|null} maxHit
 * @property {number|null} partCount  breakable parts on the floor; null = none found
 */

/**
 * Split a digit run where the floor number and the spawn count were glued together
 * ("B12体出現" = B1 + 2体). Prefers the split that continues the floor sequence.
 * @param {string} digits
 * @param {number} prevFloor  last floor number seen (0 before the first floor)
 * @returns {{ floor: number, count: number } | null}
 */
export function splitGluedFloorDigits(digits, prevFloor) {
  if (!/^\d{2,}$/.test(digits)) return null;
  /** @type {Array<{ floor: number, count: number }>} */
  const candidates = [];
  for (let k = 1; k < digits.length; k++) {
    const count = digits.slice(k);
    if (count.startsWith("0")) continue;
    candidates.push({ floor: Number(digits.slice(0, k)), count: Number(count) });
  }
  if (!candidates.length) return null;
  return (
    candidates.find((c) => c.floor === prevFloor + 1) ??
    candidates.find((c) => c.floor > prevFloor) ??
    null
  );
}

/**
 * Floor label + spawn note from the header cell text. `prevFloor` resolves labels
 * where AppMedia omits the space ("B12体出現").
 * @param {string} text
 * @param {number} prevFloor
 * @returns {{ floor: string|null, spawnNote: string|null }}
 */
export function parseFloorHeaderText(text, prevFloor) {
  const glued = text.match(/B(\d+)体出現/i);
  if (glued) {
    const whole = Number(glued[1]);
    // "B12体出現" right after B11 is genuinely B12 with no count; otherwise split.
    const split = whole === prevFloor + 1 ? null : splitGluedFloorDigits(glued[1], prevFloor);
    if (split) return { floor: `B${split.floor}`, spawnNote: `${split.count}体出現` };
  }
  const floorMatch = text.match(/B(\d+)/i);
  const spawnNote = text.match(/(\d+体出現)/)?.[1] ?? null;
  if (floorMatch) return { floor: `B${floorMatch[1]}`, spawnNote };
  if (/乱入/.test(text)) return { floor: "乱入", spawnNote };
  return { floor: null, spawnNote };
}

/**
 * Repair labels stored by importer versions that glued the floor number to the spawn
 * count: the stored label and spawn note then carry the same digits ("B12" / "12体出現").
 * Returns a new array; floors without the pattern are returned unchanged.
 * @template {{ floor: string, spawnNote: string|null }} F
 * @param {F[]} floors
 * @returns {{ floors: F[], repaired: number }}
 */
export function repairGluedFloorLabels(floors) {
  let prev = 0;
  let repaired = 0;
  const out = (floors ?? []).map((f) => {
    const label = /^B(\d+)$/.exec(f.floor ?? "");
    const note = /^(\d+)体出現$/.exec(f.spawnNote ?? "");
    let next = f;
    if (label && note && label[1] === note[1] && Number(label[1]) !== prev + 1) {
      const split = splitGluedFloorDigits(label[1], prev);
      if (split) {
        next = { ...f, floor: `B${split.floor}`, spawnNote: `${split.count}体出現` };
        repaired += 1;
      }
    }
    const n = floorNumber(next.floor);
    if (n != null) prev = n;
    return next;
  });
  return { floors: out, repaired };
}

/** @param {string|null|undefined} label */
export function floorNumber(label) {
  const m = /^B(\d+)$/.exec(label ?? "");
  return m ? Number(m[1]) : null;
}

/**
 * Breakable parts of one spawn, from AppMedia's effect lines:
 * 【部位3箇所】, one 【左部位：HP…】 line per part, 【部位2個破壊時】 (+1 when an
 * 【全ての部位破壊時】 stage follows), 【部位が両方破壊された時】 = 2.
 * @param {string[]} raws
 * @returns {number}
 */
export function partCountFromEffects(raws) {
  let n = 0;
  let mentions = false;
  let maxBreakStage = 0;
  let allBroken = false;
  const hpLines = new Set();
  for (const raw of raws) {
    if (!raw || !raw.includes("部位")) continue;
    mentions = true;
    const explicit = raw.match(/部位\s*(\d+)\s*(?:箇所|個|つ)】/);
    if (explicit) n = Math.max(n, Number(explicit[1]));
    if (/部位[^】]*[：:]\s*HP|部位[^】]*】\s*HP/.test(raw)) hpLines.add(raw);
    for (const m of raw.matchAll(/部位\s*(\d+)\s*(?:箇所|個|つ)\s*破壊/g)) {
      maxBreakStage = Math.max(maxBreakStage, Number(m[1]));
    }
    if (/両方/.test(raw)) n = Math.max(n, 2);
    if (/全(?:て)?の?部位(?:が)?破壊|部位全破壊/.test(raw)) allBroken = true;
  }
  if (!mentions) return 0;
  n = Math.max(n, hpLines.size, maxBreakStage);
  if (allBroken && maxBreakStage > 0 && maxBreakStage >= n) n = maxBreakStage + 1;
  return Math.max(n, 1);
}

/**
 * @param {Array<{ floor: string, spawns?: Array<{ monsterId?: number|null, monsterNameJa?: string|null, effects?: Array<{ raw: string }> }> }>} floors
 * @returns {FloorSummary[]}
 */
export function summarizeFloors(floors) {
  return (floors ?? []).map((f, i) => {
    /** @type {FloorHit|null} */
    let maxHit = null;
    let partCount = 0;
    for (const spawn of f.spawns ?? []) {
      const raws = (spawn.effects ?? []).map((e) => e.raw ?? "");
      // Spawns on one floor are usually alternatives (random boss), so take the max.
      partCount = Math.max(partCount, partCountFromEffects(raws));
      for (const raw of raws) {
        for (const value of parseDamageValues(raw)) {
          if (maxHit && value <= maxHit.value) continue;
          maxHit = {
            value,
            monsterId: spawn.monsterId ?? null,
            monsterNameJa: spawn.monsterNameJa ?? null,
            raw,
          };
        }
      }
    }
    return {
      index: i + 1,
      label: f.floor,
      floor: floorNumber(f.floor),
      maxHit,
      partCount: partCount > 0 ? partCount : null,
    };
  });
}

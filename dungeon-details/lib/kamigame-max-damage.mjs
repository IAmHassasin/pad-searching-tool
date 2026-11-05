import { findMaxDamageInEnemyTables } from "./enemy-tables.mjs";

/**
 * Hardest hit on a Kamigame dungeon page.
 *
 * Kamigame lists enemies as tables under headings such as
 * 「出現する敵と注意点」, 「出現モンスターと行動早見表」, 「出現する敵の早見表」 or
 * per-floor 「ダンジョンデータ」 sections, with bullet lines like
 * 「・4,000,000ダメージ」 or 「・無言パンチ（8,000,000ダメージ）」. Only those
 * tables are read (see enemy-tables.mjs), so numbers quoted in team
 * recommendations are ignored. Returns null when nothing matches.
 */

/**
 * @typedef {Object} KamigameMaxDamage
 * @property {number} value
 * @property {string|null} floor
 * @property {string|null} monsterNameJa
 * @property {string} raw
 */

/**
 * @param {string} html
 * @param {(token: string, raw: string) => void} [onInvalid]
 * @returns {KamigameMaxDamage|null}
 */
export function parseKamigameMaxDamage(html, onInvalid) {
  const hit = findMaxDamageInEnemyTables(html, { onInvalid });
  if (!hit) return null;
  return { value: hit.value, floor: hit.floor, monsterNameJa: hit.monsterNameJa, raw: hit.raw };
}

import * as cheerio from "cheerio";
import { parseDamageValues } from "./max-damage.mjs";

/**
 * Hardest hit inside the enemy tables of a guide page (AppMedia guides
 * without the 先制ギミック早見表, Kamigame dungeon pages).
 *
 * Headings and tables are walked in document order; a table counts when the
 * nearest heading before it, or the nearest h2 section, looks like enemy data
 * (`sectionRe`), or when the table itself mentions 先制. Team-recommendation
 * and strategy sections are skipped that way. Each cell is split on <br>
 * so the raw line of the winning value can be shown to the user.
 */

/** Headings that introduce enemy / floor data on both sites. */
export const ENEMY_SECTION_RE =
  /出現|敵|モンスター|ダンジョンデータ|先制|行動|^\s*(?:B\s*)?\d+\s*F?\s*$|階層|階/;

/**
 * @typedef {Object} TableMaxDamage
 * @property {number} value
 * @property {string|null} floor
 * @property {string|null} monsterNameJa
 * @property {string} raw
 * @property {string} heading
 */

/**
 * @param {string} html
 * @param {{ sectionRe?: RegExp, onInvalid?: (token: string, raw: string) => void }} [options]
 * @returns {TableMaxDamage|null}
 */
export function findMaxDamageInEnemyTables(html, options = {}) {
  const sectionRe = options.sectionRe ?? ENEMY_SECTION_RE;
  const $ = cheerio.load(html);
  /** @type {TableMaxDamage|null} */
  let best = null;
  let lastHeading = "";
  let lastSection = "";

  $("h1, h2, h3, h4, table").each((_, el) => {
    const tag = (el.tagName ?? "").toLowerCase();
    if (tag !== "table") {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      lastHeading = text;
      if (tag === "h1" || tag === "h2") lastSection = text;
      return;
    }
    const $t = $(el);
    if (!sectionRe.test(lastHeading) && !sectionRe.test(lastSection) && !$t.text().includes("先制")) {
      return;
    }
    const heading = lastHeading;
    $t.find("tr").each((__, tr) => {
      const cells = $(tr).find("td");
      if (!cells.length) return;
      const floorText = cells.first().text().replace(/\s+/g, " ").trim();
      const floor =
        cells.length >= 2 && /^(?:乱入|B\s*\d|\d+\s*F|\d+階)/.test(floorText) ? floorText : null;
      const monsterNameJa =
        cells.length >= 2 ? cells.eq(floor ? 1 : 0).find("img[alt]").first().attr("alt")?.replace(/_アイコン$/i, "").trim() || null : null;
      cells.each((___, td) => {
        const lines = ($(td).html() ?? "")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/(?:p|li|div)>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .split("\n")
          .map((l) => l.replace(/\s+/g, " ").trim())
          .filter(Boolean);
        for (const raw of lines) {
          for (const value of parseDamageValues(raw, options.onInvalid)) {
            if (best && value <= best.value) continue;
            best = { value, floor, monsterNameJa, raw, heading };
          }
        }
      });
    });
  });
  return best;
}

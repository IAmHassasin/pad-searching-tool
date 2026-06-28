import * as cheerio from "cheerio";
import { absolutizeAppMediaUrl } from "./appmedia-fetch.mjs";
import { slugifyGimmickId } from "./gimmick-master.mjs";

/**
 * Parse 対策必須ギミック / 要注意ギミック table from article HTML.
 * @param {string} html
 */
export function parseGimmickPanel(html) {
  const $ = cheerio.load(html);
  const heading = $("h3")
    .filter((_, el) => $(el).text().includes("対策しておきたいギミック"))
    .first();
  if (!heading.length) return [];

  const table = heading.nextAll("table").first();
  if (!table.length) return [];

  /** @type {Array<{ id: string, labelJa: string, iconAlt: string, iconUrl: string, category: "required"|"caution", phrases: string[] }>} */
  const entries = [];
  let category = /** @type {"required"|"caution"} */ ("required");

  table.find("tr").each((_, tr) => {
    const $tr = $(tr);
    const th = $tr.find("th").first();
    if (th.length) {
      const label = th.text().trim();
      if (label.includes("要注意")) category = "caution";
      else if (label.includes("対策必須")) category = "required";
      return;
    }

    $tr.find("td").each((_, td) => {
      const $td = $(td);
      const text = $td.text().replace(/\u2013|–|-/g, "").trim();
      const img = $td.find("img").first();
      if (!img.length || !text) return;

      const iconAlt = (img.attr("alt") ?? "").trim();
      const labelJa = text || iconAlt;
      if (!labelJa) return;

      const iconUrl = absolutizeAppMediaUrl(img.attr("src") ?? "");
      const phrases = uniqueNonEmpty([
        labelJa,
        iconAlt,
        normalizePhrase(labelJa),
        labelJa.replace(/×/g, "x"),
      ]);

      entries.push({
        id: slugifyGimmickId(labelJa),
        labelJa,
        iconAlt,
        iconUrl,
        category,
        phrases,
      });
    });
  });

  return entries;
}

/** @param {string} label */
function normalizePhrase(label) {
  return label
    .replace(/毒\/猛毒/g, "猛毒")
    .replace(/5×4マス/g, "盤面5×4マス");
}

/** @param {string[]} items */
function uniqueNonEmpty(items) {
  return [...new Set(items.map((s) => s.trim()).filter(Boolean))];
}

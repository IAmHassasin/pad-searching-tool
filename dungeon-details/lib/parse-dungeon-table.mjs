import * as cheerio from "cheerio";
import { absolutizeAppMediaUrl } from "./appmedia-fetch.mjs";
import { buildPhraseLookup, matchGimmicksInLine } from "./gimmick-master.mjs";

/**
 * @typedef {Object} DungeonSpawnEffect
 * @property {string} raw
 * @property {string[]} tags
 * @property {string[]} gimmickIds
 * @property {string|null} damage
 * @property {string|null} turns
 */

/**
 * @typedef {Object} DungeonSpawn
 * @property {number|null} monsterId
 * @property {string|null} monsterNameJa
 * @property {string|null} iconUrl
 * @property {string[]} types
 * @property {string|null} hp
 * @property {string|null} defense
 * @property {Array<{label:string, hp?:string, defense?:string}>|undefined} parts
 * @property {DungeonSpawnEffect[]} effects
 */

/**
 * @typedef {Object} DungeonFloor
 * @property {string} floor
 * @property {string|null} spawnNote
 * @property {DungeonSpawn[]} spawns
 */

/**
 * Expand a table row accounting for active rowspans.
 * @param {cheerio.Cheerio<any>[]} rowCells
 * @param {Map<number, { cell: cheerio.Cheerio<any>, left: number }>} rowspanState
 */
function expandRowCells(rowCells, rowspanState) {
  /** @type {cheerio.Cheerio<any>[]} */
  const cols = [];
  let read = 0;
  let col = 0;

  while (read < rowCells.length || rowspanState.has(col)) {
    const pending = rowspanState.get(col);
    if (pending && pending.left > 0) {
      cols[col] = pending.cell;
      pending.left -= 1;
      if (pending.left <= 0) rowspanState.delete(col);
      col += 1;
      continue;
    }
    if (read >= rowCells.length) break;
    const cell = rowCells[read++];
    cols[col] = cell;
    const span = Number(cell.attr("rowspan") ?? 1);
    if (span > 1) {
      rowspanState.set(col, { cell, left: span - 1 });
    }
    col += 1;
  }

  return cols;
}

/**
 * @param {string} html
 * @param {import("./gimmick-master.mjs").GimmickEntry[]} [masterEntries]
 * @returns {DungeonFloor[]}
 */
export function parseDungeonFloorTable(html, masterEntries = []) {
  const $ = cheerio.load(html);
  const heading = $("h3")
    .filter((_, el) => $(el).text().includes("先制ギミック早見表"))
    .first();
  if (!heading.length) {
    throw new Error("先制ギミック早見表 section not found");
  }

  const table = heading.nextAll("table").first();
  if (!table.length) {
    throw new Error("Floor table not found after 先制ギミック早見表");
  }

  const phraseLookup = buildPhraseLookup(masterEntries);
  /** @type {DungeonFloor[]} */
  const floors = [];
  /** @type {Map<number, { cell: cheerio.Cheerio<any>, left: number }>} */
  const rowspanState = new Map();

  table.find("tr").each((rowIdx, tr) => {
    if (rowIdx === 0) return;
    const rowCells = $(tr).find("td").toArray().map((el) => $(el));
    if (!rowCells.length) return;

    const cols = expandRowCells(rowCells, rowspanState);
    const floorCell = cols[0];
    const spawnCell = cols[1];
    const effectCell = cols[2];
    if (!spawnCell || !effectCell) return;

    const floorInfo = parseFloorHeader(floorCell);
    let floor = floors[floors.length - 1];
    if (floorInfo.floor && (!floor || floor.floor !== floorInfo.floor)) {
      floor = { floor: floorInfo.floor, spawnNote: floorInfo.spawnNote, spawns: [] };
      floors.push(floor);
    } else if (floorInfo.spawnNote && floor) {
      floor.spawnNote = floor.spawnNote ?? floorInfo.spawnNote;
    }
    if (!floor) return;

    const spawn = parseSpawnCell($, spawnCell);
    const effects = parseEffectCell($, effectCell, phraseLookup);
    floor.spawns.push({ ...spawn, effects });
  });

  return floors;
}

/** @param {cheerio.Cheerio<any>|undefined} $td */
function parseFloorHeader($td) {
  if (!$td?.length) return { floor: null, spawnNote: null };
  const text = $td.text().replace(/\s+/g, " ").trim();
  const floorMatch = text.match(/B(\d+)/i);
  const spawnNoteMatch = text.match(/(\d+体出現)/);
  return {
    floor: floorMatch ? `B${floorMatch[1]}` : null,
    spawnNote: spawnNoteMatch?.[1] ?? null,
  };
}

/**
 * @param {import("cheerio").CheerioAPI} $
 * @param {cheerio.Cheerio<any>} $td
 */
function parseSpawnCell($, $td) {
  const iconImg = $td.find('img[src*="kobetu/icon/"]').first();
  const iconSrc = iconImg.attr("src") ?? "";
  const monsterIdMatch = iconSrc.match(/kobetu\/icon\/(\d+)\./i);
  const monsterNameJa = (iconImg.attr("alt") ?? "")
    .replace(/_アイコン$/i, "")
    .trim();

  const types = [];
  $td.find('img[src*="type_icon"]').each((_, img) => {
    types.push(($(img).attr("alt") ?? "").trim());
  });

  const smallText = $td.find("span.small").text().replace(/\s+/g, " ").trim();
  const hpMatch = smallText.match(/HP:([^防御]+?)(?:防御|$)/);
  const defMatch = smallText.match(/防御:([^\n]+)/);

  /** @type {{ label: string, hp?: string, defense?: string }[]} */
  const parts = [];
  const html = $td.html() ?? "";
  for (const block of html.split(/<span class="bold">/i).slice(1)) {
    const label = block.match(/^([^<]+)/)?.[1]?.replace(/【|】/g, "").trim();
    const hp = block.match(/HP:([^<\n]+)/)?.[1]?.trim();
    const defense = block.match(/防御:([^<\n]+)/)?.[1]?.trim();
    if (label) parts.push({ label, hp, defense });
  }

  return {
    monsterId: monsterIdMatch ? Number(monsterIdMatch[1]) : null,
    monsterNameJa: monsterNameJa || null,
    iconUrl: iconSrc ? absolutizeAppMediaUrl(iconSrc) : null,
    types: types.filter(Boolean),
    hp: hpMatch?.[1]?.trim() ?? null,
    defense: defMatch?.[1]?.trim() ?? null,
    parts: parts.length ? parts : undefined,
  };
}

/**
 * @param {import("cheerio").CheerioAPI} $
 * @param {cheerio.Cheerio<any>} $td
 * @param {ReturnType<typeof buildPhraseLookup>} phraseLookup
 */
function parseEffectCell($, $td, phraseLookup) {
  const html = ($td.html() ?? "").replace(/<br\s*\/?>/gi, "\n");
  const lines = cheerio
    .load(`<div>${html}</div>`)("div")
    .text()
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return lines.map((raw) => ({
    raw,
    tags: [...raw.matchAll(/【([^】]+)】/g)].map((m) => m[1].trim()),
    gimmickIds: matchGimmicksInLine(raw, phraseLookup),
    damage: raw.match(/([\d,]+ダメージ)/)?.[1] ?? null,
    turns: raw.match(/(\d+ターン)/)?.[1] ?? null,
  }));
}

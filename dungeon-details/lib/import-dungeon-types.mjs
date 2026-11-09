/**
 * @typedef {Object} DungeonExport
 * @property {number} appmediaPostId
 * @property {string} titleJa
 * @property {string} titleEn
 * @property {string} sourceUrl
 * @property {string|null} modified
 * @property {string} importedAt
 * @property {import("./max-damage.mjs").DungeonMaxDamage|null} maxDamage
 * @property {import("./floor-summary.mjs").FloorSummary[]} floorSummary
 * @property {Array<{ id: string, labelJa: string, iconUrl: string, category: string }>} requiredGimmicks
 * @property {Array<{ id: string, labelJa: string, iconUrl: string, category: string }>} cautionGimmicks
 * @property {import("./parse-dungeon-table.mjs").DungeonFloor[]} floors
 */

export {};

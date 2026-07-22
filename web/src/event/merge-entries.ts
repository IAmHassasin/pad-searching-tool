import type { EventEntry } from "./types";
import { monsterRowId } from "../lib/filters";

function rarityOf(entry: EventEntry): number {
  const id = entry.family.monsterId;
  const node = entry.family.nodes.find((row) => monsterRowId(row) === id);
  return Number(node?.rarity ?? 0);
}

function nodeIds(entry: EventEntry): number[] {
  return entry.family.nodes
    .map((row) => monsterRowId(row))
    .filter((id) => id > 0);
}

function pickMergedEntry(a: EventEntry, b: EventEntry): EventEntry {
  const primary = rarityOf(b) > rarityOf(a) ? b : a;
  const secondary = primary === a ? b : a;
  const hasNewMonster =
    a.role === "new-monster" || b.role === "new-monster";
  const hasNewEvo =
    a.role === "new-evolution" || b.role === "new-evolution";
  const richerFamily =
    primary.family.nodes.length >= secondary.family.nodes.length
      ? primary.family
      : secondary.family;

  // Prefer a playable (non-assist) headline when rarities tie — evo assist
  // fodder often shares rarity 9 with UE; keep the UE / base card as face.
  let monsterId = primary.family.monsterId;
  if (rarityOf(a) === rarityOf(b)) {
    const aAssist = !a.family.nodes.some(
      (row) =>
        monsterRowId(row) === a.family.monsterId &&
        Number(row.leader_skill_id ?? 0) > 0
    );
    const bAssist = !b.family.nodes.some(
      (row) =>
        monsterRowId(row) === b.family.monsterId &&
        Number(row.leader_skill_id ?? 0) > 0
    );
    if (aAssist && !bAssist) monsterId = b.family.monsterId;
    else if (bAssist && !aAssist) monsterId = a.family.monsterId;
  }

  return {
    role: hasNewMonster
      ? "new-monster"
      : hasNewEvo
        ? "new-evolution"
        : primary.role,
    label: hasNewMonster
      ? a.label === "New Monster" || b.label === "New Monster"
        ? "New Monster"
        : (primary.label ?? "New Monster")
      : hasNewEvo
        ? "New Evolution"
        : primary.label,
    note: primary.note ?? secondary.note,
    family: {
      ...richerFamily,
      monsterId,
    },
  };
}

/**
 * Collapse seed rows that belong to the same evolution family into one card.
 * Matches on `baseId` and also on overlapping family node ids (assist child
 * of a new card must not get its own tile).
 */
export function mergeEntriesByFamily(entries: EventEntry[]): EventEntry[] {
  const merged: EventEntry[] = [];

  for (const entry of entries) {
    const ids = new Set(nodeIds(entry));
    ids.add(entry.family.baseId);
    ids.add(entry.family.monsterId);
    ids.add(entry.family.coverMonsterId);

    let hit = -1;
    for (let i = 0; i < merged.length; i++) {
      const other = merged[i]!;
      const otherIds = new Set(nodeIds(other));
      otherIds.add(other.family.baseId);
      otherIds.add(other.family.monsterId);
      otherIds.add(other.family.coverMonsterId);
      let overlap = false;
      for (const id of ids) {
        if (otherIds.has(id)) {
          overlap = true;
          break;
        }
      }
      if (
        overlap ||
        other.family.baseId === entry.family.baseId
      ) {
        hit = i;
        break;
      }
    }

    if (hit < 0) merged.push(entry);
    else merged[hit] = pickMergedEntry(merged[hit]!, entry);
  }

  return merged;
}

import type { MonsterFilters, MonsterRecord, SkillFilters } from "../types";

export function monsterRowId(row: MonsterRecord): number {
  const id = row.monster_id ?? row.__source_pk;
  return typeof id === "number" ? id : Number(id);
}

function inRange(
  value: number | null | undefined,
  min: number | null,
  max: number | null
): boolean {
  if (value == null || Number.isNaN(Number(value))) return false;
  const n = Number(value);
  if (min != null && n < min) return false;
  if (max != null && n > max) return false;
  return true;
}

export function matchesMonsterFilters(
  row: MonsterRecord,
  f: MonsterFilters
): boolean {
  if (f.rarity.size > 0) {
    const r = row.rarity;
    if (r == null || !f.rarity.has(Number(r))) return false;
  }

  if (f.attributes.size > 0) {
    const attrs = [
      row.attribute_1_id,
      row.attribute_2_id,
      row.attribute_3_id,
    ].filter((a) => a != null) as number[];
    const hit = attrs.some((a) => f.attributes.has(Number(a)));
    if (!hit) return false;
  }

  if (!inRange(row.hp_max, f.hpMin, f.hpMax)) return false;
  if (!inRange(row.atk_max, f.atkMin, f.atkMax)) return false;
  if (!inRange(row.rcv_max, f.rcvMin, f.rcvMax)) return false;

  const q = f.idQuery.trim();
  if (q) {
    const id = monsterRowId(row);
    const na = row.monster_no_na;
    const qLower = q.toLowerCase();
    const idStr = String(id);
    const naStr = na != null ? String(na) : "";
    const name = (row.name_en ?? "").toLowerCase();
    if (
      !idStr.includes(q) &&
      !naStr.includes(q) &&
      !name.includes(qLower)
    ) {
      return false;
    }
  }

  return true;
}

function textIncludes(hay: string | null | undefined, needle: string): boolean {
  if (!needle.trim()) return true;
  return (hay ?? "").toLowerCase().includes(needle.trim().toLowerCase());
}

export function matchesSkillText(
  row: MonsterRecord,
  f: SkillFilters
): boolean {
  const active = f.activeSkillText.trim();
  const leader = f.leaderSkillText.trim();
  if (!active && !leader) return true;

  if (f.skillTextMode === "active") {
    return textIncludes(row.active_skill_desc_en, active || leader);
  }
  if (f.skillTextMode === "leader") {
    return textIncludes(row.leader_skill_desc_en, leader || active);
  }
  const activeOk = active
    ? textIncludes(row.active_skill_desc_en, active)
    : true;
  const leaderOk = leader
    ? textIncludes(row.leader_skill_desc_en, leader)
    : true;
  return activeOk && leaderOk;
}

export function buildCategoryIdSet(
  bundles: Map<string, Set<number>>,
  selected: { category: string; file: string }[],
  mode: "any" | "all"
): Set<number> | null {
  if (!selected.length) return null;

  if (mode === "any") {
    const union = new Set<number>();
    for (const s of selected) {
      const set = bundles.get(s.file);
      if (set) for (const id of set) union.add(id);
    }
    return union;
  }

  let intersection: Set<number> | null = null;
  for (const s of selected) {
    const set = bundles.get(s.file);
    if (!set) return new Set();
    if (!intersection) {
      intersection = new Set(set);
    } else {
      intersection = new Set([...intersection].filter((id) => set.has(id)));
    }
  }
  return intersection ?? new Set();
}

export function filterMonsters(
  rows: MonsterRecord[],
  monsterFilters: MonsterFilters,
  skillFilters: SkillFilters,
  categoryIds: Set<number> | null
): MonsterRecord[] {
  return rows.filter((row) => {
    if (!matchesMonsterFilters(row, monsterFilters)) return false;
    if (!matchesSkillText(row, skillFilters)) return false;
    if (categoryIds) {
      if (!categoryIds.has(monsterRowId(row))) return false;
    }
    return true;
  });
}

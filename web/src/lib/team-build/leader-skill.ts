import { parseMonsterTypeIds } from "../monster-types";
import type { MonsterRecord } from "../../types";

export type LeaderStatMultipliers = { hp: number; rcv: number };

const TYPE_ALIASES: Record<string, number> = {
  god: 5,
  dragon: 4,
  devil: 7,
  machine: 8,
  balance: 1,
  attacker: 6,
  physical: 2,
  healer: 3,
};

const ATTR_ALIASES: Record<string, number> = {
  fire: 0,
  water: 1,
  wood: 2,
  light: 3,
  dark: 4,
};

type ParsedClause = {
  hp: number;
  rcv: number;
  types: number[];
  attributes: number[];
};

function parseMultiplier(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Extract simple HP/RCV/all-stats clauses from English leader skill text. */
export function parseLeaderSkillMultipliers(
  desc: string | null | undefined
): ParsedClause[] {
  if (!desc?.trim()) return [];
  const text = desc.toLowerCase();
  const clauses: ParsedClause[] = [];

  const patterns: RegExp[] = [
    /([\d.]+)x\s+all\s+stats?\s+for\s+([\w\s]+?)\s+type/g,
    /([\d.]+)x\s+hp\s*(?:&|and)\s*rcv\s+for\s+([\w\s]+?)\s+type/g,
    /([\d.]+)x\s+hp\s*(?:&|and)\s*rcv\s+for\s+([\w\s]+?)\s+att/g,
    /([\d.]+)x\s+hp\s+for\s+([\w\s]+?)\s+type/g,
    /([\d.]+)x\s+rcv\s+for\s+([\w\s]+?)\s+type/g,
    /([\d.]+)x\s+hp\s+for\s+([\w\s]+?)\s+att/g,
    /([\d.]+)x\s+rcv\s+for\s+([\w\s]+?)\s+att/g,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const mult = parseMultiplier(m[1]);
      const target = m[2].trim();
      const isAtt = re.source.includes("att");
      const clause: ParsedClause = {
        hp: 1,
        rcv: 1,
        types: [],
        attributes: [],
      };
      if (re.source.includes("all")) {
        clause.hp = mult;
        clause.rcv = mult;
      } else if (re.source.includes("hp")) {
        clause.hp = mult;
      } else if (re.source.includes("rcv")) {
        clause.rcv = mult;
      }
      if (isAtt) {
        const attrId = ATTR_ALIASES[target.split(/\s+/)[0]];
        if (attrId) clause.attributes.push(attrId);
      } else {
        const typeId = TYPE_ALIASES[target.split(/\s+/)[0]];
        if (typeId) clause.types.push(typeId);
      }
      clauses.push(clause);
    }
  }

  return clauses;
}

function memberAttributes(row: MonsterRecord): number[] {
  const out: number[] = [];
  for (const id of [
    row.attribute_1_id,
    row.attribute_2_id,
    row.attribute_3_id,
  ]) {
    if (id != null && id > 0 && !out.includes(id)) out.push(id);
  }
  return out;
}

function clauseMatchesMonster(clause: ParsedClause, row: MonsterRecord): boolean {
  const hasTypeFilter = clause.types.length > 0;
  const hasAttrFilter = clause.attributes.length > 0;
  if (!hasTypeFilter && !hasAttrFilter) return true;

  if (hasTypeFilter) {
    const types = parseMonsterTypeIds(row);
    if (!clause.types.some((t) => types.includes(t))) return false;
  }
  if (hasAttrFilter) {
    const attrs = memberAttributes(row);
    if (!clause.attributes.some((a) => attrs.includes(a))) return false;
  }
  return true;
}

export function leaderMultipliersForMember(
  row: MonsterRecord,
  leader: MonsterRecord | null,
  override: LeaderStatMultipliers
): LeaderStatMultipliers {
  let hp = 1;
  let rcv = 1;

  const clauses = parseLeaderSkillMultipliers(leader?.leader_skill_desc_en);
  if (clauses.length) {
    for (const clause of clauses) {
      if (!clauseMatchesMonster(clause, row)) continue;
      hp *= clause.hp;
      rcv *= clause.rcv;
    }
  } else {
    hp *= override.hp;
    rcv *= override.rcv;
  }

  return { hp, rcv };
}

export function combineLeaderMultipliers(
  a: LeaderStatMultipliers,
  b: LeaderStatMultipliers
): LeaderStatMultipliers {
  return { hp: a.hp * b.hp, rcv: a.rcv * b.rcv };
}

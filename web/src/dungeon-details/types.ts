export type GimmickChip = {
  id: string;
  labelJa: string;
  iconUrl: string;
  category: "required" | "caution";
};

export type DungeonSpawnEffect = {
  raw: string;
  tags: string[];
  gimmickIds: string[];
  damage: string | null;
  turns: string | null;
};

export type DungeonSpawn = {
  monsterId: number | null;
  monsterNameJa: string | null;
  nameEn?: string | null;
  nameJp?: string | null;
  iconUrl: string | null;
  types: string[];
  hp: string | null;
  defense: string | null;
  parts?: Array<{ label: string; hp?: string; defense?: string }>;
  effects: DungeonSpawnEffect[];
};

export type DungeonFloor = {
  floor: string;
  spawnNote: string | null;
  spawns: DungeonSpawn[];
};

/** Hardest hit of the preemptive table (computed at import, see dungeon-details/lib/max-damage.mjs). */
export type DungeonMaxDamage = {
  value: number;
  floor: string | null;
  monsterId: number | null;
  monsterNameJa: string | null;
  raw: string;
};

export type DungeonRecord = {
  appmediaPostId: number;
  titleJa: string;
  titleEn?: string;
  sourceUrl: string;
  modified: string | null;
  importedAt: string;
  maxDamage?: DungeonMaxDamage | null;
  requiredGimmicks: GimmickChip[];
  cautionGimmicks: GimmickChip[];
  floors: DungeonFloor[];
};

export type DungeonSummary = {
  appmediaPostId: number;
  titleJa: string;
  titleEn?: string | null;
  sourceUrl: string;
  modified: string | null;
  importedAt: string;
  /** Null for seeds imported before the field existed. */
  maxDamage?: DungeonMaxDamage | null;
};

export type DungeonListResponse = {
  dungeons: DungeonSummary[];
};

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

export type DungeonRecord = {
  appmediaPostId: number;
  titleJa: string;
  titleEn?: string;
  sourceUrl: string;
  modified: string | null;
  importedAt: string;
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
};

export type DungeonListResponse = {
  dungeons: DungeonSummary[];
};

export type OneTouchAwakeningRef = {
  id: number | null;
  nameJa: string;
  nameEn: string;
};

export type OneTouchFloor = {
  level: number;
  stamina: number | null;
  durationHours: number | null;
  recommendedAwakenings: OneTouchAwakeningRef[];
  rewards: {
    explorationExp: number | null;
    coins: string | null;
    plusPoints: number | null;
  } | null;
  drops: { nameJa: string; nameEn: string }[];
  hiddenConditionJa: string | null;
  hiddenConditionEn: string | null;
  hiddenReward: string;
};

export type OneTouchDungeon = {
  id: string;
  nameJa: string;
  nameEn: string;
  attributeId: number;
  floors: OneTouchFloor[];
};

export type OneTouchAwakeningEffect = OneTouchAwakeningRef & {
  effectJa: string;
  effectEn: string;
};

export type OneTouchCatalog = {
  version: number;
  sourceUrl: string;
  importedAt: string;
  dungeons: OneTouchDungeon[];
  awakeningEffects: OneTouchAwakeningEffect[];
};

export type AwakeningSelectionEntry = {
  id: number;
  nameEn: string;
  count: number;
};

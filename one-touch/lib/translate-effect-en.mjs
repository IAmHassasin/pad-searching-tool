/** Japanese hazard / mechanic names in GameWith One-Touch effect text. */
const HAZARD_EN = {
  落とし穴: "Pitfall",
  爆弾: "Bomb",
  毒沼: "Poison Swamp",
  木の魔窟: "Wood Lair",
  火の魔窟: "Fire Lair",
  水の魔窟: "Water Lair",
  闇の魔窟: "Dark Lair",
  光の魔窟: "Light Lair",
  深淵の巣穴: "Abyss Nest",
  挟み撃ち: "Pincer Attack",
  偽宝箱: "Mimic Chest",
  仕掛け扉: "Trap Door",
  モンスター襲撃: "Monster Ambush",
  巨大モンスター襲撃: "Giant Monster Ambush",
  汚染: "Pollution",
  炎上: "Blaze",
  氷風: "Ice Wind",
  呪い: "Curse",
  落雷: "Lightning",
  灼熱: "Scorching Heat",
  極寒: "Extreme Cold",
  崩落: "Collapse",
  活力の旋律: "Melody of Vitality",
  猛攻の旋律: "Melody of Assault",
  堅守の旋律: "Melody of Defense",
  全能の旋律: "Melody of Omnipotence",
  結界: "Barrier",
  魔法陣: "Magic Circle",
  障壁魔術: "Barrier Magic",
  放電: "Electric Discharge",
  濃霧: "Dense Fog",
  蠢くツタ: "Writhing Vines",
  泥棒ネズミ: "Thief Mouse",
  悪霊: "Evil Spirit",
  重力場: "Gravity Field",
  迷路: "Labyrinth",
  泥沼: "Quagmire",
  時空の歪み: "Space-Time Distortion",
  解呪の鐘: "Curse-Lifting Bell",
  火の祭壇: "Fire Altar",
  水の祭壇: "Water Altar",
  木の祭壇: "Wood Altar",
  光の祭壇: "Light Altar",
  闇の祭壇: "Dark Altar",
  生命の泉: "Fountain of Life",
  虹の祭壇: "Rainbow Altar",
  輝く神域: "Shining Sanctuary",
  騎士の像: "Knight Statue",
  巨兵の像: "Giant Soldier Statue",
};

const TYPE_EN = {
  ドラゴンタイプ: "Dragon",
  神タイプ: "God",
  悪魔タイプ: "Devil",
  マシンタイプ: "Machine",
  バランスタイプ: "Balanced",
  攻撃タイプ: "Attacker",
  体力タイプ: "Physical",
  回復タイプ: "Healer",
  進化用タイプ: "Evo Material",
  能力覚醒用タイプ: "Awakening Material",
  強化合成用タイプ: "Power-up Material",
  売却用タイプ: "Sell Material",
};

/** Exact effectJa → effectEn (GameWith article 550577). */
const EXACT_EFFECT_EN = {
  "探索ランク経験値、モンスター経験値、入手コイン、卵ドロップ率が少し上昇。":
    "Slightly increases exploration rank EXP, monster EXP, coins earned, and egg drop rate.",
  "会心率が1%アップし、一定個数でモンスターが変身":
    "Critical rate +1%; transforms the monster after a set number of triggers.",
  "会心率が2%アップし、一定個数でモンスターが変身":
    "Critical rate +2%; transforms the monster after a set number of triggers.",
  "会心ダメージ倍率が5%アップ": "Critical damage multiplier +5%.",
  "会心ダメージ倍率が10%アップ": "Critical damage multiplier +10%.",
  "チームのHPが5%アップ": "Team HP +5%.",
  "チームの回復力が5%アップ": "Team RCV +5%.",
  "チームの攻撃力、回復力が3%アップ": "Team ATK and RCV +3%.",
  "チームの全パラメータが3%アップ": "All team stats +3%.",
  "火属性の敵からのダメージを5%軽減（軽減合計上限75%まで）":
    "Reduces damage from Fire enemies by 5% (total reduction cap 75%).",
  "水属性の敵からのダメージを5%軽減（軽減合計上限75%まで）":
    "Reduces damage from Water enemies by 5% (total reduction cap 75%).",
  "木属性の敵からのダメージを5%軽減（軽減合計上限75%まで）":
    "Reduces damage from Wood enemies by 5% (total reduction cap 75%).",
  "光属性の敵からのダメージを5%軽減（軽減合計上限75%まで）":
    "Reduces damage from Light enemies by 5% (total reduction cap 75%).",
  "闇属性の敵からのダメージを5%軽減（軽減合計上限75%まで）":
    "Reduces damage from Dark enemies by 5% (total reduction cap 75%).",
  "HP50%以上でチームの攻撃力が7%アップ":
    "Team ATK +7% while HP is 50% or higher.",
  "HP50%以下でチームの攻撃力が7%アップ":
    "Team ATK +7% while HP is 50% or lower.",
  "敵のダメージ軽減を10%分無視して攻撃できる":
    "Attacks ignore 10% of enemy damage reduction.",
  "敵からのダメージを時々5%軽減する（軽減合計上限75%まで）":
    "Sometimes reduces incoming damage by 5% (total reduction cap 75%).",
  "受けているマイナス効果1種類毎にチームの攻撃力が10%アップ":
    "Team ATK +10% for each type of debuff on the team.",
  "受けているマイナス効果1種類毎に会心ダメージ倍率が20%アップ":
    "Critical damage multiplier +20% for each type of debuff on the team.",
  "1WAVE毎にチームの攻撃力、回復力が2%アップ":
    "Team ATK and RCV +2% after each wave.",
  "バトルに勝利するたびにチームの攻撃力が3%アップ":
    "Team ATK +3% after each battle victory.",
  "自分の攻撃力が10%アップ": "This monster's ATK +10%.",
  "自分の攻撃力が20%アップ": "This monster's ATK +20%.",
  "自分の攻撃力が15%アップ": "This monster's ATK +15%.",
  "自分の攻撃力が30%アップ": "This monster's ATK +30%.",
  "自分の攻撃力が40%アップ": "This monster's ATK +40%.",
  "自分の攻撃力が50%アップ": "This monster's ATK +50%.",
  "自分の攻撃力、回復力が50%アップ": "This monster's ATK and RCV +50%.",
};

function hazardName(ja) {
  return HAZARD_EN[ja] ?? ja;
}

function translateQuotedHazardEffect(ja) {
  const damageLarge = ja.match(
    /^「(.+?)」のダメージを軽減する（効果大）$/
  );
  if (damageLarge) {
    return `Reduces damage from "${hazardName(damageLarge[1])}" (enhanced).`;
  }

  const damage = ja.match(/^「(.+?)」のダメージを軽減する$/);
  if (damage) {
    return `Reduces damage from "${hazardName(damage[1])}".`;
  }

  const nullifyLarge = ja.match(/^「(.+?)」を無効化することがある（効果大）$/);
  if (nullifyLarge) {
    return `May nullify "${hazardName(nullifyLarge[1])}" (enhanced).`;
  }

  const nullify = ja.match(/^「(.+?)」を無効化することがある$/);
  if (nullify) {
    return `May nullify "${hazardName(nullify[1])}".`;
  }

  const triggerLarge = ja.match(/^「(.+?)」の発動確率が上昇する（効果大）$/);
  if (triggerLarge) {
    return `Increases trigger rate for "${hazardName(triggerLarge[1])}" (enhanced).`;
  }

  const trigger = ja.match(/^「(.+?)」の発動確率が上昇する$/);
  if (trigger) {
    return `Increases trigger rate for "${hazardName(trigger[1])}".`;
  }

  return null;
}

function translateTypeKiller(ja) {
  const m = ja.match(/^(.+?)へのダメージが20%アップ$/);
  if (!m) return null;
  const typeEn = TYPE_EN[m[1]] ?? m[1];
  return `Damage vs ${typeEn} type +20%.`;
}

/**
 * @param {string} effectJa
 * @returns {string}
 */
export function translateOneTouchEffectEn(effectJa) {
  const ja = effectJa.trim();
  if (!ja) return "";

  if (EXACT_EFFECT_EN[ja]) return EXACT_EFFECT_EN[ja];

  const hazard = translateQuotedHazardEffect(ja);
  if (hazard) return hazard;

  const killer = translateTypeKiller(ja);
  if (killer) return killer;

  return ja;
}

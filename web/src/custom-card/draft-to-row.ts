import type { MonsterRecord } from "../types";
import {
  composeActiveSkillDesc,
  composeActiveSkillName,
  composeActiveSkillStageCooldowns,
  formatAwakeningList,
  type CustomCardDraft,
} from "./types";

export function draftToPreviewRow(draft: CustomCardDraft): MonsterRecord {
  const id =
    draft.number != null && Number.isFinite(draft.number) ? draft.number : 0;
  const superIds =
    draft.prefixedMode === "super" ? draft.superAwakeningIds : [];
  const syncId =
    draft.prefixedMode === "sync" ? draft.syncAwakeningId : null;
  const activeDesc = composeActiveSkillDesc(draft);

  return {
    monster_id: id,
    monster_no_na: id > 0 ? id : null,
    name_en: draft.name.trim() || "Custom",
    rarity: draft.rarity,
    attribute_1_id: draft.attribute1,
    attribute_2_id: draft.attribute2,
    attribute_3_id: draft.attribute3,
    type_1_id: draft.type1,
    type_2_id: draft.type2,
    type_3_id: draft.type3,
    awakenings: formatAwakeningList(draft.awakeningIds) || null,
    super_awakenings:
      superIds.length > 0 ? formatAwakeningList(superIds) : null,
    sync_awsid: syncId,
    active_skill_name_en: composeActiveSkillName(draft) || null,
    active_skill_desc_en: activeDesc || null,
    active_skill_cooldown_min: draft.activeSkillCdMin,
    active_skill_cooldown_max: draft.activeSkillCdMax,
    active_skill_stage_cooldowns: composeActiveSkillStageCooldowns(draft),
    leader_skill_name_en: draft.leaderSkillName.trim() || null,
    leader_skill_desc_en: draft.leaderSkillDesc.trim() || null,
    hp_max: draft.hpMax,
    atk_max: draft.atkMax,
    rcv_max: draft.rcvMax,
  };
}

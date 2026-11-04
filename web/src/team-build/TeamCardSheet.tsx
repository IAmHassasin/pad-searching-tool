import type { CSSProperties } from "react";
import cardBackground from "../assets/pad/background.png";
import { AwakeningIconList } from "../components/AwakeningIconList";
import { SkillBlock } from "../components/MonsterDetailCard";
import { MonsterCardIconGroup } from "../components/MonsterCardIconGroup";
import { MonsterPortrait } from "../components/MonsterPortrait";
import { MonsterTypeStrip } from "../components/MonsterTypeStrip";
import { SuperAwakeningStrip } from "../components/SuperAwakeningStrip";
import { StarRow } from "../components/monster-card-shared";
import { useFitFontSize } from "../hooks/useFitFontSize";
import { useMonsterNameTranslation } from "../hooks/useLiveMonsterNames";
import { parseRegularAwakenings } from "../lib/awakenings";
import {
  formatActiveSkillDesc,
  hasEvoStageCooldowns,
  parseActiveSkillStageCooldowns,
} from "../lib/format-active-skill-desc";
import { parseMonsterTypeIds } from "../lib/monster-types";
import { PAD_AWAKENING, PAD_CARD_VISUAL, PAD_SKILL_FIT } from "../lib/pad-constants";
import { formatActiveSkillCooldown } from "../components/monster-card-shared";
import { computeAssistBonus } from "../lib/team-build/assist-bonus";
import { maxMonsterLevel, scaleStatForLevel } from "../lib/team-build/level-scaling";
import {
  assistResonanceApplies,
  grantedAssistAwakenings,
} from "../lib/team-build/passive-awakenings";
import {
  PLUS_ATK_PER_POINT,
  PLUS_HP_PER_POINT,
  PLUS_RCV_PER_POINT,
} from "../lib/team-build/stat-reference";
import type { MemberStatResult, TeamMemberConfig } from "../lib/team-build/types";
import type { MonsterRecord } from "../types";

type Props = {
  slotLabel: string;
  member: TeamMemberConfig;
  monster: MonsterRecord;
  eq: MonsterRecord | null;
  result: MemberStatResult | undefined;
  /** Click on the assist thumbnail (opens the quick search for the Eq ID). */
  onPickAssist?: () => void;
};

const STAT_COLOR = {
  hp: "text-[#ff8fb3]",
  atk: "text-[#ffd166]",
  rcv: "text-[#8fd3ff]",
} as const;

function CardStatLine({
  label,
  kind,
  value,
  plus,
}: {
  label: string;
  kind: "hp" | "atk" | "rcv";
  value: number;
  plus: number;
}) {
  return (
    <div className="flex items-baseline gap-1.5 leading-none">
      <span className="w-8 text-[11px] font-bold text-[#f0d9b5]">{label}</span>
      <span className={`font-mono text-[15px] font-bold tabular-nums ${STAT_COLOR[kind]}`}>
        {value.toLocaleString()}
      </span>
      {plus > 0 && (
        <span className="font-mono text-[10px] font-bold tabular-nums text-[#9be36d]">(+{plus})</span>
      )}
    </div>
  );
}

function assistStatAtMax(eq: MonsterRecord, kind: "hp" | "atk" | "rcv", plus: number): number {
  const base = kind === "hp" ? eq.hp_max : kind === "atk" ? eq.atk_max : eq.rcv_max;
  if (base == null) return 0;
  const per = kind === "hp" ? PLUS_HP_PER_POINT : kind === "atk" ? PLUS_ATK_PER_POINT : PLUS_RCV_PER_POINT;
  return scaleStatForLevel(base, eq, maxMonsterLevel(eq), kind) + plus * per;
}

/**
 * In-game style card for the selected slot: portrait, awakenings, computed
 * HP / ATK / RCV with +points, level / cost, both active skills (card and
 * assist) and the leader skill. Built from the detail-card leaf components.
 */
export function TeamCardSheet({ slotLabel, member, monster, eq, result, onPickAssist }: Props) {
  const nameFor = useMonsterNameTranslation().nameFor;
  const displayName = nameFor(monster, `#${monster.monster_id}`);
  const regular = parseRegularAwakenings(monster.awakenings);
  const typeIds = parseMonsterTypeIds(monster);
  const sync = Number(monster.sync_awsid);
  const hasSync = Number.isFinite(sync) && sync > 0;
  const shownSuper = member.selectedSuperAwakening != null ? [member.selectedSuperAwakening] : hasSync ? [sync] : [];
  // Awakenings the assist grants to this card (Awoken Assist), shown beside the card's own.
  const granted = grantedAssistAwakenings(eq);
  const levelCap = maxMonsterLevel(monster);

  const rawActive = monster.active_skill_desc_en?.trim() || "";
  const activeDesc = formatActiveSkillDesc(rawActive || "—");
  const stageCooldowns = parseActiveSkillStageCooldowns(monster.active_skill_stage_cooldowns);
  const perStage = hasEvoStageCooldowns(rawActive, stageCooldowns);
  const activeCd = formatActiveSkillCooldown(monster.active_skill_cooldown_min, monster.active_skill_cooldown_max);
  const eqActive = eq ? formatActiveSkillDesc(eq.active_skill_desc_en?.trim() || "—") : null;
  const eqCd = eq ? formatActiveSkillCooldown(eq.active_skill_cooldown_min, eq.active_skill_cooldown_max) : null;
  const leaderDesc = monster.leader_skill_desc_en?.trim() || "—";

  const skillFit = useFitFontSize({
    minPx: PAD_SKILL_FIT.minPx,
    maxPx: PAD_SKILL_FIT.maxPx,
    maxHeightPx: PAD_SKILL_FIT.maxHeightPx + 90,
    resetKey: [monster.monster_id, eq?.monster_id, activeDesc, eqActive, leaderDesc].join("|"),
  });

  const bonus = eq
    ? computeAssistBonus(monster, eq, maxMonsterLevel(eq), member.eqPlusHp, member.eqPlusRcv, member.eqPlusAtk ?? 0)
    : null;
  const resonance = eq ? assistResonanceApplies(monster, eq) : false;

  return (
    <div className="space-y-2">
      <article className="relative mx-auto w-full max-w-[380px] overflow-hidden rounded-xl border-2 border-[#a8842f] bg-black shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
        <header className="relative z-10 border-b border-[#6b4f2a]/80 bg-[#2f2118]/90 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-medium text-[#c9b08a]">
              No.{monster.monster_id} · <span className="text-[#ffe082]">{slotLabel}</span>
            </p>
            <StarRow count={monster.rarity ?? 0} />
          </div>
          <h3 className="wrap-anywhere break-words text-sm font-bold leading-snug text-white" title={displayName}>
            {displayName}
          </h3>
        </header>

        <div className="relative z-10 overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              backgroundImage: `url(${cardBackground})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: `center ${PAD_CARD_VISUAL.bgAnchorY}%`,
              backgroundSize: "cover",
            }}
          />
          <MonsterPortrait
            monsterId={monster.monster_id ?? 0}
            alt={displayName}
            className="pointer-events-none absolute left-1/2 z-[1] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
            style={{ top: `${PAD_CARD_VISUAL.artAnchorY}%`, width: `${PAD_CARD_VISUAL.artWidthPct}%` }}
          />
          <div className="relative z-10 flex" style={{ minHeight: PAD_AWAKENING.artAreaMinHeightPx }}>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1 px-1 pt-1.5">
              {typeIds.length > 0 && (
                <MonsterCardIconGroup variant="type" aria-label={`Types: ${typeIds.join(", ")}`}>
                  <MonsterTypeStrip typeIds={typeIds} bare />
                </MonsterCardIconGroup>
              )}
            </div>
            {(regular.length > 0 || shownSuper.length > 0 || granted.length > 0) && (
              <div className="flex shrink-0 flex-row items-start py-1.5 pr-1" style={{ gap: PAD_AWAKENING.iconGapPx }}>
                {(shownSuper.length > 0 || granted.length > 0) && (
                  /* Original card layout (super strip left, card column right) with the
                     assist-granted awakenings stacked under the super strip, beside the card column. */
                  <div className="flex flex-col items-end" style={{ gap: PAD_AWAKENING.iconGapPx }}>
                    {shownSuper.length > 0 && (
                      <MonsterCardIconGroup variant="super" aria-label={hasSync ? "Sync awakening" : "Super awakening"}>
                        <SuperAwakeningStrip
                          ids={shownSuper}
                          bare
                          prefixTitle={hasSync ? "Sync awakening" : "Super awakening"}
                          iconTitle={(id) => `#${id}`}
                        />
                      </MonsterCardIconGroup>
                    )}
                    {granted.length > 0 && (
                      <MonsterCardIconGroup
                        variant="regular"
                        layout="column"
                        style={{
                          width: PAD_AWAKENING.columnWidthPx,
                          "--pst-awk-group-border": "#10b981",
                          "--pst-awk-group-bg": "#07281f",
                        } as CSSProperties}
                        aria-label="Awakenings from assist (Awoken Assist)"
                      >
                        <AwakeningIconList
                          ids={granted}
                          layout="column"
                          bare
                          getLabel={(id) => `#${id} from assist`}
                        />
                      </MonsterCardIconGroup>
                    )}
                  </div>
                )}
                {regular.length > 0 && (
                  <MonsterCardIconGroup variant="regular" layout="column" style={{ width: PAD_AWAKENING.columnWidthPx }} aria-label="Awakenings">
                    <AwakeningIconList ids={regular} layout="column" bare />
                  </MonsterCardIconGroup>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 mx-2 -mt-1 rounded-md border border-[#8b6914]/80 bg-[#241a12]/95 px-2 py-2 shadow-inner">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPickAssist}
              title={eq ? `Assist #${eq.monster_id} — click to change` : "Click to pick an assist"}
              className="pressable relative h-14 w-14 shrink-0 overflow-hidden rounded border border-[#8b6914]/60 bg-black/50"
            >
              {eq ? (
                <MonsterPortrait monsterId={eq.monster_id ?? 0} alt="" variant="icon" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[9px] text-[#c9b08a]">
                  + Assist
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/70 text-center text-[8px] font-bold text-[#f0d9b5]">
                Assist
              </span>
            </button>
            <div className="min-w-0 flex-1 space-y-1">
              <CardStatLine label="HP" kind="hp" value={result?.hp.afterDungeon ?? 0} plus={member.plusHp} />
              <CardStatLine label="ATK" kind="atk" value={result?.atk.afterDungeon ?? 0} plus={member.plusAtk} />
              <CardStatLine label="RCV" kind="rcv" value={result?.rcv.afterDungeon ?? 0} plus={member.plusRcv} />
            </div>
            <div className="shrink-0 space-y-1 text-right">
              <p className="font-mono text-[11px] font-bold leading-none text-[#9be36d]">
                Lv.{member.level}
                <span className="block text-[9px] font-semibold text-[#c9b08a]">Max Lv.{levelCap}</span>
              </p>
              <p className="rounded border border-[#3d2e1f] bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white">
                Cost {monster.cost ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <div ref={skillFit.ref} className="relative z-10 px-2 pb-3 pt-1" style={{ fontSize: skillFit.fontPx }}>
          <SkillBlock
            kind="active"
            title={monster.active_skill_name_en?.trim() || "—"}
            body={activeDesc}
            cooldown={activeCd}
            stageCooldowns={perStage ? stageCooldowns : null}
            vanishGrantedAwokenIds={monster.vanish_granted_awoken_ids}
            voidSuperGravityTurns={monster.void_super_gravity_turns}
          />
          {eq && eqActive && (
            <SkillBlock
              kind="assist"
              title={eq.active_skill_name_en?.trim() || nameFor(eq, `#${eq.monster_id}`)}
              body={eqActive}
              cooldown={eqCd}
              vanishGrantedAwokenIds={eq.vanish_granted_awoken_ids}
              voidSuperGravityTurns={eq.void_super_gravity_turns}
            />
          )}
          <SkillBlock
            kind="leader"
            title={monster.leader_skill_name_en?.trim() || "—"}
            body={leaderDesc}
          />
        </div>
      </article>

      {eq && (
        <div className="mx-auto w-full max-w-[380px] rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-2">
          <div className="flex items-center gap-2">
            <MonsterPortrait monsterId={eq.monster_id ?? 0} alt="" variant="icon" className="h-9 w-9 shrink-0 rounded border border-emerald-500/40 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-emerald-200">
                Assist · {nameFor(eq, `#${eq.monster_id}`)}
              </p>
              <p className="font-mono text-[9px] text-[var(--color-muted)]">
                #{eq.monster_id} · Lv.{maxMonsterLevel(eq)} · +{member.eqPlusHp + member.eqPlusRcv + (member.eqPlusAtk ?? 0)}
                {resonance ? " · resonance ✓" : ""}
              </p>
            </div>
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-1 text-center">
            {(["hp", "atk", "rcv"] as const).map((k) => {
              const plus = k === "hp" ? member.eqPlusHp : k === "atk" ? member.eqPlusAtk ?? 0 : member.eqPlusRcv;
              return (
                <div key={k} className="rounded-lg bg-black/30 px-1 py-1">
                  <div className="ds-label text-[8px]">{k.toUpperCase()}</div>
                  <div className="font-mono text-[11px] font-bold tabular-nums text-[var(--color-fg-strong)]">
                    {assistStatAtMax(eq, k, plus).toLocaleString()}
                  </div>
                  <div className="font-mono text-[9px] tabular-nums text-emerald-300">
                    {bonus && bonus[k] > 0 ? `+${bonus[k].toLocaleString()} to card` : "no bonus"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

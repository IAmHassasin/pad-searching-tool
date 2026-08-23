import { useState, type ReactNode } from "react";
import { useTruncatedTitle } from "../hooks/useTruncatedTitle";
import { monsterRowId } from "../lib/filters";
import {
  parseRegularAwakenings,
  resolvePrefixedAwakeningIds,
  resolveSuperAwakeningIds,
} from "../lib/awakenings";
import {
  formatActiveSkillDesc,
  hasEvoStageCooldowns,
  parseActiveSkillStageCooldowns,
} from "../lib/format-active-skill-desc";
import { parseMonsterAttributeIds } from "../lib/monster-attributes";
import { PAD_AWAKENING } from "../lib/pad-constants";
import {
  isAllSectionsEnabled,
  type ResultDisplaySections,
} from "../lib/result-display";
import type { MonsterRecord } from "../types";
import { AwakeningIconList } from "./AwakeningIconList";
import { ActiveSkillVanishAddLine } from "./ActiveSkillVanishAddLine";
import { ActiveSkillVoidSuperGravityLine } from "./ActiveSkillVoidSuperGravityLine";
import { ActiveSkillDescText } from "./ActiveSkillDescText";
import { LeaderSkillDescText } from "./LeaderSkillDescText";
import { MonsterAttributeStrip } from "./MonsterAttributeStrip";
import { formatActiveSkillCooldown, StatRow } from "./monster-card-shared";
import { MonsterAttributeSpriteIcon } from "./MonsterAttributeSpriteIcon";
import { MonsterCardIconGroup } from "./MonsterCardIconGroup";
import { MonsterPortrait } from "./MonsterPortrait";
import { SuperAwakeningStrip } from "./SuperAwakeningStrip";

type Props = {
  row: MonsterRecord;
  id?: string;
  variant?: "popover" | "inline";
  sections?: ResultDisplaySections;
};

const INLINE_AWK_SIZE = 14;

function MonsterIconPreview({
  row,
  monsterId,
}: {
  row: MonsterRecord;
  monsterId: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const primaryAttr = parseMonsterAttributeIds(row)[0] ?? 6;

  return (
    <div className="relative h-14 w-14 shrink-0">
      <div
        className={`absolute inset-0 flex items-center justify-center rounded border border-[#6b8f3c]/60 bg-[#2a3d18]/90 transition-opacity ${loaded ? "opacity-0" : "opacity-100"}`}
        aria-hidden={loaded}
      >
        <MonsterAttributeSpriteIcon attributeId={primaryAttr} size={36} />
      </div>
      <MonsterPortrait
        monsterId={monsterId}
        alt=""
        variant="icon"
        className={`h-14 w-14 rounded border border-[#8b6914]/60 object-cover transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

function SkillSnippet({
  kind,
  title,
  body,
  cooldown,
  vanishGrantedAwokenIds,
  voidSuperGravityTurns,
  stageCooldowns,
  inline = false,
}: {
  kind: "active" | "leader";
  title: string;
  body: string;
  cooldown?: string | null;
  vanishGrantedAwokenIds?: number[] | null;
  voidSuperGravityTurns?: number | null;
  stageCooldowns?: number[] | null;
  inline?: boolean;
}) {
  const badgeClass =
    kind === "active"
      ? "bg-[#3d6aa8] text-[#9ec5ff]"
      : "bg-[#a85c1a] text-[#f5d4a8]";

  return (
    <div
      className={`rounded border border-[#8b6914]/50 bg-[#2a1f14]/90 ${
        inline ? "px-1.5 py-1" : "mt-1.5 px-2 py-1.5"
      }`}
    >
      <div className={`flex items-start justify-between gap-1 ${inline ? "" : "mb-0.5"}`}>
        <span
          className={`shrink-0 rounded px-1 py-px font-bold uppercase ${badgeClass} ${
            inline ? "text-[8px]" : "text-[9px]"
          }`}
        >
          {kind === "active" ? "AS" : "LS"}
        </span>
        <p
          className={`min-w-0 flex-1 break-words font-bold text-[#f5e6c8] ${
            inline ? "text-[9px]" : "text-[10px]"
          }`}
        >
          {title}
        </p>
        {kind === "active" && cooldown && (
          <span
            className={`shrink-0 font-bold tabular-nums text-[#9ec5ff] ${
              inline ? "text-[8px]" : "text-[9px]"
            }`}
          >
            CD {cooldown}
          </span>
        )}
      </div>
      {kind === "active" && voidSuperGravityTurns != null ? (
        <ActiveSkillVoidSuperGravityLine
          turns={voidSuperGravityTurns}
          compact={inline}
        />
      ) : null}
      {kind === "active" ? (
        <ActiveSkillDescText
          text={body}
          stageCooldowns={stageCooldowns}
          compact={inline}
          className={`text-[#e8dcc8] ${
            inline ? "text-[8px] leading-tight" : "text-[9px] leading-snug"
          }`}
        />
      ) : (
        <LeaderSkillDescText
          text={body}
          className={`text-[#e8dcc8] ${
            inline ? "text-[8px] leading-tight" : "text-[9px] leading-snug"
          }`}
        />
      )}
      {kind === "active" && vanishGrantedAwokenIds?.length ? (
        <ActiveSkillVanishAddLine
          ids={vanishGrantedAwokenIds}
          iconSize={inline ? 12 : 14}
        />
      ) : null}
    </div>
  );
}

function AwakeningRow({
  label,
  children,
  inline = false,
}: {
  label: string;
  children: ReactNode;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div className="min-w-0 overflow-x-auto">
        <div
          className="flex w-max flex-row items-center rounded border border-[#6b8f3c]/80 bg-[#2a3d18]/90 p-0.5"
          style={{ gap: PAD_AWAKENING.iconGapPx }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 min-w-0">
      <p className="mb-0.5 text-[8px] font-semibold uppercase tracking-wide text-[#8b9a6b]">
        {label}
      </p>
      <div className="overflow-x-auto">
        <div className="flex w-max min-w-full flex-row items-center">
          {children}
        </div>
      </div>
    </div>
  );
}

export function MonsterQuickPreview({
  row,
  id,
  variant = "popover",
  sections,
}: Props) {
  const monsterId = monsterRowId(row);
  const nameTitle = useTruncatedTitle<HTMLHeadingElement>(
    row.name_en ?? "Unknown"
  );
  const attributeIds = parseMonsterAttributeIds(row);
  const regular = parseRegularAwakenings(row.awakenings);
  const hasSuperAwks =
    resolveSuperAwakeningIds(row.awakenings, row.super_awakenings).length > 0;
  const prefixedAwkIds = resolvePrefixedAwakeningIds(
    row.awakenings,
    row.super_awakenings,
    row.sync_awsid
  );
  const superLabel = hasSuperAwks ? "Super awakening" : "Sync awakening";
  const hasSuper = prefixedAwkIds.length > 0;
  const hasRegular = regular.length > 0;

  const rawActiveDesc = row.active_skill_desc_en?.trim() || "";
  const activeDesc = formatActiveSkillDesc(rawActiveDesc || "—");
  const leaderDesc = row.leader_skill_desc_en?.trim() || "—";
  const stageCooldowns = parseActiveSkillStageCooldowns(
    row.active_skill_stage_cooldowns
  );
  const perStageCd = hasEvoStageCooldowns(rawActiveDesc, stageCooldowns);
  const activeCooldown = perStageCd
    ? null
    : formatActiveSkillCooldown(
        row.active_skill_cooldown_min,
        row.active_skill_cooldown_max
      );

  const inline = variant === "inline";
  const showAll = sections ? isAllSectionsEnabled(sections) : true;
  const showAwk = sections?.awk ?? true;
  const showActive = sections?.activeSkill ?? true;
  const showLeader = sections?.leaderSkill ?? true;
  const showBase = !sections || showAll;
  const awkSize = inline ? INLINE_AWK_SIZE : 16;

  const awkBlock =
    showAwk && (hasSuper || hasRegular) ? (
      inline ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          {hasSuper && (
            <AwakeningRow label={superLabel} inline>
              <SuperAwakeningStrip
                ids={prefixedAwkIds}
                size={awkSize}
                bare
                prefixTitle={superLabel}
                iconTitle={(awkId) => `${superLabel} #${awkId}`}
              />
            </AwakeningRow>
          )}
          {hasRegular && (
            <AwakeningRow label="Awakenings" inline>
              <AwakeningIconList ids={regular} size={awkSize} layout="row" bare />
            </AwakeningRow>
          )}
        </div>
      ) : (
        <>
          {hasSuper && (
            <AwakeningRow label={superLabel}>
              <MonsterCardIconGroup variant="super" aria-label={superLabel}>
                <SuperAwakeningStrip
                  ids={prefixedAwkIds}
                  size={awkSize}
                  bare
                  prefixTitle={superLabel}
                  iconTitle={(awkId) => `${superLabel} #${awkId}`}
                />
              </MonsterCardIconGroup>
            </AwakeningRow>
          )}
          {hasRegular && (
            <AwakeningRow label="Awakenings">
              <MonsterCardIconGroup variant="regular" aria-label="Awakenings">
                <div
                  className="flex flex-row flex-nowrap items-center"
                  style={{ gap: PAD_AWAKENING.iconGapPx }}
                >
                  <AwakeningIconList ids={regular} size={awkSize} bare />
                </div>
              </MonsterCardIconGroup>
            </AwakeningRow>
          )}
        </>
      )
    ) : null;

  if (inline && !showBase) {
    return (
      <div id={id} className="flex min-w-0 flex-col gap-0.5">
        {awkBlock}
        {showActive && (
          <SkillSnippet
            kind="active"
            title={row.active_skill_name_en?.trim() || "—"}
            body={activeDesc}
            cooldown={activeCooldown}
            stageCooldowns={perStageCd ? stageCooldowns : null}
            vanishGrantedAwokenIds={row.vanish_granted_awoken_ids}
            voidSuperGravityTurns={row.void_super_gravity_turns}
            inline
          />
        )}
        {showLeader && (
          <SkillSnippet
            kind="leader"
            title={row.leader_skill_name_en?.trim() || "—"}
            body={leaderDesc}
            inline
          />
        )}
      </div>
    );
  }

  return (
    <article
      id={id}
      className={
        inline
          ? "w-full rounded border border-[#8b6914]/50 bg-[#1a1410]/80 p-1.5"
          : "w-[360px] rounded-lg border border-[#8b6914]/80 bg-[#1a1410] p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
      }
    >
      <div className={`flex ${inline ? "gap-1.5" : "gap-2.5"}`}>
        {showBase && (
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <MonsterIconPreview row={row} monsterId={monsterId} />
            <div className="w-full space-y-0.5 rounded border border-[#8b6914]/40 bg-[#241a12]/80 px-1.5 py-1">
              <StatRow label="HP" value={row.hp_max} compact />
              <StatRow label="ATK" value={row.atk_max} compact />
              <StatRow label="RCV" value={row.rcv_max} compact />
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1">
          {showBase && (
            <>
              <p className="text-[9px] font-medium text-[#c9b08a]">
                No.{monsterId}
                {row.monster_no_na != null && (
                  <span className="ml-1.5 text-[#9ec5ff]">
                    NA#{row.monster_no_na}
                  </span>
                )}
              </p>
              <h3
                ref={nameTitle.ref}
                title={nameTitle.title}
                className={`truncate font-bold text-white ${inline ? "text-[10px]" : "text-xs"}`}
              >
                {row.name_en ?? "Unknown"}
              </h3>
              {attributeIds.length > 0 && (
                <div className="mt-1">
                  <MonsterAttributeStrip
                    attributeIds={attributeIds}
                    size={inline ? 14 : 16}
                    bare
                  />
                </div>
              )}
            </>
          )}

          {awkBlock}

          {showActive && (
            <SkillSnippet
              kind="active"
              title={row.active_skill_name_en?.trim() || "—"}
              body={activeDesc}
              cooldown={activeCooldown}
              stageCooldowns={perStageCd ? stageCooldowns : null}
              vanishGrantedAwokenIds={row.vanish_granted_awoken_ids}
              voidSuperGravityTurns={row.void_super_gravity_turns}
              inline={inline}
            />
          )}
          {showLeader && (
            <SkillSnippet
              kind="leader"
              title={row.leader_skill_name_en?.trim() || "—"}
              body={leaderDesc}
              inline={inline}
            />
          )}
        </div>
      </div>
    </article>
  );
}

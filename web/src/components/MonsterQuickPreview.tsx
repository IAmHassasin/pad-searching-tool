import { useState, type ReactNode } from "react";
import { monsterRowId } from "../lib/filters";
import {
  parseRegularAwakenings,
  resolvePrefixedAwakeningIds,
  resolveSuperAwakeningIds,
} from "../lib/awakenings";
import { formatActiveSkillDesc } from "../lib/format-active-skill-desc";
import { parseMonsterAttributeIds } from "../lib/monster-attributes";
import { PAD_AWAKENING } from "../lib/pad-constants";
import type { MonsterRecord } from "../types";
import { AwakeningIconList } from "./AwakeningIconList";
import { ActiveSkillVanishAddLine } from "./ActiveSkillVanishAddLine";
import { ActiveSkillDescText } from "./ActiveSkillDescText";
import { MonsterAttributeStrip } from "./MonsterAttributeStrip";
import { formatActiveSkillCooldown, StatRow } from "./monster-card-shared";
import { MonsterAttributeSpriteIcon } from "./MonsterAttributeSpriteIcon";
import { MonsterCardIconGroup } from "./MonsterCardIconGroup";
import { MonsterPortrait } from "./MonsterPortrait";
import { SuperAwakeningStrip } from "./SuperAwakeningStrip";

type Props = {
  row: MonsterRecord;
  id?: string;
};

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
}: {
  kind: "active" | "leader";
  title: string;
  body: string;
  cooldown?: string | null;
  vanishGrantedAwokenIds?: number[] | null;
}) {
  const badgeClass =
    kind === "active"
      ? "bg-[#3d6aa8] text-[#9ec5ff]"
      : "bg-[#a85c1a] text-[#f5d4a8]";

  return (
    <div className="mt-1.5 rounded border border-[#8b6914]/50 bg-[#2a1f14]/90 px-2 py-1.5">
      <div className="mb-0.5 flex items-start justify-between gap-1">
        <span
          className={`shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase ${badgeClass}`}
        >
          {kind === "active" ? "AS" : "LS"}
        </span>
        <p className="min-w-0 flex-1 truncate text-[10px] font-bold text-[#f5e6c8]">
          {title}
        </p>
        {kind === "active" && cooldown && (
          <span className="shrink-0 text-[9px] font-bold tabular-nums text-[#9ec5ff]">
            CD {cooldown}
          </span>
        )}
      </div>
      {kind === "active" ? (
        <ActiveSkillDescText
          text={body}
          className="line-clamp-2 text-[9px] leading-snug text-[#e8dcc8]"
        />
      ) : (
        <p className="line-clamp-2 text-[9px] leading-snug text-[#e8dcc8]">{body}</p>
      )}
      {kind === "active" && vanishGrantedAwokenIds?.length ? (
        <ActiveSkillVanishAddLine ids={vanishGrantedAwokenIds} iconSize={14} />
      ) : null}
    </div>
  );
}

function AwakeningRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
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

export function MonsterQuickPreview({ row, id }: Props) {
  const monsterId = monsterRowId(row);
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

  const activeDesc = formatActiveSkillDesc(row.active_skill_desc_en?.trim() || "—");
  const leaderDesc = row.leader_skill_desc_en?.trim() || "—";
  const activeCooldown = formatActiveSkillCooldown(
    row.active_skill_cooldown_min,
    row.active_skill_cooldown_max
  );

  return (
    <article
      id={id}
      className="w-[360px] rounded-lg border border-[#8b6914]/80 bg-[#1a1410] p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
    >
      <div className="flex gap-2.5">
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <MonsterIconPreview row={row} monsterId={monsterId} />
          <div className="w-full space-y-0.5 rounded border border-[#8b6914]/40 bg-[#241a12]/80 px-1.5 py-1">
            <StatRow label="HP" value={row.hp_max} compact />
            <StatRow label="ATK" value={row.atk_max} compact />
            <StatRow label="RCV" value={row.rcv_max} compact />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-medium text-[#c9b08a]">
            No.{monsterId}
            {row.monster_no_na != null && (
              <span className="ml-1.5 text-[#9ec5ff]">
                NA#{row.monster_no_na}
              </span>
            )}
          </p>
          <h3 className="truncate text-xs font-bold text-white">
            {row.name_en ?? "Unknown"}
          </h3>
          {attributeIds.length > 0 && (
            <div className="mt-1">
              <MonsterAttributeStrip
                attributeIds={attributeIds}
                size={16}
                bare
              />
            </div>
          )}

          {hasSuper && (
            <AwakeningRow label={superLabel}>
              <MonsterCardIconGroup variant="super" aria-label={superLabel}>
                <SuperAwakeningStrip
                  ids={prefixedAwkIds}
                  size={16}
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
                  <AwakeningIconList ids={regular} size={16} bare />
                </div>
              </MonsterCardIconGroup>
            </AwakeningRow>
          )}

          <SkillSnippet
            kind="active"
            title={row.active_skill_name_en?.trim() || "—"}
            body={activeDesc}
            cooldown={activeCooldown}
            vanishGrantedAwokenIds={row.vanish_granted_awoken_ids}
          />
          <SkillSnippet
            kind="leader"
            title={row.leader_skill_name_en?.trim() || "—"}
            body={leaderDesc}
          />
        </div>
      </div>
    </article>
  );
}

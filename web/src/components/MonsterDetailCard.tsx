import cardBackground from "../assets/pad/background.png";
import { monsterRowId } from "../lib/filters";
import {
  parseRegularAwakenings,
  resolvePrefixedAwakeningIds,
  resolveSuperAwakeningIds,
} from "../lib/awakenings";
import { parseMonsterTypeIds } from "../lib/monster-types";
import { PAD_AWAKENING, PAD_CARD_VISUAL } from "../lib/pad-constants";
import type { MonsterRecord } from "../types";
import { AwakeningIconList } from "./AwakeningIconList";
import { ActiveSkillVanishAddLine } from "./ActiveSkillVanishAddLine";
import {
  formatActiveSkillCooldown,
  StarRow,
  StatRow,
} from "./monster-card-shared";
import { MonsterCardIconGroup } from "./MonsterCardIconGroup";
import { MonsterPortrait } from "./MonsterPortrait";
import { MonsterTypeStrip } from "./MonsterTypeStrip";
import { SuperAwakeningStrip } from "./SuperAwakeningStrip";

type Props = {
  row: MonsterRecord;
  evoActive?: boolean;
  collabActive?: boolean;
  onOpenEvo?: () => void;
  onOpenCollab?: () => void;
};

function RelationToggleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.25 }}
      className={`rounded border px-1.5 py-0.5 shadow-md transition-colors ${
        active
          ? "border-[#ffd54f] bg-[#5c4a12] text-[#ffe082]"
          : "border-[#6b4f2a]/90 bg-[#2f2118]/95 text-[#e8dcc8] hover:border-[#c9a84a] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function SkillBlock({
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
  const badge =
    kind === "active"
      ? "bg-[linear-gradient(180deg,#5b8fd4_0%,#3d6aa8_100%)]"
      : "bg-[linear-gradient(180deg,#d4843a_0%,#a85c1a_100%)]";

  return (
    <section className="relative mt-2 rounded-md border border-[#8b6914]/70 bg-[#2a1f14]/90 px-2.5 pb-2.5 pt-4">
      <span
        className={`absolute -top-2.5 left-2 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md ${badge}`}
      >
        {kind === "active" ? "Skill" : "Leader Skill"}
      </span>
      <div className="mb-1 flex items-start justify-between gap-2">
        <h4 className="min-w-0 text-[11px] font-bold text-[#f5e6c8]">{title}</h4>
        {kind === "active" && cooldown && (
          <span
            className="shrink-0 rounded border border-[#5b8fd4]/40 bg-[#1a2a3f]/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#9ec5ff]"
            title="Active skill cooldown (turns at max level)"
          >
            CD {cooldown}
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap text-[10px] leading-relaxed text-[#e8dcc8]">
        {body}
      </p>
      {kind === "active" && vanishGrantedAwokenIds?.length ? (
        <ActiveSkillVanishAddLine ids={vanishGrantedAwokenIds} iconSize={18} />
      ) : null}
    </section>
  );
}

export function MonsterDetailCard({
  row,
  evoActive = false,
  collabActive = false,
  onOpenEvo,
  onOpenCollab,
}: Props) {
  const id = monsterRowId(row);
  const regular = parseRegularAwakenings(row.awakenings);
  const hasSuperAwks =
    resolveSuperAwakeningIds(row.awakenings, row.super_awakenings).length > 0;
  const prefixedAwkIds = resolvePrefixedAwakeningIds(
    row.awakenings,
    row.super_awakenings,
    row.sync_awsid
  );
  const monsterTypeIds = parseMonsterTypeIds(row);
  const hasTypes = monsterTypeIds.length > 0;
  const hasSuper = prefixedAwkIds.length > 0;
  const hasRegular = regular.length > 0;
  const superLabel = hasSuperAwks ? "Super awakening" : "Sync awakening";

  const activeDesc = row.active_skill_desc_en?.trim() || "—";
  const leaderDesc = row.leader_skill_desc_en?.trim() || "—";
  const activeCooldown = formatActiveSkillCooldown(
    row.active_skill_cooldown_min,
    row.active_skill_cooldown_max
  );

  return (
    <article className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-xl border-2 border-[#a8842f] bg-black shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${cardBackground})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: `center ${PAD_CARD_VISUAL.bgAnchorY}%`,
          backgroundSize: "contain",
        }}
      />
      <MonsterPortrait
        monsterId={id}
        alt={row.name_en ?? "Monster artwork"}
        className="pointer-events-none absolute left-1/2 z-[1] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
        style={{
          top: `${PAD_CARD_VISUAL.artAnchorY}%`,
          width: `${PAD_CARD_VISUAL.artWidthPct}%`,
        }}
      />
      <header className="relative z-10 border-b border-[#6b4f2a]/80 bg-[#2f2118]/90 px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-[#c9b08a]">No.{id}</p>
            <h3 className="truncate text-sm font-bold text-white">
              {row.name_en ?? "Unknown"}
            </h3>
          </div>
          <StarRow count={row.rarity ?? 0} />
        </div>
      </header>

      <div className="relative z-10">
        <div
          className="relative flex"
          style={{ minHeight: PAD_AWAKENING.artAreaMinHeightPx }}
        >
          <div className="flex min-w-0 flex-1 items-start px-1 pt-1.5">
            {hasTypes && (
              <MonsterCardIconGroup
                variant="type"
                aria-label={`Types: ${monsterTypeIds.join(", ")}`}
              >
                <MonsterTypeStrip typeIds={monsterTypeIds} bare />
              </MonsterCardIconGroup>
            )}
          </div>
          {(hasSuper || hasRegular) && (
            <div
              className="flex shrink-0 flex-row items-start py-1.5 pr-1"
              style={{ gap: PAD_AWAKENING.iconGapPx }}
            >
              {hasSuper && (
                <MonsterCardIconGroup variant="super" aria-label={superLabel}>
                  <SuperAwakeningStrip
                    ids={prefixedAwkIds}
                    bare
                    prefixTitle={superLabel}
                    iconTitle={(id) => `${superLabel} #${id}`}
                  />
                </MonsterCardIconGroup>
              )}
              {hasRegular && (
                <MonsterCardIconGroup
                  variant="regular"
                  layout="column"
                  style={{ width: PAD_AWAKENING.columnWidthPx }}
                  aria-label="Awakenings"
                >
                  <AwakeningIconList ids={regular} layout="column" bare />
                </MonsterCardIconGroup>
              )}
            </div>
          )}
          {(onOpenEvo || onOpenCollab) && (
            <div
              className="absolute bottom-1.5 left-1 z-20 flex items-center gap-1"
              style={{
                right: hasRegular
                  ? PAD_AWAKENING.columnWidthPx +
                    (hasSuper ? PAD_AWAKENING.columnWidthPx + PAD_AWAKENING.iconGapPx : 0) +
                    12
                  : undefined,
              }}
            >
              {onOpenEvo && (
                <RelationToggleButton
                  label="Evolution"
                  active={evoActive}
                  onClick={onOpenEvo}
                />
              )}
              {onOpenCollab && (
                <RelationToggleButton
                  label="Group"
                  active={collabActive}
                  onClick={onOpenCollab}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 mx-2 -mt-1 rounded-md border border-[#8b6914]/80 bg-[#241a12]/95 px-2 py-2 shadow-inner">
        <div className="flex items-center gap-2">
          <MonsterPortrait
            monsterId={id}
            alt=""
            variant="icon"
            className="h-11 w-11 shrink-0 rounded border border-[#8b6914]/60 object-cover"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <StatRow label="HP" value={row.hp_max} />
            <StatRow label="ATK" value={row.atk_max} />
            <StatRow label="RCV" value={row.rcv_max} />
          </div>
          {row.monster_no_na != null && (
            <div className="shrink-0 rounded border border-[#3d2e1f] bg-black/50 px-1.5 py-1 text-center">
              <p className="text-[9px] text-[#c9b08a]">NA#</p>
              <p className="text-[11px] font-bold tabular-nums text-white">
                {row.monster_no_na}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 space-y-0 px-2 pb-3 pt-1">
        <SkillBlock
          kind="active"
          title={row.active_skill_name_en?.trim() || "—"}
          body={activeDesc}
          cooldown={activeCooldown}
          vanishGrantedAwokenIds={row.vanish_granted_awoken_ids}
        />
        <SkillBlock
          kind="leader"
          title={row.leader_skill_name_en?.trim() || "—"}
          body={leaderDesc}
        />
      </div>
    </article>
  );
}

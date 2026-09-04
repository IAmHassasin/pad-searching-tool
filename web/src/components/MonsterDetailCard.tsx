import type { CSSProperties, ReactNode } from "react";
import cardBackground from "../assets/pad/background.png";
import { monsterRowId } from "../lib/filters";
import {
  ASSIST_RESONANCE_AWAKENING_ID,
  monsterHasAwakening,
  parseRegularAwakenings,
  resolvePrefixedAwakeningIds,
  resolveSuperAwakeningIds,
} from "../lib/awakenings";
import {
  buildAssistResonanceSearchUrl,
  buildMonsterGoogleSearchUrl,
} from "../lib/monster-search-url";
import {
  formatActiveSkillDesc,
  hasEvoStageCooldowns,
  parseActiveSkillStageCooldowns,
  parseChangeToMonsterIds,
} from "../lib/format-active-skill-desc";
import { parseMonsterTypeIds } from "../lib/monster-types";
import { PAD_AWAKENING, PAD_CARD_VISUAL } from "../lib/pad-constants";
import type { MonsterRecord } from "../types";
import { AwakeningIconList } from "./AwakeningIconList";
import { ActiveSkillVanishAddLine } from "./ActiveSkillVanishAddLine";
import { ActiveSkillVoidSuperGravityLine } from "./ActiveSkillVoidSuperGravityLine";
import { ActiveSkillDescText } from "./ActiveSkillDescText";
import { LeaderSkillDescText } from "./LeaderSkillDescText";
import {
  formatActiveSkillCooldown,
  StarRow,
  StatRow,
} from "./monster-card-shared";
import { parseMonsterAttributeIds } from "../lib/monster-attributes";
import { MonsterAttributeStrip } from "./MonsterAttributeStrip";
import { FramedMonsterIcon } from "./FramedMonsterIcon";
import { MonsterCardIconGroup } from "./MonsterCardIconGroup";
import { MonsterChangeTargetStrip } from "./MonsterChangeTargetStrip";
import { MonsterPortrait } from "./MonsterPortrait";
import { MonsterTypeStrip } from "./MonsterTypeStrip";
import { SuperAwakeningStrip } from "./SuperAwakeningStrip";
import { useTruncatedTitle } from "../hooks/useTruncatedTitle";

const COMPACT_AWAKENING_ICON_SIZE = 16;

type Props = {
  row: MonsterRecord;
  evoActive?: boolean;
  collabActive?: boolean;
  onOpenEvo?: () => void;
  onOpenCollab?: () => void;
  changeTargetIds?: number[];
  onSelectChangeTarget?: (monsterId: number) => void;
  changeTargetLoadingId?: number | null;
  /** Mobile sidebar: hide hero art, tighter layout. */
  compact?: boolean;
  /** Override full art URL (blob / data). */
  artSrc?: string | null;
  /** Override icon URL (blob / data). */
  iconSrc?: string | null;
  /** Show attribute strip (used by custom card preview). */
  showAttributes?: boolean;
  /** Render attribute frames on the stats/header icon (PAD corners). */
  framedIcon?: boolean;
  /** Hide Google / Assist Resonance links (export / custom card). */
  hideUtilityLinks?: boolean;
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

function LinkPillButton({
  href,
  title,
  className = "",
  style,
  children,
}: {
  href: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.25, ...style }}
      className={`rounded border border-[#6b4f2a]/90 bg-[#2f2118]/95 px-1.5 py-0.5 text-[#e8dcc8] shadow-md transition-colors hover:border-[#c9a84a] hover:text-white ${className}`}
    >
      {children}
    </a>
  );
}

function SkillBlock({
  kind,
  title,
  body,
  cooldown,
  vanishGrantedAwokenIds,
  voidSuperGravityTurns,
  stageCooldowns,
  compact = false,
}: {
  kind: "active" | "leader";
  title: string;
  body: string;
  cooldown?: string | null;
  vanishGrantedAwokenIds?: number[] | null;
  voidSuperGravityTurns?: number | null;
  stageCooldowns?: number[] | null;
  compact?: boolean;
}) {
  const badge =
    kind === "active"
      ? "bg-[linear-gradient(180deg,#5b8fd4_0%,#3d6aa8_100%)]"
      : "bg-[linear-gradient(180deg,#d4843a_0%,#a85c1a_100%)]";

  return (
    <section
      className={`relative rounded-md border border-[#8b6914]/70 bg-[#2a1f14]/90 ${
        compact ? "mt-1 px-2 pb-1.5 pt-3" : "mt-2 px-2.5 pb-2.5 pt-4"
      }`}
    >
      <span
        className={`absolute left-2 rounded px-1.5 py-px font-bold uppercase tracking-wide text-white shadow-md ${badge} ${
          compact
            ? "-top-2 text-[8px]"
            : "-top-2.5 px-2 py-0.5 text-[10px]"
        }`}
      >
        {kind === "active" ? "Skill" : "Leader Skill"}
      </span>
      <div className={`flex items-start justify-between gap-1.5 ${compact ? "mb-0.5" : "mb-1"}`}>
        <h4
          className={`min-w-0 font-bold text-[#f5e6c8] ${compact ? "text-[10px]" : "text-[11px]"}`}
        >
          {title}
        </h4>
        {kind === "active" && cooldown && (
          <span
            className={`shrink-0 rounded border border-[#5b8fd4]/40 bg-[#1a2a3f]/80 font-bold tabular-nums text-[#9ec5ff] ${
              compact ? "px-1 py-px text-[9px]" : "px-1.5 py-0.5 text-[10px]"
            }`}
            title="Active skill cooldown (turns at max level)"
          >
            CD {cooldown}
          </span>
        )}
      </div>
      {kind === "active" && voidSuperGravityTurns != null ? (
        <ActiveSkillVoidSuperGravityLine
          turns={voidSuperGravityTurns}
          compact={compact}
        />
      ) : null}
      {kind === "active" ? (
        <ActiveSkillDescText
          text={body}
          stageCooldowns={stageCooldowns}
          compact={compact}
          className={`whitespace-pre-wrap text-[#e8dcc8] ${
            compact ? "text-[9px] leading-snug" : "text-[10px] leading-relaxed"
          }`}
        />
      ) : (
        <LeaderSkillDescText
          text={body}
          className={`whitespace-pre-wrap text-[#e8dcc8] ${
            compact ? "text-[9px] leading-snug" : "text-[10px] leading-relaxed"
          }`}
        />
      )}
      {kind === "active" && vanishGrantedAwokenIds?.length ? (
        <ActiveSkillVanishAddLine
          ids={vanishGrantedAwokenIds}
          iconSize={compact ? 14 : 18}
        />
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
  changeTargetIds = [],
  onSelectChangeTarget,
  changeTargetLoadingId = null,
  compact = false,
  artSrc = null,
  iconSrc = null,
  showAttributes = false,
  framedIcon = false,
  hideUtilityLinks = false,
}: Props) {
  const id = monsterRowId(row);
  const nameTitle = useTruncatedTitle<HTMLHeadingElement>(
    row.name_en ?? "Unknown"
  );
  const regular = parseRegularAwakenings(row.awakenings);
  const hasSuperAwks =
    resolveSuperAwakeningIds(row.awakenings, row.super_awakenings).length > 0;
  const prefixedAwkIds = resolvePrefixedAwakeningIds(
    row.awakenings,
    row.super_awakenings,
    row.sync_awsid
  );
  const monsterTypeIds = parseMonsterTypeIds(row);
  const attributeIds = parseMonsterAttributeIds(row);
  const hasTypes = monsterTypeIds.length > 0;
  const hasAttributes = showAttributes && attributeIds.length > 0;
  const hasSuper = prefixedAwkIds.length > 0;
  const hasRegular = regular.length > 0;
  const hasAssistResonance =
    !hideUtilityLinks &&
    monsterHasAwakening(row, ASSIST_RESONANCE_AWAKENING_ID);
  const resonateSearchUrl = hasAssistResonance
    ? buildAssistResonanceSearchUrl(row)
    : null;
  const googleSearchUrl = hideUtilityLinks
    ? null
    : buildMonsterGoogleSearchUrl(row);
  const superLabel = hasSuperAwks ? "Super awakening" : "Sync awakening";

  const awkColumnRightOffset =
    (hasRegular ? PAD_AWAKENING.columnWidthPx : 0) +
    (hasSuper ? PAD_AWAKENING.columnWidthPx + PAD_AWAKENING.iconGapPx : 0) +
    12;
  const resonateButtonRight =
    (hasRegular ? PAD_AWAKENING.columnWidthPx : 0) +
    (hasSuper ? PAD_AWAKENING.columnWidthPx + PAD_AWAKENING.iconGapPx : 0) - 30;

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

  return (
    <article
      className={`relative w-full overflow-hidden bg-black ${
        compact
          ? "rounded-lg border border-[#a8842f]/80"
          : "mx-auto max-w-[360px] rounded-xl border-2 border-[#a8842f] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      }`}
    >
      {!compact && (
        <>
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
            src={artSrc}
            className="pointer-events-none absolute left-1/2 z-[1] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
            style={{
              top: `${PAD_CARD_VISUAL.artAnchorY}%`,
              width: `${PAD_CARD_VISUAL.artWidthPct}%`,
            }}
          />
        </>
      )}
      <header
        className={`relative z-10 border-b border-[#6b4f2a]/80 bg-[#2f2118]/90 ${
          compact ? "px-2 py-1" : "px-3 py-2"
        }`}
      >
        <div className="flex items-start gap-2">
          {compact &&
            (framedIcon ? (
              <FramedMonsterIcon
                monsterId={id}
                iconSrc={iconSrc}
                attributeIds={[
                  row.attribute_1_id,
                  row.attribute_2_id,
                  row.attribute_3_id,
                ]}
                sizePx={36}
              />
            ) : (
              <MonsterPortrait
                monsterId={id}
                alt=""
                variant="icon"
                src={iconSrc}
                className="h-9 w-9 shrink-0 rounded border border-[#8b6914]/60 object-cover"
              />
            ))}
          <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={`font-medium text-[#c9b08a] ${compact ? "text-[9px]" : "text-[10px]"}`}
              >
                No.{id}
              </p>
              <h3
                ref={nameTitle.ref}
                title={nameTitle.title}
                className={`truncate font-bold text-white ${compact ? "text-xs" : "text-sm"}`}
              >
                {row.name_en ?? "Unknown"}
              </h3>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StarRow count={row.rarity ?? 0} />
              {googleSearchUrl && (
                <LinkPillButton
                  href={googleSearchUrl}
                  title="Search this monster on Google (パズドラ)"
                >
                  Google
                </LinkPillButton>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10">
        <div
          className={`relative ${compact ? "flex flex-col gap-1 px-1 py-1" : "flex"}`}
          style={
            compact ? undefined : { minHeight: PAD_AWAKENING.artAreaMinHeightPx }
          }
        >
          <div
            className={`flex min-w-0 flex-col items-start gap-1 ${
              compact ? "w-full" : "min-w-0 flex-1 px-1 pt-1.5"
            }`}
          >
            {hasAttributes && (
              <MonsterCardIconGroup
                variant="type"
                aria-label={`Attributes: ${attributeIds.join(", ")}`}
              >
                <MonsterAttributeStrip attributeIds={attributeIds} bare />
              </MonsterCardIconGroup>
            )}
            {hasTypes && (
              <MonsterCardIconGroup
                variant="type"
                aria-label={`Types: ${monsterTypeIds.join(", ")}`}
              >
                <MonsterTypeStrip typeIds={monsterTypeIds} bare />
              </MonsterCardIconGroup>
            )}
            {changeTargetIds.length > 0 && onSelectChangeTarget && (
              <MonsterChangeTargetStrip
                targetIds={changeTargetIds}
                onSelectTarget={onSelectChangeTarget}
                loadingId={changeTargetLoadingId}
              />
            )}
            {compact && (onOpenEvo || onOpenCollab || resonateSearchUrl) && (
              <div className="flex flex-wrap items-center gap-1">
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
                {resonateSearchUrl && (
                  <LinkPillButton
                    href={resonateSearchUrl}
                    title="Search assist equipment (awk 49) matching primary attribute and type"
                  >
                    Resonate
                  </LinkPillButton>
                )}
              </div>
            )}
          </div>

          {compact ? (
            (hasSuper || hasRegular) && (
              <div className="flex w-full min-w-0 flex-col gap-0.5 pb-0.5">
                {hasSuper && (
                  <div className="min-w-0 overflow-x-auto">
                    <div
                      className="flex w-max flex-row items-center rounded-md border border-[#6b8f3c]/80 bg-[#2a3d18]/90 p-0.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                      style={{ gap: PAD_AWAKENING.iconGapPx }}
                      aria-label={superLabel}
                    >
                      <SuperAwakeningStrip
                        ids={prefixedAwkIds}
                        bare
                        size={COMPACT_AWAKENING_ICON_SIZE}
                        prefixTitle={superLabel}
                        iconTitle={(id) => `${superLabel} #${id}`}
                      />
                    </div>
                  </div>
                )}
                {hasRegular && (
                  <div className="min-w-0 overflow-x-auto">
                    <div
                      className="flex w-max flex-row items-center rounded-md border border-[#6b8f3c]/80 bg-[#2a3d18]/90 p-0.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                      style={{ gap: PAD_AWAKENING.iconGapPx }}
                      aria-label="Awakenings"
                    >
                      <AwakeningIconList
                        ids={regular}
                        layout="row"
                        bare
                        size={COMPACT_AWAKENING_ICON_SIZE}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            (hasSuper || hasRegular) && (
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
            )
          )}
          {!compact && (onOpenEvo || onOpenCollab) && (
            <div
              className="absolute bottom-1.5 left-1 z-20 flex items-center gap-1"
              style={{
                right: hasRegular || hasSuper ? awkColumnRightOffset : undefined,
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
          {!compact && resonateSearchUrl && (
            <LinkPillButton
              href={resonateSearchUrl}
              className="absolute bottom-1.5 z-20"
              style={{ right: resonateButtonRight }}
              title="Search assist equipment (awk 49) matching primary attribute and type"
            >
              Resonate
            </LinkPillButton>
          )}
        </div>
      </div>

      <div
        className={`relative z-10 rounded-md border border-[#8b6914]/80 bg-[#241a12]/95 shadow-inner ${
          compact ? "mx-1.5 px-1.5 py-1" : "mx-2 -mt-1 px-2 py-2"
        }`}
      >
        <div className="flex items-center gap-2">
          {!compact &&
            (framedIcon ? (
              <FramedMonsterIcon
                monsterId={id}
                iconSrc={iconSrc}
                attributeIds={[
                  row.attribute_1_id,
                  row.attribute_2_id,
                  row.attribute_3_id,
                ]}
                sizePx={44}
              />
            ) : (
              <MonsterPortrait
                monsterId={id}
                alt=""
                variant="icon"
                src={iconSrc}
                className="h-11 w-11 shrink-0 rounded border border-[#8b6914]/60 object-cover"
              />
            ))}
          <div className={`min-w-0 flex-1 ${compact ? "space-y-0.5" : "space-y-1"}`}>
            <StatRow label="HP" value={row.hp_max} compact={compact} />
            <StatRow label="ATK" value={row.atk_max} compact={compact} />
            <StatRow label="RCV" value={row.rcv_max} compact={compact} />
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

      <div
        className={`relative z-10 space-y-0 ${compact ? "px-1.5 pb-2 pt-0.5" : "px-2 pb-3 pt-1"}`}
      >
        <SkillBlock
          kind="active"
          title={row.active_skill_name_en?.trim() || "—"}
          body={activeDesc}
          cooldown={activeCooldown}
          stageCooldowns={perStageCd ? stageCooldowns : null}
          vanishGrantedAwokenIds={row.vanish_granted_awoken_ids}
          voidSuperGravityTurns={row.void_super_gravity_turns}
          compact={compact}
        />
        <SkillBlock
          kind="leader"
          title={row.leader_skill_name_en?.trim() || "—"}
          body={leaderDesc}
          compact={compact}
        />
      </div>
    </article>
  );
}

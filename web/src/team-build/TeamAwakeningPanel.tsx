import { AwakeningSpriteIcon } from "../components/AwakeningSpriteIcon";
import { awakeningFallbackImageUrl } from "../lib/awakening-sprite";
import { parseRegularAwakenings, resolveSuperAwakeningIds } from "../lib/awakenings";
import { grantedAssistAwakenings } from "../lib/team-build/passive-awakenings";
import {
  activeStatAwakeningIds,
  inactiveStatAwakeningIds,
  type StatContribution,
} from "../lib/team-build/stat-contributions";
import { superAwakeningLabel } from "../lib/team-build/super-awakening-modifier";
import type { MemberStatResult, TeamMemberConfig } from "../lib/team-build/types";
import type { MonsterRecord } from "../types";

type Props = {
  slotLabel: string;
  member: TeamMemberConfig;
  monster: MonsterRecord | null;
  eq: MonsterRecord | null;
  result: MemberStatResult | undefined;
  contributions: StatContribution[];
  onChangeMember: (next: TeamMemberConfig) => void;
  /** Back to the team-wide view (clears the selected slot). */
  onClearSelection?: () => void;
  /** Compact inline rendering (mobile, below the card). */
  inline?: boolean;
};

const ICON = 24;

const SOURCE_LABEL: Record<StatContribution["source"], string> = {
  card: "card",
  sync: "sync",
  super: "super",
  assist: "assist",
  team: "team",
  dungeon: "dungeon",
  leader: "leader",
  badge: "badge",
};

function AwkTile({
  id,
  state,
  title,
  onClick,
  selected,
}: {
  id: number;
  state: "active" | "inactive" | "plain";
  title?: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  const ring =
    selected
      ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] shadow-[var(--shadow-glow)]"
      : state === "active"
        ? "border-[var(--color-positive)]/70 bg-[var(--color-positive)]/10 shadow-[0_0_10px_rgba(16,185,129,0.25)]"
        : state === "inactive"
          ? "border-[var(--color-negative)]/60 bg-[var(--color-negative)]/10"
          : "border-transparent bg-[var(--color-inset)] opacity-70";
  const cls = `flex items-center justify-center rounded-md border p-0.5 ${ring} ${
    onClick ? "pressable cursor-pointer hover:opacity-100" : ""
  }`;
  const icon = <AwakeningSpriteIcon awokenSkillId={id} size={ICON} title={title} />;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={selected} title={title} className={cls}>
        {icon}
      </button>
    );
  }
  return (
    <span className={cls} title={title}>
      {icon}
    </span>
  );
}

function Section({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="ds-card p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="ds-label">{title}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

/**
 * Right-hand panel of the team page: the selected card's awakenings
 * (stat-affecting ones highlighted), its super awakening choice and every
 * bonus that feeds the slot's HP / ATK / RCV.
 */
export function TeamAwakeningPanel({
  slotLabel,
  member,
  monster,
  eq,
  result,
  contributions,
  onChangeMember,
  onClearSelection,
  inline = false,
}: Props) {
  const backButton = onClearSelection && (
    <button
      type="button"
      onClick={onClearSelection}
      title="Back to the team view"
      aria-label="Back to the team view"
      className="ds-btn pressable min-h-7 shrink-0 px-2 text-[10px] font-semibold"
    >
      ✕ Team
    </button>
  );

  if (!monster) {
    return (
      <div className={`flex items-center gap-2 ${inline ? "" : "p-3"} text-xs text-[var(--color-muted)]`}>
        <span className="min-w-0 flex-1">
          {slotLabel} is empty — pick a card to see its awakenings and stat bonuses.
        </span>
        {backButton}
      </div>
    );
  }

  const regular = parseRegularAwakenings(monster.awakenings);
  const superOptions = resolveSuperAwakeningIds(monster.awakenings, monster.super_awakenings);
  const sync = Number(monster.sync_awsid);
  const hasSync = Number.isFinite(sync) && sync > 0;
  const granted = grantedAssistAwakenings(eq);
  const active = activeStatAwakeningIds(contributions);
  const inactive = inactiveStatAwakeningIds(contributions);
  const stateOf = (id: number): "active" | "inactive" | "plain" =>
    active.has(id) ? "active" : inactive.has(id) ? "inactive" : "plain";
  const activeCount = contributions.filter((c) => c.active).length;

  return (
    <div className={`flex min-h-0 flex-col gap-2 ${inline ? "" : "h-full overflow-y-auto p-3"}`}>
      <div className="flex items-center gap-2 px-0.5">
        <span className="ds-label shrink-0 text-[var(--color-accent-strong)]">{slotLabel}</span>
        <span className="min-w-0 truncate text-xs font-semibold text-[var(--color-fg-strong)]">
          {monster.name_en ?? `#${monster.monster_id}`}
        </span>
        <span className="ml-auto shrink-0 rounded-full border border-[var(--color-positive)]/40 bg-[var(--color-positive)]/10 px-1.5 py-px font-mono text-[9px] font-bold text-emerald-300">
          {activeCount} active
        </span>
        {backButton}
      </div>

      <Section title="Awakenings" extra={<span className="text-[9px] text-[var(--color-faint)]">green = boosts stats · red = condition not met</span>}>
        <div className="flex flex-wrap gap-1">
          {regular.map((id, i) => (
            <AwkTile key={`${id}-${i}`} id={id} state={stateOf(id)} title={`#${id}`} />
          ))}
          {hasSync && (
            <span className="flex items-center gap-0.5 rounded-md border border-[var(--color-secondary)]/40 bg-[var(--color-secondary-muted)] p-0.5" title="Sync awakening">
              <img src={awakeningFallbackImageUrl} alt="" width={ICON} height={ICON} className="rounded-sm" />
              <AwkTile id={sync} state={stateOf(sync)} title={`Sync #${sync}`} />
            </span>
          )}
          {regular.length === 0 && !hasSync && (
            <span className="text-[10px] text-[var(--color-muted)]">No awakenings.</span>
          )}
        </div>
      </Section>

      {superOptions.length > 0 && (
        <Section title="Super awakening" extra={<span className="text-[9px] text-[var(--color-faint)]">click to swap</span>}>
          <div className="flex flex-wrap items-center gap-1">
            {superOptions.map((id) => {
              const selected = member.selectedSuperAwakening === id;
              return (
                <AwkTile
                  key={id}
                  id={id}
                  state={selected ? stateOf(id) : "plain"}
                  selected={selected}
                  title={`${superAwakeningLabel(id)} (#${id})`}
                  onClick={() =>
                    onChangeMember({
                      ...member,
                      selectedSuperAwakening: selected ? null : id,
                    })
                  }
                />
              );
            })}
            <button
              type="button"
              onClick={() => onChangeMember({ ...member, selectedSuperAwakening: null })}
              aria-pressed={member.selectedSuperAwakening == null}
              className={`ds-pill pressable min-h-7 px-2 text-[10px] font-semibold ${
                member.selectedSuperAwakening == null ? "ds-pill-active" : ""
              }`}
            >
              None
            </button>
          </div>
        </Section>
      )}

      {granted.length > 0 && (
        <Section title="From assist (Awoken Assist)">
          <div className="flex flex-wrap gap-1">
            {granted.map((id, i) => (
              <AwkTile key={`${id}-${i}`} id={id} state={stateOf(id)} title={`#${id} from assist`} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Stat bonuses">
        {contributions.length === 0 ? (
          <p className="text-[10px] text-[var(--color-muted)]">Nothing changes this card's stats.</p>
        ) : (
          <ul className="space-y-1">
            {contributions.map((c, i) => (
              <li
                key={`${c.source}-${c.id}-${i}`}
                className={`flex items-start gap-1.5 rounded-lg px-1 py-1 ${
                  c.active ? "bg-[var(--color-positive)]/[0.06]" : "bg-[var(--color-negative)]/[0.05]"
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {c.id > 0 ? (
                    <AwakeningSpriteIcon awokenSkillId={c.id} size={18} />
                  ) : (
                    <span className="flex h-[18px] w-[18px] items-center justify-center rounded bg-[var(--color-inset)] text-[10px]" aria-hidden>
                      {c.source === "assist" ? "⚙" : c.source === "badge" ? "★" : c.source === "leader" ? "♛" : "⛰"}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-[11px] font-semibold text-[var(--color-fg-strong)]">
                      {c.name}
                      {c.copies && c.copies > 1 && c.source !== "team" ? ` ×${c.copies}` : ""}
                    </span>
                    <span className="shrink-0 rounded bg-[var(--color-inset)] px-1 font-mono text-[8px] uppercase text-[var(--color-faint)]">
                      {SOURCE_LABEL[c.source]}
                    </span>
                  </span>
                  <span className={`block text-[10px] ${c.active ? "text-emerald-300" : "text-[var(--color-muted)] line-through"}`}>
                    {c.effect}
                  </span>
                  {c.note && <span className="block text-[9px] text-[var(--color-faint)]">{c.note}</span>}
                </span>
                <span
                  aria-label={c.active ? "active" : "inactive"}
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    c.active ? "bg-[var(--color-positive)]" : "bg-[var(--color-negative)]/70"
                  }`}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {result && (
        <Section title="Slot stats">
          <div className="grid grid-cols-3 gap-1 text-center">
            {(["hp", "atk", "rcv"] as const).map((k) => (
              <div key={k} className="rounded-lg bg-[var(--color-inset)] px-1 py-1">
                <div className="ds-label text-[8px]">{k.toUpperCase()}</div>
                <div className="font-mono text-xs font-bold tabular-nums text-[var(--color-fg-strong)]">
                  {result[k].afterDungeon.toLocaleString()}
                </div>
                <div className="font-mono text-[9px] tabular-nums text-[var(--color-faint)]" title="Raw (no awakening conditions, LS, dungeon)">
                  raw {result[k].afterRaw.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

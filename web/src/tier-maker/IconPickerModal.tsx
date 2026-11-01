import { useMemo, useState, type ReactNode } from "react";
import { AwakeningSpriteIcon } from "../components/AwakeningSpriteIcon";
import { EffectFilterSpriteIcon } from "../components/EffectFilterSpriteIcon";
import { MonsterAttributeSpriteIcon } from "../components/MonsterAttributeSpriteIcon";
import { MonsterTypeSpriteIcon } from "../components/MonsterTypeSpriteIcon";
import { OrbSpriteIcon } from "../components/OrbSpriteIcon";
import { SkillEffectSpriteIcon } from "../components/SkillEffectSpriteIcon";
import { maxAwakeningSkillId } from "../lib/awakening-sprite";
import {
  EFFECT_FILTER_ICON_ROW_BY_LABEL,
  EFFECT_FILTER_STANDALONE_IMAGE_BY_LABEL,
} from "../lib/effect-filter-sprite";
import { MONSTER_ATTRIBUTES } from "../lib/monster-attributes";
import { MONSTER_TYPES } from "../lib/monster-types";
import { ORB_SPRITES } from "../lib/orb-sprite";
import { SKILL_EFFECT_SPRITES } from "../lib/skill-effect-sprite";
import { TIER_ITEM_KIND_LABEL, type TierItemKind } from "./types";

type PickerKind = Exclude<TierItemKind, "card" | "text">;

const PICKER_KINDS: PickerKind[] = [
  "attribute",
  "orb",
  "filterEffect",
  "awakening",
  "skillEffect",
  "type",
];

const FILTER_EFFECT_LABELS = [
  ...Object.keys(EFFECT_FILTER_ICON_ROW_BY_LABEL),
  ...Object.keys(EFFECT_FILTER_STANDALONE_IMAGE_BY_LABEL),
];

const AWAKENING_IDS = Array.from(
  { length: maxAwakeningSkillId() },
  (_, i) => i + 1
);

type Option = {
  value: number | string;
  label: string;
  /** Extra search terms. */
  search?: string;
  icon: ReactNode;
};

const ICON_SIZE = 30;

function optionsFor(kind: PickerKind): Option[] {
  switch (kind) {
    case "attribute":
      return MONSTER_ATTRIBUTES.map((a) => ({
        value: a.id,
        label: a.label,
        icon: <MonsterAttributeSpriteIcon attributeId={a.id} size={ICON_SIZE} />,
      }));
    case "orb":
      return ORB_SPRITES.map((o) => ({
        value: o.id,
        label: o.label,
        search: o.aliases.join(" "),
        icon: <OrbSpriteIcon orbId={o.id} size={ICON_SIZE} title={o.label} />,
      }));
    case "filterEffect":
      return FILTER_EFFECT_LABELS.map((label) => ({
        value: label,
        label,
        icon: <EffectFilterSpriteIcon label={label} size={ICON_SIZE} />,
      }));
    case "awakening":
      return AWAKENING_IDS.map((id) => ({
        value: id,
        label: `#${id}`,
        icon: <AwakeningSpriteIcon awokenSkillId={id} size={ICON_SIZE} />,
      }));
    case "skillEffect":
      return SKILL_EFFECT_SPRITES.map((d) => ({
        value: d.id,
        label: `#${d.id}`,
        icon: (
          <SkillEffectSpriteIcon
            effectId={d.id}
            size={ICON_SIZE}
            title={`Skill effect #${d.id}`}
          />
        ),
      }));
    case "type":
      return MONSTER_TYPES.map((t) => ({
        value: t.id,
        label: t.label,
        icon: <MonsterTypeSpriteIcon typeId={t.id} size={ICON_SIZE} />,
      }));
  }
}

export function IconPickerModal({
  onPick,
  onClose,
}: {
  onPick: (kind: PickerKind, value: number | string) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<PickerKind>("attribute");
  const [query, setQuery] = useState("");
  const [lastPicked, setLastPicked] = useState<string | null>(null);

  const options = useMemo(() => optionsFor(kind), [kind]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.search ?? "").toLowerCase().includes(q) ||
        String(o.value).toLowerCase() === q
    );
  }, [options, query]);

  const pick = (o: Option) => {
    onPick(kind, o.value);
    setLastPicked(`${TIER_ITEM_KIND_LABEL[kind]} ${o.label} added`);
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-label="Add icon to cell"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="ds-float animate-sheet-in sm:animate-fade-in flex max-h-[min(85vh,42rem)] w-full max-w-xl flex-col rounded-t-3xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:rounded-2xl sm:pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-sm font-bold text-[var(--color-fg-strong)]">
          Add icon to cell
        </h3>
        <p className="mb-2 text-[11px] text-[var(--color-muted)]">
          Click icons to add them. The picker stays open so you can add several.
        </p>
        <div className="mb-2 flex flex-wrap gap-1" role="tablist">
          {PICKER_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => {
                setKind(k);
                setQuery("");
              }}
              className={`ds-pill pressable min-h-8 px-3 text-[11px] font-semibold ${
                kind === k ? "ds-pill-active" : ""
              }`}
            >
              {TIER_ITEM_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <label className="mb-3 block">
          <span className="sr-only">Search icons</span>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or #id…"
            className="ds-input min-h-9 w-full px-2.5 py-1.5 text-xs"
          />
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          {visible.length === 0 ? (
            <p className="px-1 py-4 text-center text-xs text-[var(--color-muted)]">
              No icons match “{query.trim()}”.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {visible.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  title={o.label}
                  onClick={() => pick(o)}
                  className="pressable flex w-14 flex-col items-center gap-0.5 rounded border border-transparent p-1 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-muted)]"
                >
                  {o.icon}
                  <span className="max-w-full truncate text-[8px] leading-tight text-[var(--color-muted)]">
                    {o.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-[var(--color-positive)]">
            {lastPicked}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ds-btn pressable min-h-10 shrink-0 px-4 text-xs font-semibold sm:min-h-9"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

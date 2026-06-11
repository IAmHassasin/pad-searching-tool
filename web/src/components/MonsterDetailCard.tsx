import cardBackground from "../assets/pad/background.png";
import { monsterRowId } from "../lib/filters";
import { parseAwakenings } from "../lib/awakenings";
import { PAD_AWAKENING, PAD_CARD_VISUAL } from "../lib/pad-constants";
import type { MonsterRecord } from "../types";
import { AwakeningIconList } from "./AwakeningIconList";
import { AwakeningSpriteIcon } from "./AwakeningSpriteIcon";
import { MonsterPortrait } from "./MonsterPortrait";

const ATTRIBUTE_LABELS: Record<number, string> = {
  0: "Fire",
  1: "Water",
  2: "Wood",
  3: "Light",
  4: "Dark",
};

type Props = {
  row: MonsterRecord;
};

function StarRow({ count }: { count: number }) {
  if (!count) return null;
  return (
    <div className="flex gap-px" aria-label={`${count} star rarity`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="text-[11px] text-[#ffd54f] drop-shadow-[0_0_2px_#b8860b]">
          ★
        </span>
      ))}
    </div>
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <div className="flex items-baseline gap-1.5 text-[11px] leading-none">
      <span className="w-7 font-bold text-[#f0d9b5]">{label}</span>
      <span className="font-bold tabular-nums text-white">
        {value?.toLocaleString() ?? "—"}
      </span>
    </div>
  );
}

function SkillBlock({
  kind,
  title,
  body,
}: {
  kind: "active" | "leader";
  title: string;
  body: string;
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
      <h4 className="mb-1 text-[11px] font-bold text-[#f5e6c8]">{title}</h4>
      <p className="whitespace-pre-wrap text-[10px] leading-relaxed text-[#e8dcc8]">
        {body}
      </p>
    </section>
  );
}

export function MonsterDetailCard({ row }: Props) {
  const id = monsterRowId(row);
  const { regular, super: superAwks } = parseAwakenings(row.awakenings);
  const attrLabel =
    row.attribute_1_id != null
      ? ATTRIBUTE_LABELS[row.attribute_1_id] ?? `Attr ${row.attribute_1_id}`
      : null;

  const activeDesc = row.active_skill_desc_en?.trim() || "—";
  const leaderDesc = row.leader_skill_desc_en?.trim() || "—";

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
            {attrLabel && (
              <p className="mt-0.5 text-[10px] text-[#d4c4a8]">{attrLabel}</p>
            )}
          </div>
          <StarRow count={row.rarity ?? 0} />
        </div>
      </header>

      <div className="relative z-10">
        <div
          className="flex"
          style={{ minHeight: PAD_AWAKENING.artAreaMinHeightPx }}
        >
          <div className="min-w-0 flex-1" aria-hidden />
          <div
            className="flex shrink-0 flex-col items-center bg-black/40 py-1.5 pr-1"
            style={{
              width: PAD_AWAKENING.columnWidthPx,
              gap: PAD_AWAKENING.iconGapPx,
            }}
          >
            {superAwks.length > 0 && (
              <AwakeningSpriteIcon
                awokenSkillId={superAwks[0]}
                title={`Super awakening: #${superAwks.join(", #")}`}
              />
            )}
            <AwakeningIconList ids={regular} layout="column" />
          </div>
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

import mockedMonsterArt from "../assets/pad/13573.png";
import awakeningPlaceholder from "../assets/pad/awakenings/0.png";
import { monsterRowId } from "../lib/filters";
import { parseAwakenings } from "../lib/awakenings";
import type { MonsterRecord } from "../types";

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

function AwakeningIcon({ title }: { title?: string }) {
  return (
    <img
      src={awakeningPlaceholder}
      alt=""
      title={title}
      className="h-7 w-7 shrink-0 rounded-sm border border-[#6b8f3c]/80 bg-[#2a3d18] object-cover shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
    />
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

function skillTitle(desc?: string | null, fallback = "—"): string {
  const text = desc?.trim();
  if (!text) return fallback;
  const firstLine = text.split(/\n/)[0]?.trim();
  if (!firstLine) return fallback;
  return firstLine.length > 48 ? `${firstLine.slice(0, 45)}…` : firstLine;
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
    <article className="mx-auto w-full max-w-[360px] overflow-hidden rounded-xl border-2 border-[#a8842f] bg-[linear-gradient(180deg,#4a3526_0%,#3a281c_100%)] shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
      <header className="border-b border-[#6b4f2a]/80 bg-[#2f2118]/90 px-3 py-2">
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

      <div className="relative bg-black">
        <div className="flex min-h-[200px]">
          <div className="relative min-w-0 flex-1">
            <img
              src={mockedMonsterArt}
              alt={row.name_en ?? "Monster artwork"}
              className="h-full w-full object-contain object-center"
            />
          </div>
          <div className="flex w-9 shrink-0 flex-col items-center gap-0.5 bg-[#1a120c]/60 py-1.5 pr-1">
            {superAwks.length > 0 && (
              <AwakeningIcon title={`Super awakening (${superAwks.length})`} />
            )}
            {regular.length > 0 ? (
              regular.map((awkId, i) => (
                <AwakeningIcon key={`${awkId}-${i}`} title={`Awakening #${awkId}`} />
              ))
            ) : (
              Array.from({ length: 3 }, (_, i) => (
                <AwakeningIcon key={`placeholder-${i}`} title="Awakening" />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mx-2 -mt-1 rounded-md border border-[#8b6914]/80 bg-[#241a12]/95 px-2 py-2 shadow-inner">
        <div className="flex items-center gap-2">
          <img
            src={mockedMonsterArt}
            alt=""
            className="h-11 w-11 shrink-0 rounded border border-[#8b6914]/60 object-cover object-top"
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

      <div className="space-y-0 px-2 pb-3 pt-1">
        <SkillBlock
          kind="active"
          title={skillTitle(activeDesc, "Active Skill")}
          body={activeDesc}
        />
        <SkillBlock
          kind="leader"
          title={skillTitle(leaderDesc, "Leader Skill")}
          body={leaderDesc}
        />
      </div>
    </article>
  );
}

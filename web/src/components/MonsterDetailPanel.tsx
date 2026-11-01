import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchMonstersByIds } from "../api";
import { parseChangeToMonsterIds } from "../lib/format-active-skill-desc";
import { monsterRowId } from "../lib/filters";
import type { MonsterRecord } from "../types";
import { MonsterCollabGroupPanel } from "./MonsterCollabGroupPanel";
import { MonsterDetailCard } from "./MonsterDetailCard";
import { MonsterEvoTreePanel } from "./MonsterEvoTreePanel";

type Overlay = "evo" | "collab" | null;

/** Matches `max-w-[360px]` on the detail card. Scaling starts from this layout. */
const DETAIL_CARD_WIDTH_PX = 360;

function FitCardFrame({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, width: DETAIL_CARD_WIDTH_PX, height: 0 });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const card = cardRef.current;
    if (!frame || !card) return;

    const measure = () => {
      const naturalW = card.offsetWidth;
      const naturalH = card.offsetHeight;
      const availW = frame.clientWidth;
      const availH = frame.clientHeight;
      if (naturalW <= 0 || naturalH <= 0 || availW <= 0 || availH <= 0) return;
      const scale = Math.min(availW / naturalW, availH / naturalH);
      const width = naturalW * scale;
      const height = naturalH * scale;
      setFit((prev) => {
        if (
          Math.abs(prev.scale - scale) < 0.001 &&
          Math.abs(prev.width - width) < 0.5 &&
          Math.abs(prev.height - height) < 0.5
        ) {
          return prev;
        }
        return { scale, width, height };
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      className="flex h-full min-h-0 w-full items-start justify-center overflow-hidden"
    >
      <div
        className="relative shrink-0 overflow-hidden"
        style={
          fit.height > 0
            ? { width: fit.width, height: fit.height }
            : { width: DETAIL_CARD_WIDTH_PX }
        }
      >
        <div
          ref={cardRef}
          style={{
            width: DETAIL_CARD_WIDTH_PX,
            transform: `scale(${fit.scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

type Props = {
  row: MonsterRecord;
  onSelect: (row: MonsterRecord) => void;
  /** Mobile sidebar: fill container width, no centering gap. */
  sidebar?: boolean;
  /** When true with sidebar, show full card art instead of compact layout. */
  showFullArt?: boolean;
  /** Desktop results column: scale the 360px card until width or height hits the pane. */
  fill?: boolean;
};

export function MonsterDetailPanel({
  row,
  onSelect,
  sidebar = false,
  showFullArt = false,
  fill = false,
}: Props) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [changeTargetLoadingId, setChangeTargetLoadingId] = useState<
    number | null
  >(null);
  const monsterId = monsterRowId(row);
  const changeTargetIds = useMemo(
    () => parseChangeToMonsterIds(row.active_skill_desc_en?.trim() ?? ""),
    [row.active_skill_desc_en]
  );

  useEffect(() => {
    setOverlay(null);
    setChangeTargetLoadingId(null);
  }, [monsterId]);

  const handleSelect = (next: MonsterRecord) => {
    setOverlay(null);
    onSelect(next);
  };

  const handleSelectChangeTarget = async (targetId: number) => {
    setChangeTargetLoadingId(targetId);
    try {
      const { rows } = await fetchMonstersByIds([targetId]);
      const next = rows[0];
      if (next) handleSelect(next);
    } finally {
      setChangeTargetLoadingId(null);
    }
  };

  const card = (
    <MonsterDetailCard
      row={row}
      evoActive={overlay === "evo"}
      collabActive={overlay === "collab"}
      onOpenEvo={() => setOverlay((v) => (v === "evo" ? null : "evo"))}
      onOpenCollab={() =>
        setOverlay((v) => (v === "collab" ? null : "collab"))
      }
      changeTargetIds={changeTargetIds}
      onSelectChangeTarget={handleSelectChangeTarget}
      changeTargetLoadingId={changeTargetLoadingId}
      compact={sidebar && !showFullArt}
    />
  );

  return (
    <div
      className={`relative flex h-full w-full flex-col ${
        fill
          ? "min-h-0 flex-1"
          : sidebar
            ? "min-h-0"
            : "mx-auto min-h-[min(100%,720px)] max-w-[360px]"
      }`}
    >
      {fill ? <FitCardFrame>{card}</FitCardFrame> : card}

      {overlay && (
        <div className="animate-fade-in absolute inset-0 z-30 flex min-h-0 flex-col rounded-xl bg-[var(--color-surface)] p-0">
          {overlay === "evo" ? (
            <MonsterEvoTreePanel
              monsterId={monsterId}
              onClose={() => setOverlay(null)}
              onSelect={handleSelect}
            />
          ) : (
            <MonsterCollabGroupPanel
              monsterId={monsterId}
              onClose={() => setOverlay(null)}
              onSelect={handleSelect}
            />
          )}
        </div>
      )}
    </div>
  );
}

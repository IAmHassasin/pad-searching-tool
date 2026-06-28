import { monsterRowId } from "../lib/filters";
import type { MonsterRecord } from "../types";
import { MonsterRowIdentityChips } from "./MonsterRowIdentityChips";
import {
  MonsterPreviewInfoButton,
  MonsterResultPreviewFloating,
  useMonsterResultPreview,
} from "./MonsterResultPreviewPopover";

type Props = {
  rows: MonsterRecord[];
  selected: MonsterRecord | null;
  onSelect: (row: MonsterRecord | null) => void;
  loading: boolean;
  compact?: boolean;
  /** Mobile split view: only NA ID and name */
  minimal?: boolean;
};

export function ResultsList({
  rows,
  selected,
  onSelect,
  loading,
  compact = false,
  minimal = false,
}: Props) {
  const {
    preview,
    previewId,
    bindRowPreview,
    openPinnedPreview,
    closePreview,
    hoverCapable,
  } = useMonsterResultPreview();

  return (
    <>
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-[#21262d] text-[var(--color-muted)]">
          <tr>
            <th className={`py-1.5 ${minimal ? "w-8 px-0.5" : "w-16 px-1"}`}>
              {!minimal && "Attr"}
            </th>
            <th className={`py-1.5 ${minimal ? "px-1" : "px-2"}`}>NA ID</th>
            <th className={`py-1.5 ${minimal ? "px-1" : "px-2"}`}>Name</th>
            {!compact && !minimal && (
              <>
                <th className="px-2 py-1.5">HP</th>
                <th className="px-2 py-1.5">ATK</th>
                <th className="px-2 py-1.5">RCV</th>
              </>
            )}
            {!hoverCapable && (
              <th className={`py-1.5 ${minimal ? "w-6 px-0" : "w-7 px-0.5"}`} />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 2000).map((row) => {
            const id = monsterRowId(row);
            const active = selected && monsterRowId(selected) === id;
            const previewProps = bindRowPreview(row);

            return (
              <tr
                key={id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-t border-[var(--color-border)] outline-none hover:bg-[#21262d] focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset ${active ? "bg-[#1f3a5f]" : ""}`}
                {...previewProps}
              >
                <td className={`py-1 ${minimal ? "px-0.5" : "px-1"}`}>
                  <MonsterRowIdentityChips row={row} minimal={minimal} />
                </td>
                <td
                  className={`py-1 font-mono ${minimal ? "px-1 text-[10px]" : "px-2"}`}
                >
                  {row.monster_no_na ?? "—"}
                </td>
                <td
                  className={`truncate py-1 ${minimal ? "max-w-[4.5rem] px-1 text-[10px]" : compact ? "max-w-[8rem] px-2" : "max-w-[12rem] px-2"}`}
                >
                  {row.name_en ?? "—"}
                </td>
                {!compact && !minimal && (
                  <>
                    <td className="px-2 py-1">{row.hp_max ?? "—"}</td>
                    <td className="px-2 py-1">{row.atk_max ?? "—"}</td>
                    <td className="px-2 py-1">{row.rcv_max ?? "—"}</td>
                  </>
                )}
                {!hoverCapable && (
                  <td className={`py-1 ${minimal ? "px-0" : "px-0.5"}`}>
                    <MonsterPreviewInfoButton
                      describedBy={
                        preview != null &&
                        monsterRowId(preview.row) === id
                          ? previewId
                          : undefined
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        if (preview?.row === row && preview.pinned) {
                          closePreview();
                        } else {
                          openPinnedPreview(row, e.currentTarget.closest("tr")!);
                        }
                      }}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <MonsterResultPreviewFloating
        preview={preview}
        previewId={previewId}
        onClose={closePreview}
      />
      {rows.length > 2000 && (
        <p className="p-2 text-xs text-[var(--color-muted)]">
          Showing first 2000 of {rows.length} matches.
        </p>
      )}
      {!loading && rows.length === 0 && (
        <p className="p-4 text-sm text-[var(--color-muted)]">
          No monsters match the current filters.
        </p>
      )}
    </>
  );
}

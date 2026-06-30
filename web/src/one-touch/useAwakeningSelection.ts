import { useCallback, useState } from "react";
import type { AwakeningSelectionEntry } from "./types";

export function useAwakeningSelection() {
  const [entries, setEntries] = useState<AwakeningSelectionEntry[]>([]);

  const add = useCallback(
    (id: number, nameEn: string, count = 1) => {
      if (!Number.isFinite(id) || id <= 0) return;
      const n = Math.max(1, Math.min(8, Math.floor(count)));
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.id === id);
        if (idx < 0) return [...prev, { id, nameEn, count: n }];
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          count: Math.min(8, next[idx].count + n),
        };
        return next;
      });
    },
    []
  );

  const setCount = useCallback((id: number, count: number) => {
    const n = Math.max(1, Math.min(8, Math.floor(count)));
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, count: n } : e))
    );
  }, []);

  const remove = useCallback((id: number) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const addFloorAwakenings = useCallback(
    (awakenings: { id: number | null; nameEn: string }[]) => {
      for (const a of awakenings) {
        if (a.id != null) add(a.id, a.nameEn, 1);
      }
    },
    [add]
  );

  return { entries, add, setCount, remove, clear, addFloorAwakenings };
}

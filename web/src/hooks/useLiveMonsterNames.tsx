import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { translateMonsterNames } from "../api";
import { monsterRowId } from "../lib/filters";
import type { MonsterRecord } from "../types";

const JAPANESE_SCRIPT = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;
const REQUEST_DEBOUNCE_MS = 200;
const FAILURE_COOLDOWN_MS = 30_000;

export function containsJapanese(text: string): boolean {
  return JAPANESE_SCRIPT.test(text);
}

/** True when the name shown in the list is still Japanese. */
export function monsterNameNeedsTranslation(
  row: Pick<MonsterRecord, "name_en" | "name_jp">
): boolean {
  const en = row.name_en?.trim() ?? "";
  if (en) return containsJapanese(en);
  return containsJapanese(row.name_jp?.trim() ?? "");
}

type MonsterNameApi = {
  requestIds: (ids: number[]) => void;
  nameFor: (row: MonsterRecord, fallback?: string) => string;
};

const MonsterNameTranslationContext = createContext<MonsterNameApi | null>(null);

const fallbackApi: MonsterNameApi = {
  requestIds: () => {},
  nameFor: (row, fallback = "—") =>
    row.name_en?.trim() || row.name_jp?.trim() || fallback,
};

export function MonsterNameTranslationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [names, setNames] = useState<Record<number, string>>({});
  const namesRef = useRef(names);
  namesRef.current = names;
  const pendingRef = useRef(new Set<number>());
  const queuedRef = useRef(new Set<number>());
  const timerRef = useRef<number | null>(null);
  const cooldownUntilRef = useRef(0);

  const flush = useCallback(() => {
    const now = Date.now();
    if (now < cooldownUntilRef.current) {
      if (timerRef.current == null && queuedRef.current.size > 0) {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          flush();
        }, cooldownUntilRef.current - now);
      }
      return;
    }

    const ids = [...queuedRef.current]
      .filter((id) => namesRef.current[id] == null && !pendingRef.current.has(id))
      .slice(0, 40);
    if (!ids.length) return;
    for (const id of ids) {
      queuedRef.current.delete(id);
      pendingRef.current.add(id);
    }

    void translateMonsterNames(ids)
      .then((response) => {
        setNames((current) => {
          const next = { ...current };
          let changed = false;
          for (const id of ids) {
            const value = response.names[String(id)]?.trim();
            if (!value) continue;
            next[id] = value;
            changed = true;
          }
          return changed ? next : current;
        });
      })
      .catch(() => {
        cooldownUntilRef.current = Date.now() + FAILURE_COOLDOWN_MS;
        for (const id of ids) queuedRef.current.add(id);
        if (timerRef.current == null) {
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            flush();
          }, FAILURE_COOLDOWN_MS);
        }
      })
      .finally(() => {
        for (const id of ids) pendingRef.current.delete(id);
      });
  }, []);

  const requestIds = useCallback(
    (ids: number[]) => {
      let added = false;
      for (const id of ids) {
        if (!Number.isInteger(id) || id <= 0) continue;
        if (
          namesRef.current[id] != null ||
          pendingRef.current.has(id) ||
          queuedRef.current.has(id)
        ) {
          continue;
        }
        queuedRef.current.add(id);
        added = true;
      }
      if (!added) return;
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        flush();
      }, REQUEST_DEBOUNCE_MS);
    },
    [flush]
  );

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    []
  );

  const nameFor = useCallback(
    (row: MonsterRecord, fallback = "—") => {
      const translated = names[monsterRowId(row)];
      if (translated) return translated;
      return row.name_en?.trim() || row.name_jp?.trim() || fallback;
    },
    [names]
  );

  const value = useMemo(
    () => ({ requestIds, nameFor }),
    [requestIds, nameFor]
  );

  return (
    <MonsterNameTranslationContext.Provider value={value}>
      {children}
    </MonsterNameTranslationContext.Provider>
  );
}

export function useMonsterNameTranslation(): MonsterNameApi {
  return useContext(MonsterNameTranslationContext) ?? fallbackApi;
}

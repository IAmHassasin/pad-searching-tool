import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  EMPTY_MONSTER_FILTERS,
  EMPTY_SKILL_FILTERS,
  type MonsterFilters,
  type SkillFilters,
} from "../../types";

/** An ID field that the sidebar fills when a result is picked. */
export type QuickSearchTarget = {
  /** Stable identity of the field (e.g. "slot-2-monster"). */
  key: string;
  /** Shown in the sidebar header ("Filling: Sub 2 · Monster ID"). */
  label: string;
  onPick: (monsterId: number) => void;
};

type QuickSearchApi = {
  target: QuickSearchTarget | null;
  expanded: boolean;
  /** Make `target` the active field and open the sidebar. */
  activate: (target: QuickSearchTarget) => void;
  /** Make `target` the active field without opening the sidebar (mobile focus). */
  select: (target: QuickSearchTarget) => void;
  /** Refresh the pick callback of the active field (keeps closures fresh). */
  updateTarget: (target: QuickSearchTarget) => void;
  clearTarget: () => void;
  expand: () => void;
  collapse: () => void;
  toggleExpanded: () => void;
  /** Fill the active field and collapse. Returns false when no field is active. */
  pick: (monsterId: number) => boolean;
  /** Filter state lives here so collapsing the sidebar keeps the search. */
  monsterFilters: MonsterFilters;
  setMonsterFilters: (next: MonsterFilters) => void;
  skillFilters: SkillFilters;
  setSkillFilters: (next: SkillFilters) => void;
};

const QuickSearchContext = createContext<QuickSearchApi | null>(null);

export function QuickSearchProvider({
  children,
  defaultExpanded = false,
}: {
  children: ReactNode;
  /** Start with the sidebar open (team build keeps it open on desktop). */
  defaultExpanded?: boolean;
}) {
  const [target, setTarget] = useState<QuickSearchTarget | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [monsterFilters, setMonsterFilters] =
    useState<MonsterFilters>(EMPTY_MONSTER_FILTERS);
  const [skillFilters, setSkillFilters] =
    useState<SkillFilters>(EMPTY_SKILL_FILTERS);
  const targetRef = useRef<QuickSearchTarget | null>(null);
  targetRef.current = target;

  const activate = useCallback((next: QuickSearchTarget) => {
    setTarget(next);
    setExpanded(true);
  }, []);

  const select = useCallback((next: QuickSearchTarget) => {
    setTarget(next);
  }, []);

  const updateTarget = useCallback((next: QuickSearchTarget) => {
    setTarget((current) => {
      if (!current || current.key !== next.key) return current;
      // Same field with the same callbacks: keep the reference so effects
      // depending on the context value do not re-run forever.
      if (current.label === next.label && current.onPick === next.onPick) {
        return current;
      }
      return next;
    });
  }, []);

  const clearTarget = useCallback(() => setTarget(null), []);
  const expand = useCallback(() => setExpanded(true), []);
  const collapse = useCallback(() => setExpanded(false), []);
  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);

  const pick = useCallback((monsterId: number) => {
    const current = targetRef.current;
    if (!current) return false;
    current.onPick(monsterId);
    setExpanded(false);
    return true;
  }, []);

  const api = useMemo<QuickSearchApi>(
    () => ({
      target,
      expanded,
      activate,
      select,
      updateTarget,
      clearTarget,
      expand,
      collapse,
      toggleExpanded,
      pick,
      monsterFilters,
      setMonsterFilters,
      skillFilters,
      setSkillFilters,
    }),
    [
      target,
      expanded,
      activate,
      select,
      updateTarget,
      clearTarget,
      expand,
      collapse,
      toggleExpanded,
      pick,
      monsterFilters,
      skillFilters,
    ]
  );

  return (
    <QuickSearchContext.Provider value={api}>
      {children}
    </QuickSearchContext.Provider>
  );
}

export function useQuickSearch(): QuickSearchApi {
  const api = useContext(QuickSearchContext);
  if (!api) {
    throw new Error("useQuickSearch must be used inside QuickSearchProvider");
  }
  return api;
}

/** Null-safe variant for components that may render outside the provider. */
export function useOptionalQuickSearch(): QuickSearchApi | null {
  return useContext(QuickSearchContext);
}

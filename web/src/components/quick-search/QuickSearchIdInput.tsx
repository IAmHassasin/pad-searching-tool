import {
  useCallback,
  useEffect,
  useRef,
  type InputHTMLAttributes,
} from "react";
import { useMobileWebview } from "../../hooks/useMobileWebview";
import { useOptionalQuickSearch } from "./QuickSearchContext";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  /** Stable identity of this field for the sidebar. */
  targetKey: string;
  /** Human label shown in the sidebar header while this field is active. */
  targetLabel: string;
  /** Called with the monster id picked in the sidebar. */
  onPickId: (monsterId: number) => void;
};

/**
 * Plain `<input>` that registers itself as the quick-search target.
 * Desktop: focusing / clicking the field opens the sidebar. Mobile: focusing
 * only selects the field (the drawer would cover it); a search button at the
 * right edge opens the drawer. Falls back to a normal input without provider.
 */
export function QuickSearchIdInput({
  targetKey,
  targetLabel,
  onPickId,
  className = "",
  onFocus,
  onClick,
  ...rest
}: Props) {
  const qs = useOptionalQuickSearch();
  const isMobile = useMobileWebview();
  const isActive = qs?.target?.key === targetKey;
  const expanded = qs?.expanded ?? false;
  const activateTarget = qs?.activate;
  const selectTarget = qs?.select;
  const updateTarget = qs?.updateTarget;

  // The pick callback closes over the current slot state; keep the latest one
  // behind a stable function so the provider never sees a new identity.
  const onPickRef = useRef(onPickId);
  onPickRef.current = onPickId;
  const stablePick = useCallback((id: number) => onPickRef.current(id), []);

  useEffect(() => {
    if (!updateTarget || !isActive) return;
    updateTarget({ key: targetKey, label: targetLabel, onPick: stablePick });
  }, [updateTarget, isActive, targetKey, targetLabel, stablePick]);

  const targetDef = () => ({
    key: targetKey,
    label: targetLabel,
    onPick: stablePick,
  });
  const onFieldFocus = () => {
    if (isMobile) selectTarget?.(targetDef());
    else activateTarget?.(targetDef());
  };

  const input = (
    <input
      {...rest}
      className={`${className} ${
        isActive && expanded
          ? "border-[var(--color-secondary)] shadow-[var(--shadow-glow-cyan)]"
          : ""
      } ${isMobile && qs ? "pr-9" : ""}`}
      data-quick-search-target={isActive ? "active" : undefined}
      onFocus={(e) => {
        onFieldFocus();
        onFocus?.(e);
      }}
      onClick={(e) => {
        onFieldFocus();
        onClick?.(e);
      }}
    />
  );

  if (!isMobile || !qs) return input;

  return (
    <span className="relative block min-w-0">
      {input}
      <button
        type="button"
        onClick={() => activateTarget?.(targetDef())}
        title="Open quick search for this field"
        aria-label={`Open quick search for ${targetLabel}`}
        className="pressable absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-sm text-[var(--color-muted)] hover:text-[var(--color-accent-strong)]"
      >
        <span aria-hidden>🔍</span>
      </button>
    </span>
  );
}

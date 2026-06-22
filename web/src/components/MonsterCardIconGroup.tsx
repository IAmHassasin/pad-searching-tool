import type { CSSProperties, ReactNode } from "react";
import { PAD_AWAKENING } from "../lib/pad-constants";

export type MonsterCardIconGroupVariant = "type" | "super" | "regular";

const variantClass: Record<MonsterCardIconGroupVariant, string> = {
  type: "border-[#a8842f]/70 bg-[#2f2118]/85",
  super: "border-[#6b8f3c]/80 bg-[#2a3d18]/90",
  regular: "border-[#6b8f3c]/80 bg-[#2a3d18]/90",
};

type Props = {
  variant: MonsterCardIconGroupVariant;
  layout?: "row" | "column";
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
};

/** Shared frame for type / super-sync / regular awakening clusters on the detail card. */
export function MonsterCardIconGroup({
  variant,
  layout = variant === "regular" ? "column" : "row",
  children,
  className = "",
  style,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <div
      className={`flex shrink-0 rounded-md border p-0.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] ${
        layout === "column" ? "flex-col items-center" : "flex-row items-center"
      } ${variant === "type" ? "w-fit" : ""} ${variantClass[variant]} ${className}`}
      style={{ gap: PAD_AWAKENING.iconGapPx, ...style }}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
